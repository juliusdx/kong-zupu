<?php
/**
 * Contribution tests. The write side of the privacy model, plus the specific
 * failures that have already happened on this data once.
 *
 *   php tests/contributions.php
 */
declare(strict_types=1);

$dbFile = sys_get_temp_dir() . '/zupu_contrib_' . getmypid() . '.db';
@unlink($dbFile);

$GLOBALS['ZUPU_CONFIG'] = [
    'db'               => ['driver' => 'sqlite', 'path' => $dbFile],
    'media_root'       => sys_get_temp_dir() . '/zupu_contrib_media',
    'site_url'         => 'https://test.local',
    'secure_cookies'   => false,
    'enforce_approval' => true,
    'mail'             => ['from' => 't@test.local', 'from_name' => 'test'],
];
require_once __DIR__ . '/../lib/contributions.php';
db()->exec(file_get_contents(__DIR__ . '/../sql/schema.sqlite.sql'));

$ins = function (string $t, array $row) {
    $cols = implode(',', array_keys($row));
    $qs   = implode(',', array_fill(0, count($row), '?'));
    q("INSERT INTO {$t} ({$cols}) VALUES ({$qs})", array_values($row));
};

// A slice of the real shape: an ancestor, his son, a grandson, and a living
// member whose detail lives in the second table.
$ins('persons', ['id'=>'a01','name'=>'江八郎','gen'=>1,'visibility'=>'public']);
$ins('persons', ['id'=>'a02','name'=>'江萬頃','gen'=>2,'father_id'=>'a01','visibility'=>'public']);
$ins('persons', ['id'=>'a03','name'=>'十八郎','gen'=>3,'father_id'=>'a02','visibility'=>'public']);
$ins('persons', ['id'=>'k_daxin','name'=>'大信','gen'=>21,'father_id'=>'a03','visibility'=>'public']);
$ins('persons', ['id'=>'mem1','name'=>'Living Relative','gen'=>26,'father_id'=>'k_daxin',
                 'living'=>1,'visibility'=>'member','birth_year'=>'1970','bio'=>'on the row']);
$ins('person_details', ['person_id'=>'mem1','birth_year'=>'1970','bio'=>'in the detail table']);

$admin = new Viewer(userId:'u1', isAdmin:true,  isApproved:true);
$anon  = Viewer::anonymous();
$user  = new Viewer(userId:'u2', isAdmin:false, isApproved:true);

$pass = 0; $fail = 0;
function section(string $s) { echo "\n" . strtoupper($s) . "\n"; }
function check(string $what, $got, $want) {
    global $pass, $fail;
    $ok = $got === $want;
    $ok ? $pass++ : $fail++;
    printf("  %-4s %-58s%s\n", $ok ? 'ok' : 'FAIL', $what,
        $ok ? '' : ' got ' . json_encode($got) . ' want ' . json_encode($want));
}
/** Submit as a signed-out visitor, which is how most contributions arrive. */
function submit(array $payload): string { return contribution_submit($payload, null); }
function personRow(string $id): ?array { return q1('SELECT * FROM persons WHERE id = ?', [$id]); }

// ---------------------------------------------------------------------------
section('who may decide');
$cid = submit(['action'=>'add_child','relatedTo'=>'a03','name'=>'新人']);
check('a submission lands as pending',
      q1('SELECT status FROM contributions WHERE id = ?', [$cid])['status'], 'pending');


$refused = function (Viewer $v) use ($cid) {
    try { contribution_decide($v, $cid, 'approved'); return 'allowed'; }
    catch (Throwable $e) { return 'refused'; }
};
check('anon may not approve',              $refused($anon), 'refused');
check('a signed-in non-admin may not',     $refused($user), 'refused');

// ---------------------------------------------------------------------------
section('adding a person');
$rep = contribution_decide($admin, $cid, 'approved');
$new = personRow('c_' . substr($cid, 0, 8));
check('the person exists',                 $new['name'], '新人');
check('hung on the named relative',        $new['father_id'], 'a03');
check('generation derived from the father', (int)$new['gen'], 4);
check('flagged low confidence',            $new['confidence'], 'low');
check('marked as a contribution',          $new['source'], 'contribution');
check('the contribution is approved',      q1('SELECT status FROM contributions WHERE id = ?', [$cid])['status'], 'approved');
check('and records who decided it',        q1('SELECT reviewed_by FROM contributions WHERE id = ?', [$cid])['reviewed_by'], 'u1');

// The generation is DERIVED, never taken from the form. Someone typing 99 into
// a field they misread must not float their child ninety generations away.
$cid2 = submit(['action'=>'add_child','relatedTo'=>'a03','name'=>'次子','gen'=>'99']);
contribution_decide($admin, $cid2, 'approved');
check('a typed generation is ignored',     (int)personRow('c_' . substr($cid2,0,8))['gen'], 4);

$cid3 = submit(['action'=>'add_spouse','relatedTo'=>'a03','name'=>'某氏','gender'=>'f']);
contribution_decide($admin, $cid3, 'approved');
$sp = personRow('c_' . substr($cid3,0,8));
check('a spouse sits level',               (int)$sp['gen'], 3);
check('a spouse is linked, not fathered',  [$sp['spouse_of'], $sp['father_id']], ['a03', null]);

$cid4 = submit(['action'=>'add_child','relatedTo'=>'a03','name'=>'在世','living'=>'true']);
contribution_decide($admin, $cid4, 'approved');
check('a living person is gated to member',
      personRow('c_' . substr($cid4,0,8))['visibility'], 'member');

// ---------------------------------------------------------------------------
section('the mistargeted correction');
// The form has one picker whose meaning changes with the action. Filled in as
// though adding a child, an "edit" overwrites the relative instead. This is
// exactly what turned 江八郎 into 江萬里 and 大信 into 永宏.
$bad = ['action'=>'edit','relatedTo'=>'a01','name'=>'江萬里'];
$warn = contribution_rename_warning($bad);
check('an unrelated rename is flagged',    [$warn['from'], $warn['to']], ['江八郎', '江萬里']);
check('and names the person it would hit', $warn['personId'], 'a01');

// A refinement of the same name is not a swap and must not cry wolf.
check('a longer form of the same name is not flagged',
      contribution_rename_warning(['action'=>'edit','relatedTo'=>'a03','name'=>'十八郎公']), null);
check('an unchanged name is not flagged',
      contribution_rename_warning(['action'=>'edit','relatedTo'=>'a03','name'=>'十八郎']), null);
check('adding a child is never a rename',
      contribution_rename_warning(['action'=>'add_child','relatedTo'=>'a01','name'=>'江萬里']), null);

// ---------------------------------------------------------------------------
section('correcting a person');
$cid5 = submit(['action'=>'edit','relatedTo'=>'a03','pinyin'=>'Shibalang','aka'=>'鎬']);
contribution_decide($admin, $cid5, 'approved');
check('the correction applied',            personRow('a03')['pinyin'], 'Shibalang');
check('and the other field too',           personRow('a03')['aka'], '鎬');
check('the name was left alone',           personRow('a03')['name'], '十八郎');

// Clearing. Empty values are dropped from the payload before it is stored, so
// the intent arrives as a list of names. Ten identical corrections to one birth
// year were accepted and discarded before this worked.
$cid6 = submit(['action'=>'edit','relatedTo'=>'a03','cleared'=>['aka','pinyin']]);
contribution_decide($admin, $cid6, 'approved');
check('a cleared field is nulled',         personRow('a03')['aka'], null);
check('and so is the other',               personRow('a03')['pinyin'], null);

// A field NOT named in `cleared` and absent from the payload stays as it was.
$cid7 = submit(['action'=>'edit','relatedTo'=>'k_daxin','pinyin'=>'Da Xin']);
contribution_decide($admin, $cid7, 'approved');
check('an untouched field is untouched',   personRow('k_daxin')['name'], '大信');

// Only these six may be blanked; a name may never be.
$cid8 = submit(['action'=>'edit','relatedTo'=>'k_daxin','cleared'=>['name','gender']]);
contribution_decide($admin, $cid8, 'approved');
check('a name cannot be cleared',          personRow('k_daxin')['name'], '大信');

// ---------------------------------------------------------------------------
section('the second table');
// A living member's birth year and bio live in person_details, which is merged
// ON TOP of the persons row when the tree is read. An edit that wrote only to
// persons looked like it worked and reverted on the next load.
$cid9 = submit(['action'=>'edit','relatedTo'=>'mem1','birth'=>'1971','bio'=>'corrected']);
contribution_decide($admin, $cid9, 'approved');
check('the row was updated',               personRow('mem1')['birth_year'], '1971');
check('and the detail table with it',
      q1('SELECT birth_year FROM person_details WHERE person_id = ?', ['mem1'])['birth_year'], '1971');
check('bio likewise, in both places',
      [personRow('mem1')['bio'],
       q1('SELECT bio FROM person_details WHERE person_id = ?', ['mem1'])['bio']],
      ['corrected', 'corrected']);
// And the read path agrees, which is the thing that actually reverted before.
$seen = array_values(array_filter(repo_persons($admin), fn($r) => $r['id'] === 'mem1'))[0];
check('so the tree reads back the correction', $seen['birth_year'], '1971');

$cid10 = submit(['action'=>'edit','relatedTo'=>'mem1','cleared'=>['birth','bio']]);
contribution_decide($admin, $cid10, 'approved');
check('clearing empties the detail table too',
      q1('SELECT birth_year, bio FROM person_details WHERE person_id = ?', ['mem1']),
      ['birth_year' => null, 'bio' => null]);

// ---------------------------------------------------------------------------
section('re-parenting');
$cid11 = submit(['action'=>'edit','relatedTo'=>'k_daxin','moveTo'=>'a02','moveRel'=>'child']);
contribution_decide($admin, $cid11, 'approved');
check('moved under the new father',        personRow('k_daxin')['father_id'], 'a02');
check('and takes his generation from him', (int)personRow('k_daxin')['gen'], 3);
check('the branch below moved with him',   (int)personRow('mem1')['gen'], 8);   // 26 - (21-3)

// Moving someone beneath their own descendant detaches the branch entirely.
$cid12 = submit(['action'=>'edit','relatedTo'=>'a02','moveTo'=>'mem1','moveRel'=>'child']);
$loop = 'allowed';
try { contribution_decide($admin, $cid12, 'approved'); } catch (Throwable $e) { $loop = 'refused'; }
check('a move under one\'s own descendant is refused', $loop, 'refused');
check('and nothing was half-applied',      personRow('a02')['father_id'], 'a01');
check('the contribution stays pending',
      q1('SELECT status FROM contributions WHERE id = ?', [$cid12])['status'], 'pending');

// ---------------------------------------------------------------------------
section('places');
$cid13 = submit(['action'=>'add_place','placeType'=>'grave','name'=>'黃泥夾']);
contribution_decide($admin, $cid13, 'approved');
$pl = q1('SELECT * FROM places WHERE id = ?', ['pl_' . substr($cid13,0,8)]);
check('a place with no pin is still recorded', $pl['name'], '黃泥夾');
check('and marked approximate',            (int)$pl['approximate'], 1);
check('with no invented coordinates',      [$pl['lat'], $pl['lng']], [null, null]);

$cid14 = submit(['action'=>'add_place','placeType'=>'grave','name'=>'有座標','lat'=>'5.1','lng'=>'116.2']);
contribution_decide($admin, $cid14, 'approved');
$pl2 = q1('SELECT * FROM places WHERE id = ?', ['pl_' . substr($cid14,0,8)]);
check('a pinned place is not approximate', (int)$pl2['approximate'], 0);

// ---------------------------------------------------------------------------
section('rejection and replay');
$cid15 = submit(['action'=>'add_child','relatedTo'=>'a03','name'=>'不要']);
contribution_decide($admin, $cid15, 'rejected', 'duplicate');
check('rejected keeps the reason',         q1('SELECT rejection_reason FROM contributions WHERE id = ?', [$cid15])['rejection_reason'], 'duplicate');
check('and adds nobody to the tree',       personRow('c_' . substr($cid15,0,8)), null);

$again = 'allowed';
try { contribution_decide($admin, $cid15, 'approved'); } catch (Throwable $e) { $again = 'refused'; }
check('a decided contribution cannot be decided twice', $again, 'refused');

// ---------------------------------------------------------------------------
section('contact details a contribution carried');

$cidC = submit(['action'=>'add_child','relatedTo'=>'a03','name'=>'有電話的',
                'personPhone'=>'012-3456789','personEmail'=>'reachme@example.com']);
$rep  = contribution_decide($admin, $cidC, 'approved');
$newId = $rep['applied'][0]['added'];
$c = q1('SELECT * FROM contacts WHERE person_id = ?', [$newId]);
check('the phone is saved',  $c['phone'] ?? null, '012-3456789');
check('the email is saved',  $c['email'] ?? null, 'reachme@example.com');
check('what was not given stays empty', $c['wechat'] ?? null, null);
check('and it is NOT on the person row, where members could read it',
      array_key_exists('phone', personRow($newId) ?? []), false);

$cidC2 = submit(['action'=>'add_child','relatedTo'=>'a03','name'=>'沒有電話的']);
$rep2  = contribution_decide($admin, $cidC2, 'approved');
check('a contribution with no contact fields makes no row',
      q1('SELECT person_id FROM contacts WHERE person_id = ?', [$rep2['applied'][0]['added']]), null);

// A correction that supplies only one field must not blank the others.
$cidC3 = submit(['action'=>'edit','relatedTo'=>$newId,'name'=>'有電話的',
                 'personWechat'=>'wx-handle','changes'=>[['field'=>'personWechat','from'=>'','to'=>'wx-handle']]]);
contribution_decide($admin, $cidC3, 'approved');
$c3 = q1('SELECT * FROM contacts WHERE person_id = ?', [$newId]);
check('a later correction adds the new field', $c3['wechat'] ?? null, 'wx-handle');
check('  …without blanking the phone',        $c3['phone'] ?? null, '012-3456789');

echo "\n{$pass} passed, {$fail} failed\n";
@unlink($dbFile);
exit($fail ? 1 : 0);
