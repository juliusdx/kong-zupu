<?php
/**
 * Privacy tests. Builds a throwaway SQLite database with the same schema and the
 * awkward cases — a minor, an archived person, an unapproved upload, a member
 * photo — and asserts what each kind of viewer may see.
 *
 * These are the assertions that would have caught the Supabase leak: the file
 * and the row are checked by the same code, so a test on the code covers both.
 *
 *   php tests/run.php
 */
declare(strict_types=1);

$dbFile = sys_get_temp_dir() . '/zupu_test_' . getmypid() . '.db';
@unlink($dbFile);

$GLOBALS['ZUPU_CONFIG'] = [
    'db'               => ['driver' => 'sqlite', 'path' => $dbFile],
    'media_root'       => sys_get_temp_dir() . '/zupu_test_media',
    'site_url'         => 'https://test.local',
    'secure_cookies'   => false,
    'enforce_approval' => true,
    'mail'             => ['from' => 't@test.local', 'from_name' => 'test'],
];
require_once __DIR__ . '/../lib/repo.php';
require_once __DIR__ . '/../lib/auth.php';

db()->exec(file_get_contents(__DIR__ . '/../sql/schema.sqlite.sql'));

// ---- fixtures --------------------------------------------------------------
$ins = function (string $t, array $row) {
    $cols = implode(',', array_keys($row));
    $qs   = implode(',', array_fill(0, count($row), '?'));
    q("INSERT INTO {$t} ({$cols}) VALUES ({$qs})", array_values($row));
};

$ins('persons', ['id'=>'anc1','name'=>'江八郎','gen'=>1,'visibility'=>'public','living'=>0]);
$ins('persons', ['id'=>'mem1','name'=>'Living Relative','gen'=>26,'visibility'=>'member','living'=>1]);
$ins('persons', ['id'=>'kid1','name'=>'A Child','gen'=>27,'visibility'=>'member','living'=>1,'is_minor'=>1]);
$ins('persons', ['id'=>'arc1','name'=>'Archived Person','gen'=>26,'visibility'=>'public','archived'=>1]);
// A deceased ancestor with dates and a biography on the PERSON row and NO
// person_details row — which is how 40 birth years and 53 biographies are
// actually stored, and which the API silently dropped for everyone.
$ins('persons', ['id'=>'anc2','name'=>'江萬里','gen'=>2,'visibility'=>'public','living'=>0,
                 'birth_year'=>'宋嘉定十一年','death_year'=>'德祐元年','lifespan'=>'享壽五十八',
                 'religion'=>'儒','bio'=>'登宋咸淳進士，累官尚書。','birth_place'=>'p_ninghua']);
$ins('person_details', ['person_id'=>'mem1','birth_year'=>'1980','bio'=>'private detail']);
// Gordon's shape: living, birth year on the ROW, no person_details row. This is
// how the contribution form stores a relative, and it reached nobody.
$ins('persons', ['id'=>'mem2','name'=>'修锋','gen'=>26,'father_id'=>'k_daxin',
                 'living'=>1,'visibility'=>'member','birth_year'=>'1975','bio'=>'row-only bio']);
$ins('contacts', ['person_id'=>'mem1','phone'=>'+60 12 000 0000']);
$ins('places', ['id'=>'pl1','type'=>'grave','name'=>'邻浪笄子坑蛇地','visibility'=>'public']);
$ins('media', ['id'=>'11111111-1111-1111-1111-111111111111','person_id'=>'anc1','path'=>'a/pub.jpg','visibility'=>'public','approved'=>1]);
$ins('media', ['id'=>'22222222-2222-2222-2222-222222222222','person_id'=>'mem1','path'=>'a/mem.jpg','visibility'=>'member','approved'=>1]);
$ins('media', ['id'=>'33333333-3333-3333-3333-333333333333','person_id'=>'kid1','path'=>'a/kid.jpg','visibility'=>'member','approved'=>1]);
$ins('media', ['id'=>'44444444-4444-4444-4444-444444444444','person_id'=>'anc1','path'=>'a/pend.jpg','visibility'=>'public','approved'=>0]);
// Photos of somebody who exists ONLY in the seed file (data/lineage.js). There
// is deliberately no persons row for 'seed_only' — that is the whole point.
$ins('media', ['id'=>'55555555-5555-5555-5555-555555555555','person_id'=>'seed_only','path'=>'a/seed.jpg','visibility'=>'public','approved'=>1]);
$ins('media', ['id'=>'66666666-6666-6666-6666-666666666666','person_id'=>'seed_only','path'=>'a/seedm.jpg','visibility'=>'member','approved'=>1]);

$anon     = Viewer::anonymous();
$member   = new Viewer(userId: 'u1', isAdmin: false, isApproved: false, personId: null);
$approved = new Viewer(userId: 'u2', isAdmin: false, isApproved: true,  personId: 'mem1');
$admin    = new Viewer(userId: 'u3', isAdmin: true,  isApproved: true,  personId: null);

// ---- harness ---------------------------------------------------------------
$pass = 0; $fail = 0;
function check(string $what, $got, $want) {
    global $pass, $fail;
    $ok = $got === $want;
    $ok ? $pass++ : $fail++;
    printf("  %s %-58s %s\n", $ok ? 'ok  ' : 'FAIL', $what,
        $ok ? '' : '(got ' . var_export($got, true) . ', want ' . var_export($want, true) . ')');
}
$ids = fn(array $rows) => array_map(fn($r) => $r['id'], $rows);
/**
 * Ids whose CONTENT came back, ignoring archive tombstones. An archived person
 * is announced to everyone as a bare {id, archived} so the client can remove
 * their twin from the public seed — see repo_persons() — but nothing about them
 * is disclosed, so they are not "seen" in the sense these checks mean.
 */
$visible = fn(array $rows) => array_map(fn($r) => $r['id'],
    array_filter($rows, fn($r) => empty($r['archived'])));
$tomb = fn(array $rows) => array_values(array_filter($rows, fn($r) => !empty($r['archived'])));

echo "\nPEOPLE\n";
check('anon sees the ancestors AND the living adult', $visible(repo_persons($anon)),   ['anc1','anc2','mem1','mem2']);
check('anon still never sees the minor',          in_array('kid1', $ids(repo_persons($anon)), true), false);

// The living adult reaches a signed-out visitor by NAME and TREE POSITION only.
// Anything that would locate or describe them must come back empty, or this
// path has quietly become a way to read member-tier data without signing in.
$anonMem = array_values(array_filter(repo_persons($anon), fn($r) => $r['id'] === 'mem1'))[0];
check('anon gets the living adult\'s name',       $anonMem['name'],            'Living Relative');
check('anon gets their tree position',            $anonMem['gen'],             26);
foreach (['birth_year','bio','birth_place','residence_place','burial_place','lat','lng','relation'] as $blocked) {
    check("anon gets no {$blocked} for a living adult", $anonMem[$blocked] ?? null, null);
}
check('member also sees the living relative',     $visible(repo_persons($member)),   ['anc1','anc2','mem1','mem2']);
check('member never sees the minor',              in_array('kid1', $ids(repo_persons($member)), true), false);
check('approved member still never sees a minor', in_array('kid1', $ids(repo_persons($approved)), true), false);
check('admin sees the minor',                     in_array('kid1', $ids(repo_persons($admin)), true), true);
check('anon learns nothing about an archived person', in_array('arc1', $visible(repo_persons($anon)), true), false);
check('admin sees the archived person',           in_array('arc1', $ids(repo_persons($admin)), true), true);

// An archived person must still be ANNOUNCED, or their twin in the public
// 519-person seed stays in the tree and the removal silently undoes itself.
// This is the bug a reviewer hit after the cutover: duplicates she had already
// archived came back. What may NOT travel with the announcement is anything
// about them.
$t = $tomb(repo_persons($anon));
check('an archived person is still announced to anon', count($t), 1);
check('  …by id, so the seed twin can be dropped', $t[0]['id'] ?? null, 'arc1');
check('  …carrying nothing but the flag', array_keys($t[0]), ['id', 'archived']);
check('  …and no name',                   isset($t[0]['name']), false);
check('a member gets the same announcement',
      array_map(fn($r) => $r['id'], $tomb(repo_persons($member))), ['arc1']);
check("an admin's own rows already carry the flag, so no tombstone is added",
      count($tomb(repo_persons($admin))), 1);   // the real row, not a stub
check('  …and it is the full row, not a stub', isset($tomb(repo_persons($admin))[0]['name']), true);

echo "\nDETAIL (birth year, bio)\n";
$memRow = fn(array $rows) => array_values(array_filter($rows, fn($r) => $r['id'] === 'mem1'))[0] ?? null;
check('unapproved member gets no birth year',     $memRow(repo_persons($member))['birth_year'] ?? null, null);
check('approved member does',                     $memRow(repo_persons($approved))['birth_year'] ?? null, '1980');
check('admin does',                               $memRow(repo_persons($admin))['birth_year'] ?? null, '1980');

echo "\nCONTACTS\n";
check('anon refused',                             repo_contact($anon, 'mem1'), null);
check('another member refused',                   repo_contact($member, 'mem1'), null);
check('the person themselves allowed',            repo_contact($approved, 'mem1')['phone'] ?? null, '+60 12 000 0000');
check('admin allowed',                            repo_contact($admin, 'mem1')['phone'] ?? null, '+60 12 000 0000');

// THE SET, not just the single lookup. repo_contact() was correct and fully
// tested, and nothing outside these tests ever called it — the tree endpoint
// returned no contacts at all, so the family directory was missing from the
// site while this section stayed green. Assert what a VIEWER RECEIVES.
$contactIds = fn(array $rows) => array_map(fn($r) => $r['person_id'], $rows);
check('an admin receives every contact',      count(repo_contacts($admin)), 1);
check('  …and it is the right person',        $contactIds(repo_contacts($admin)), ['mem1']);
check('the person themselves receives theirs', $contactIds(repo_contacts($approved)), ['mem1']);
check('another member receives none',          repo_contacts($member), []);
check('a signed-out visitor receives none',    repo_contacts($anon), []);
check('  …and the phone number is really in there',
      repo_contacts($admin)[0]['phone'] ?? null, '+60 12 000 0000');

echo "\nPHOTOS — the leak that started this\n";
$photo = fn(string $id) => q1(
    'SELECT m.id, m.path, m.visibility, m.approved, COALESCE(p.is_minor,0) AS subject_is_minor
       FROM media m LEFT JOIN persons p ON p.id = m.person_id WHERE m.id = ?', [$id]);
$pub = $photo('11111111-1111-1111-1111-111111111111');
$mem = $photo('22222222-2222-2222-2222-222222222222');
$kid = $photo('33333333-3333-3333-3333-333333333333');
$pen = $photo('44444444-4444-4444-4444-444444444444');
check('anon may fetch a public photo',            Visibility::maySeePhoto($anon, $pub), true);
check('anon may NOT fetch a member photo',        Visibility::maySeePhoto($anon, $mem), false);
check('member may fetch a member photo',          Visibility::maySeePhoto($member, $mem), true);
check("nobody but an admin fetches a minor's",    Visibility::maySeePhoto($approved, $kid), false);
check('admin may fetch a minor photo',            Visibility::maySeePhoto($admin, $kid), true);
check('unapproved upload hidden from anon',       Visibility::maySeePhoto($anon, $pen), false);
check('unapproved upload visible to admin',       Visibility::maySeePhoto($admin, $pen), true);
check('anon media list carries no member photo',  in_array('22222222-2222-2222-2222-222222222222', $ids(repo_media($anon)), true), false);
check('member media list does',                   in_array('22222222-2222-2222-2222-222222222222', $ids(repo_media($member)), true), true);
check('media list never carries a URL',           array_key_exists('path', repo_media($member)[0] ?? []), false);

echo "\nDEPLOY-DAY SWITCH\n";
$GLOBALS['ZUPU_CONFIG']['enforce_approval'] = false;
check('permissive: unapproved member gets detail', $memRow(repo_persons($member))['birth_year'] ?? null, '1980');
check('permissive still hides minors from members', in_array('kid1', $ids(repo_persons($member)), true), false);
check('permissive does not widen what anon sees',  $visible(repo_persons($anon)), ['anc1','anc2','mem1','mem2']);
check('permissive still hides minors from anon',  in_array('kid1', $ids(repo_persons($anon)), true), false);
check('the grace was logged',
    (int)q1("SELECT COUNT(*) c FROM access_log WHERE verdict = 'would_refuse'")['c'] > 0, true);
$GLOBALS['ZUPU_CONFIG']['enforce_approval'] = true;

echo "\nMAGIC LINK\n";
$url = auth_issue_token('relative@example.com', '127.0.0.1');
parse_str((string)parse_url($url, PHP_URL_QUERY), $qs);
$token = $qs['t'] ?? '';
check('token is 64 hex chars',                    (bool)preg_match('/^[0-9a-f]{64}$/', $token), true);
check('only the hash is stored',
    (int)q1('SELECT COUNT(*) c FROM login_tokens WHERE token_hash = ?', [$token])['c'], 0);
check('the hash IS stored',
    (int)q1('SELECT COUNT(*) c FROM login_tokens WHERE token_hash = ?', [hash('sha256', $token)])['c'], 1);
check('it verifies once',                         auth_consume_token($token), 'relative@example.com');
check('and not twice',                            auth_consume_token($token), null);
check('a forged token is refused',                auth_consume_token(str_repeat('a', 64)), null);
check('a malformed token is refused',             auth_consume_token('../etc/passwd'), null);

q('UPDATE login_tokens SET expires_at = ? WHERE email = ?', [gmdate('Y-m-d H:i:s', time() - 60), 'old@example.com']);
$expiredUrl = auth_issue_token('old@example.com', '127.0.0.1');
parse_str((string)parse_url($expiredUrl, PHP_URL_QUERY), $q2);
q('UPDATE login_tokens SET expires_at = ? WHERE token_hash = ?',
  [gmdate('Y-m-d H:i:s', time() - 60), hash('sha256', $q2['t'])]);
check('an expired token is refused',              auth_consume_token($q2['t']), null);

echo "\nRATE LIMIT\n";
for ($i = 0; $i < 6; $i++) { @auth_issue_token('flood@example.com', '10.0.0.9'); }
check('a flooded address is throttled',           auth_rate_ok('flood@example.com', '10.0.0.9'), false);
check('an untouched address is not',              auth_rate_ok('fresh@example.com', '10.0.0.10'), true);

echo "\nPHOTOS OF SEED-ONLY ANCESTORS\n";
// The tree is the 519-person seed in data/lineage.js merged with the rows in
// this table, so a photo of a deceased ancestor points at an id no persons row
// has. A LEFT JOIN makes every subject test NULL, and the row used to disappear
// for everyone but an admin — while photo.php served the same file happily,
// because it COALESCEs the missing subject. The live Supabase site shows these
// photos; hiding them here was a regression, and an invisible-but-downloadable
// photo is the worst of both worlds.
$seedIds = $ids(repo_media($anon));
check('a public photo of a seed ancestor reaches anon',
      in_array('55555555-5555-5555-5555-555555555555', $seedIds, true), true);
check('  …and the member-tier one beside it does NOT',
      in_array('66666666-6666-6666-6666-666666666666', $seedIds, true), false);
check('a signed-in member does get that member-tier one',
      in_array('66666666-6666-6666-6666-666666666666', $ids(repo_media($member)), true), true);
// The fallback must not become a way to publish anything by pointing it at a
// person who does not exist: tier and approval still decide.
check('an unapproved photo is still admin-only, subject or no subject',
      in_array('44444444-4444-4444-4444-444444444444', $seedIds, true), false);

// ---------------------------------------------------------------------------
echo "\nA DECEASED ANCESTOR'S DATES REACH THOSE WHO MAY SEE THEM\n";

// THE BUG THIS EXISTS FOR. These five columns were absent from the select, so
// the data was invisible to EVERYONE including admins — while every privacy
// check still passed, because "nobody sees detail" satisfies "a stranger sees
// no detail". Assert the PERMISSION, not only the refusal.
$anc = fn(array $rows) => array_values(array_filter($rows, fn($r) => ($r['id'] ?? '') === 'anc2'))[0] ?? null;

$a = $anc(repo_persons($admin));
check('an admin gets the ancestor row',        $a !== null, true);
check('  …with the birth year',                $a['birth_year'] ?? null, '宋嘉定十一年');
check('  …the death year',                     $a['death_year'] ?? null, '德祐元年');
check('  …the lifespan',                       $a['lifespan'] ?? null, '享壽五十八');
check('  …the religion',                       $a['religion'] ?? null, '儒');
check('  …and the biography',                  $a['bio'] ?? null, '登宋咸淳進士，累官尚書。');
check('  …and the birthplace',                 $a['birth_place'] ?? null, 'p_ninghua');

$m = $anc(repo_persons($member));
check('an approved member sees them too',      $m['birth_year'] ?? null, '宋嘉定十一年');

// A deceased ancestor is public record — data/lineage.js publishes exactly
// these fields to the world — so a signed-out visitor sees them as well.
$n = $anc(repo_persons($anon));
check('a signed-out visitor sees them as well', $n['birth_year'] ?? null, '宋嘉定十一年');
check('  …and the biography',                   $n['bio'] ?? null, '登宋咸淳進士，累官尚書。');

// The LIVING are the opposite case and must not have moved.
$lv = array_values(array_filter(repo_persons($anon), fn($r) => ($r['id'] ?? '') === 'mem1'))[0] ?? null;
check('a LIVING person still yields no birth year to anon', $lv['birth_year'] ?? null, null);
check('  …no bio either',                                   $lv['bio'] ?? null, null);
check('a minor is still absent entirely',
      in_array('kid1', array_map(fn($r) => $r['id'], repo_persons($anon)), true), false);

echo "\nA LIVING PERSON'S DETAIL ON THE ROW ITSELF (GORDON'S SHAPE)\n";
$g = fn(array $rows) => array_values(array_filter($rows, fn($r) => ($r['id'] ?? '') === 'mem2'))[0] ?? null;
check('an admin gets the row-only birth year',     $g(repo_persons($admin))['birth_year'] ?? null, '1975');
check('  …and the row-only bio',                   $g(repo_persons($admin))['bio'] ?? null, 'row-only bio');
check('an approved member gets it too',            $g(repo_persons($approved))['birth_year'] ?? null, '1975');
check('an UNAPPROVED member does not',             $g(repo_persons($member))['birth_year'] ?? null, null);
check('a stranger sees the person but no detail',  $g(repo_persons($anon)) !== null, true);
check('  …no birth year',                          $g(repo_persons($anon))['birth_year'] ?? null, null);
check('  …no bio',                                 $g(repo_persons($anon))['bio'] ?? null, null);
check('person_details still overrides the row',
      (array_values(array_filter(repo_persons($admin), fn($r)=>($r['id']??'')==='mem1'))[0]['bio'] ?? null), 'private detail');

printf("\n%d passed, %d failed\n", $pass, $fail);
@unlink($dbFile);
exit($fail === 0 ? 0 : 1);
