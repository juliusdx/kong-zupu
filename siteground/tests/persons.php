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

echo "\n{$pass} passed, {$fail} failed\n";
@unlink($dbFile);
exit($fail ? 1 : 0);
