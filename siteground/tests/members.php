<?php
/**
 * The members panel: who may read the roster, and the refusals that stop an
 * admin locking themselves — or the whole family — out of it.
 *
 *   php tests/members.php
 */
declare(strict_types=1);

$dbFile = sys_get_temp_dir() . '/zupu_members_' . getmypid() . '.db';
@unlink($dbFile);

$GLOBALS['ZUPU_CONFIG'] = [
    'db'               => ['driver' => 'sqlite', 'path' => $dbFile],
    'media_root'       => sys_get_temp_dir() . '/zupu_members_media',
    'site_url'         => 'https://test.local',
    'secure_cookies'   => false,
    'enforce_approval' => true,
    'mail'             => ['from' => 't@test.local', 'from_name' => 'test'],
];
require_once __DIR__ . '/../lib/members.php';

db()->exec(file_get_contents(__DIR__ . '/../sql/schema.sqlite.sql'));

q("INSERT INTO users (id,email,full_name,is_admin,approved,created_at) VALUES
   ('u-keeper','keeper@test.local','The Keeper',1,1,'2026-01-01 00:00:00'),
   ('u-second','second@test.local','Second Reviewer',0,1,'2026-02-01 00:00:00'),
   ('u-new','newcousin@test.local','New Cousin',0,0,'2026-03-01 00:00:00')");

$keeper = new Viewer(userId: 'u-keeper', isAdmin: true,  isApproved: true);
$plain  = new Viewer(userId: 'u-new',    isAdmin: false, isApproved: false);
$anon   = Viewer::anonymous();

$pass = 0; $fail = 0;
function check(string $what, $got, $want) {
    global $pass, $fail;
    $ok = $got === $want; $ok ? $pass++ : $fail++;
    printf("  %s %-60s %s\n", $ok ? 'ok  ' : 'FAIL', $what,
        $ok ? '' : '(got ' . var_export($got, true) . ', want ' . var_export($want, true) . ')');
}
/** Run $fn and report the MemberError it raises, or null if it did not. */
function refused(callable $fn): ?array {
    try { $fn(); return null; }
    catch (MemberError $e) { return ['status' => $e->status, 'msg' => $e->getMessage()]; }
}
$flag = fn(string $id, string $col) => (int)q1("SELECT {$col} AS v FROM users WHERE id = ?", [$id])['v'];

echo "\nWHO MAY READ THE ROSTER\n";
check('an admin sees every account', count(members_list($keeper)), 3);
check('  …newest first',             members_list($keeper)[0]['id'], 'u-new');
check('  …with the flags as booleans, not "0"',
      members_list($keeper)[0]['approved'], false);
check('a signed-in member may not',  refused(fn() => members_list($plain))['status'] ?? null, 403);
check('nor may a stranger',          refused(fn() => members_list($anon))['status'] ?? null, 403);

// The roster is the family's address book — the refusal above is the only thing
// between a signed-in relative and everyone's email address.
$emails = array_column(members_list($keeper), 'email');
check('the roster does carry addresses, which is why it is gated',
      in_array('newcousin@test.local', $emails, true), true);

echo "\nAPPROVING\n";
check('an admin approves a new cousin', member_set_approved($keeper, 'u-new', true)['approved'], true);
check('  …and the row changed',         $flag('u-new', 'approved'), 1);
check('approval can be withdrawn',      member_set_approved($keeper, 'u-new', false)['approved'], false);
check('  …and that changed too',        $flag('u-new', 'approved'), 0);
check('a member cannot approve themselves',
      refused(fn() => member_set_approved($plain, 'u-new', true))['status'] ?? null, 403);
check('  …and the row did not move',    $flag('u-new', 'approved'), 0);
check('an unknown member is a 404',     refused(fn() => member_set_approved($keeper, 'nobody', true))['status'] ?? null, 404);

echo "\nAN ADMIN IS ALWAYS AN APPROVED MEMBER\n";
$r = refused(fn() => member_set_approved($keeper, 'u-keeper', false));
check('un-approving an admin is refused', $r['status'] ?? null, 409);
check('  …and says how to do it properly', str_contains($r['msg'] ?? '', 'reviewer rights'), true);
check('  …leaving them approved',          $flag('u-keeper', 'approved'), 1);

echo "\nREVIEWER RIGHTS\n";
check('promoting also approves', member_set_admin($keeper, 'u-new', true)['isAdmin'], true);
check('  …is_admin set',         $flag('u-new', 'is_admin'), 1);
check('  …approved along with it, or they would review a tree that hides from them',
      $flag('u-new', 'approved'), 1);
check('a non-admin cannot promote anyone',
      refused(fn() => member_set_admin($plain, 'u-second', true))['status'] ?? null, 403);

echo "\nTHE TWO LOCKED DOORS\n";
$r = refused(fn() => member_set_admin($keeper, 'u-keeper', false));
check('an admin cannot demote themselves', $r['status'] ?? null, 409);
check('  …and keeps their rights',         $flag('u-keeper', 'is_admin'), 1);

// u-new is an admin now, so demoting them is allowed: someone else remains.
check('another admin may be demoted', member_set_admin($keeper, 'u-new', false)['isAdmin'], false);
check('  …and loses the rights',      $flag('u-new', 'is_admin'), 0);
check('  …but stays an approved member', $flag('u-new', 'approved'), 1);

// Now the keeper is the only admin left. Demotion by anyone must fail — the
// self-demotion rule alone would not catch a second admin doing it.
$other = new Viewer(userId: 'u-second', isAdmin: true, isApproved: true);
$r = refused(fn() => member_set_admin($other, 'u-keeper', false));
check('the last reviewer cannot be demoted, even by someone else', $r['status'] ?? null, 409);
check('  …and says why',      str_contains($r['msg'] ?? '', 'last reviewer'), true);
check('  …so the panel stays reachable', $flag('u-keeper', 'is_admin'), 1);

echo "\nIT IS WRITTEN DOWN\n";
$actions = array_column(q('SELECT verdict FROM access_log ORDER BY id')->fetchAll(), 'verdict');
check('approvals are logged',  in_array('member_approved', $actions, true), true);
check('promotions are logged', in_array('member_promoted', $actions, true), true);
check('refusals are logged',   in_array('refused', $actions, true), true);

@unlink($dbFile);
printf("\n%d passed, %d failed\n", $pass, $fail);
exit($fail === 0 ? 0 : 1);
