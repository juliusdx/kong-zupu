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
$ins('person_details', ['person_id'=>'mem1','birth_year'=>'1980','bio'=>'private detail']);
$ins('contacts', ['person_id'=>'mem1','phone'=>'+60 12 000 0000']);
$ins('places', ['id'=>'pl1','type'=>'grave','name'=>'邻浪笄子坑蛇地','visibility'=>'public']);
$ins('media', ['id'=>'11111111-1111-1111-1111-111111111111','person_id'=>'anc1','path'=>'a/pub.jpg','visibility'=>'public','approved'=>1]);
$ins('media', ['id'=>'22222222-2222-2222-2222-222222222222','person_id'=>'mem1','path'=>'a/mem.jpg','visibility'=>'member','approved'=>1]);
$ins('media', ['id'=>'33333333-3333-3333-3333-333333333333','person_id'=>'kid1','path'=>'a/kid.jpg','visibility'=>'member','approved'=>1]);
$ins('media', ['id'=>'44444444-4444-4444-4444-444444444444','person_id'=>'anc1','path'=>'a/pend.jpg','visibility'=>'public','approved'=>0]);

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

echo "\nPEOPLE\n";
check('anon sees the ancestor AND the living adult', $ids(repo_persons($anon)),   ['anc1','mem1']);
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
check('member also sees the living relative',     $ids(repo_persons($member)),   ['anc1','mem1']);
check('member never sees the minor',              in_array('kid1', $ids(repo_persons($member)), true), false);
check('approved member still never sees a minor', in_array('kid1', $ids(repo_persons($approved)), true), false);
check('admin sees the minor',                     in_array('kid1', $ids(repo_persons($admin)), true), true);
check('anon never sees an archived person',       in_array('arc1', $ids(repo_persons($anon)), true), false);
check('admin sees the archived person',           in_array('arc1', $ids(repo_persons($admin)), true), true);

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
check('permissive does not widen what anon sees',  $ids(repo_persons($anon)), ['anc1','mem1']);
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

printf("\n%d passed, %d failed\n", $pass, $fail);
@unlink($dbFile);
exit($fail === 0 ? 0 : 1);
