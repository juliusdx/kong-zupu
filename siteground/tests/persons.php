<?php
/**
 * Direct edits to a person: verify, archive, restore, and the seed problem.
 *
 * The case worth the most attention is materialising somebody who exists only
 * in the public seed. The caller supplies that snapshot, so these tests exist
 * mainly to prove what the server refuses to take from it.
 *
 *   php tests/persons.php
 */
declare(strict_types=1);

$dbFile = sys_get_temp_dir() . '/zupu_persons_' . getmypid() . '.db';
@unlink($dbFile);

$GLOBALS['ZUPU_CONFIG'] = [
    'db'               => ['driver' => 'sqlite', 'path' => $dbFile],
    'media_root'       => sys_get_temp_dir() . '/zupu_persons_media',
    'site_url'         => 'https://test.local',
    'secure_cookies'   => false,
    'enforce_approval' => true,
    'mail'             => ['from' => 't@test.local', 'from_name' => 'test'],
];
require_once __DIR__ . '/../lib/persons.php';
db()->exec(file_get_contents(__DIR__ . '/../sql/schema.sqlite.sql'));

q("INSERT INTO users (id,email,full_name,is_admin,approved) VALUES
   ('u1','keeper@test.local','Julius Kong',1,1), ('u2','cousin@test.local','Cousin',0,1)");
q("INSERT INTO persons (id,name,gen,visibility,confidence) VALUES ('live1','有一個',20,'public','low')");
q("INSERT INTO persons (id,name,gen,visibility,living,is_minor) VALUES ('kid1','A Minor',27,'member',1,1)");

$admin  = new Viewer(userId:'u1', isAdmin:true,  isApproved:true);
$member = new Viewer(userId:'u2', isAdmin:false, isApproved:true);
$anon   = Viewer::anonymous();

$pass = 0; $fail = 0;
function section(string $s) { echo "\n" . strtoupper($s) . "\n"; }
function check(string $what, $got, $want) {
    global $pass, $fail;
    $ok = $got === $want;
    $ok ? $pass++ : $fail++;
    printf("  %-4s %-58s%s\n", $ok ? 'ok' : 'FAIL', $what,
        $ok ? '' : ' got ' . json_encode($got) . ' want ' . json_encode($want));
}
function refused(callable $fn): string {
    try { $fn(); return 'allowed'; }
    catch (PersonError $e) { return 'refused ' . $e->status; }
    catch (Throwable $e) { return 'threw'; }
}
$row = fn(string $id) => q1('SELECT * FROM persons WHERE id = ?', [$id]);
/** A person as the public seed has them — what the browser would post. */
$seed = ['name' => '起濟公', 'gen' => 18, 'pinyin' => 'Qiji', 'gender' => 'm',
         'father_id' => 'a17', 'confidence' => 'low'];

// ---------------------------------------------------------------------------
section('who may edit at all');
check('a member may not edit',   refused(fn() => person_write($member, 'live1', ['confidence' => 'high'])), 'refused 403');
check('a stranger may not edit', refused(fn() => person_write($anon, 'live1', ['confidence' => 'high'])), 'refused 403');
check('a member may not archive', refused(fn() => person_archive($member, 'live1', null)), 'refused 403');
check('a member may not restore', refused(fn() => person_restore($member, 'live1')), 'refused 403');
check('a member may not list the archived', refused(fn() => person_archived_list($member)), 'refused 403');
check('the refusal is logged',
      (int)q1("SELECT COUNT(*) c FROM access_log WHERE verdict='refused'")['c'] > 0, true);

// ---------------------------------------------------------------------------
section('marking an existing person verified');
$r = person_write($admin, 'live1', ['confidence' => 'high']);
check('the flag is written',      $row('live1')['confidence'], 'high');
check('no row was created',       $r['created'], false);
check('nothing else moved',       $row('live1')['name'], '有一個');

// ---------------------------------------------------------------------------
section('a person who exists only in the public seed');
$r = person_write($admin, 'a18_qiji', ['confidence' => 'high'], $seed);
check('the row is created on demand', $r['created'], true);
check('  …carrying the seed name',   $row('a18_qiji')['name'], '起濟公');
check('  …and the tree position',    (int)$row('a18_qiji')['gen'], 18);
check('  …with the edit applied',    $row('a18_qiji')['confidence'], 'high');
check('  …marked as coming from the seed', $row('a18_qiji')['source'], 'seed');
check('a second edit does not create again',
      person_write($admin, 'a18_qiji', ['pinyin' => 'Qi Ji'])['created'], false);
check('no seed and no row is a refusal, not an empty person',
      refused(fn() => person_write($admin, 'ghost', ['confidence' => 'high'])), 'refused 404');

// ---------------------------------------------------------------------------
section('a forged seed cannot smuggle anyone into public view');
$forged = ['name' => 'A Living Relative', 'gen' => 27,
           'living' => 1, 'is_minor' => 1, 'visibility' => 'public', 'source' => 'contribution'];
person_write($admin, 'forged1', ['confidence' => 'low'], $forged);
$f = $row('forged1');
check('living is asserted, not accepted',   (int)$f['living'], 0);
check('is_minor is asserted, not accepted', (int)$f['is_minor'], 0);
check('visibility is forced to public',     $f['visibility'], 'public');
check('the descriptive part is still taken', $f['name'], 'A Living Relative');

section('and the editable path still refuses nonsense');
check('an unknown visibility is refused',
      refused(fn() => person_write($admin, 'live1', ['visibility' => 'everyone'])), 'refused 400');
check('an empty change set is refused',
      refused(fn() => person_write($admin, 'live1', [])), 'refused 400');
check('a column not on the list is ignored',
      refused(fn() => person_write($admin, 'live1', ['archived' => 1])), 'refused 400');
check('  …and did not archive anything', (int)$row('live1')['archived'], 0);

// ---------------------------------------------------------------------------
section('archiving and restoring');
$a = person_archive($admin, 'live1', 'duplicate of 有二個');
check('the flag is set',            (int)$row('live1')['archived'], 1);
check('the reason is kept',         $row('live1')['archived_reason'], 'duplicate of 有二個');
check('who did it is kept',         $row('live1')['archived_by'], 'u1');
check('when is kept',               $row('live1')['archived_at'] !== null, true);
check('the content is untouched',   $row('live1')['name'], '有一個');

$list = person_archived_list($admin);
check('it appears in the archived list', count($list), 1);
check('  …named by the person who archived it', $list[0]['archivedByName'], 'Julius Kong');
check('  …with the reason',                     $list[0]['archivedReason'], 'duplicate of 有二個');

// The case that started this: archiving somebody who is only in the seed.
person_archive($admin, 'n7_chengxia', 'duplicate', ['name' => '承夏', 'gen' => 20]);
check('a seed-only person can be archived', (int)$row('n7_chengxia')['archived'], 1);
check('  …which required creating the row', $row('n7_chengxia')['name'], '承夏');

person_restore($admin, 'live1');
check('restoring clears the flag',   (int)$row('live1')['archived'], 0);
check('  …and the reason',           $row('live1')['archived_reason'], null);
check('  …and who archived it',      $row('live1')['archived_by'], null);
check('the content survived the round trip', $row('live1')['name'], '有一個');
check('restoring what does not exist is refused',
      refused(fn() => person_restore($admin, 'nobody')), 'refused 404');

// ---------------------------------------------------------------------------
section('an archived person is removed from the tree, twin and all');
person_archive($admin, 'live1', null);
$anonIds  = array_map(fn($r) => $r['id'], repo_persons($anon));
$tombs    = array_values(array_filter(repo_persons($anon), fn($r) => !empty($r['archived'])));
check('anon gets no content for them',
      in_array('live1', array_map(fn($r) => $r['id'],
          array_filter(repo_persons($anon), fn($r) => empty($r['archived']))), true), false);
check('but is told they are archived', in_array('live1', array_map(fn($r) => $r['id'], $tombs), true), true);
check('the tombstone carries nothing else', array_keys($tombs[0]), ['id', 'archived']);
check('a minor is never even announced', in_array('kid1', $anonIds, true), false);

// ---------------------------------------------------------------------------
section('merging a duplicate into the person it duplicates');

q("INSERT INTO persons (id,name,gen,visibility) VALUES
   ('keep1','大信',21,'public'), ('dup1','大信 (dup)',21,'public'),
   ('kid_a','A Child',22,'public'), ('wife_a','A Wife',21,'public')");
q("UPDATE persons SET father_id='dup1' WHERE id='kid_a'");
q("UPDATE persons SET spouse_of='dup1' WHERE id='wife_a'");
q("INSERT INTO media (id,person_id,path,visibility,approved,cover) VALUES
   ('m-dup','dup1','dup/a.jpg','public',1,1)");
q("INSERT INTO person_details (person_id,bio) VALUES ('dup1','the duplicate bio')");
q("INSERT INTO contacts (person_id,email) VALUES ('dup1','dup@example.com')");

$m = person_merge($admin, 'keep1', 'dup1');
check('the child is re-parented onto the survivor', $row('kid_a')['father_id'], 'keep1');
check('the spouse follows too',                     $row('wife_a')['spouse_of'], 'keep1');
check('  …and it says how many moved',              $m['moved']['children'], 1);
check('the photo moves across',
      q1("SELECT person_id FROM media WHERE id='m-dup'")['person_id'], 'keep1');
check('  …but arrives uncovered, so there is one avatar',
      (int)q1("SELECT cover FROM media WHERE id='m-dup'")['cover'], 0);
check('the private detail moves',
      q1("SELECT person_id FROM person_details WHERE bio='the duplicate bio'")['person_id'], 'keep1');
check('the contact moves',
      q1("SELECT person_id FROM contacts WHERE email='dup@example.com'")['person_id'], 'keep1');
check('the duplicate is archived, not deleted', (int)$row('dup1')['archived'], 1);
check('  …saying what it was merged into',
      str_contains((string)$row('dup1')['archived_reason'], 'keep1'), true);
check('  …and it still exists to be restored', $row('dup1')['name'], '大信 (dup)');

section('a survivor who already has detail keeps their own');
q("INSERT INTO persons (id,name,gen,visibility) VALUES ('keep2','有二',21,'public'), ('dup2','有二 (dup)',21,'public')");
q("INSERT INTO person_details (person_id,bio) VALUES ('keep2','the survivor own bio'), ('dup2','the loser bio')");
q("INSERT INTO contacts (person_id,email) VALUES ('keep2','keep@example.com'), ('dup2','loser@example.com')");
person_merge($admin, 'keep2', 'dup2');
check("the survivor's own bio is not overwritten",
      q1("SELECT bio FROM person_details WHERE person_id='keep2'")['bio'], 'the survivor own bio');
check("  …and the duplicate's is not destroyed either",
      q1("SELECT bio FROM person_details WHERE person_id='dup2'")['bio'], 'the loser bio');
check("the survivor's own contact survives",
      q1("SELECT email FROM contacts WHERE person_id='keep2'")['email'], 'keep@example.com');

section('merging refuses the nonsensical');
check('a member may not merge',
      refused(fn() => person_merge($member, 'keep1', 'kid_a')), 'refused 403');
check('merging somebody into themselves is refused',
      refused(fn() => person_merge($admin, 'keep1', 'keep1')), 'refused 400');
check('a missing id is refused', refused(fn() => person_merge($admin, 'keep1', '')), 'refused 400');

section('a seed-only duplicate, and seed-only children');
$m = person_merge($admin, 'keep1', 'seed_dup', [
    'dupSeed' => ['name' => '大信 seed', 'gen' => 21],
    'relink'  => [['id' => 'seed_kid', 'field' => 'father_id',
                   'seed' => ['name' => 'Seed Child', 'gen' => 22]]],
]);
check('the seed-only duplicate was created then archived', (int)$row('seed_dup')['archived'], 1);
check('the seed-only child now exists',        $row('seed_kid')['name'], 'Seed Child');
check('  …pointing at the survivor',           $row('seed_kid')['father_id'], 'keep1');
check('  …and is public, never living',        (int)$row('seed_kid')['living'], 0);

echo "\n{$pass} passed, {$fail} failed\n";
@unlink($dbFile);
exit($fail ? 1 : 0);
