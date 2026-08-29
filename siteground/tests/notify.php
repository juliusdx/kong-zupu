<?php
/**
 * Contributor notifications — the message, not the sending.
 *
 * notify_contributor_build() is pure by design, so everything that decides
 * what a relative reads can be asserted here without a mail server in the
 * loop. The one thing these tests deliberately do NOT do is send: mail_send()
 * is the endpoint's job, exactly as it is for the magic link.
 *
 *   php tests/notify.php
 */
declare(strict_types=1);

$dbFile = sys_get_temp_dir() . '/zupu_notify_' . getmypid() . '.db';
@unlink($dbFile);

$GLOBALS['ZUPU_CONFIG'] = [
    'db'               => ['driver' => 'sqlite', 'path' => $dbFile],
    'media_root'       => sys_get_temp_dir() . '/zupu_notify_media',
    'site_url'         => 'https://zupu.test',
    'secure_cookies'   => false,
    'enforce_approval' => true,
    'mail'             => ['from' => 't@test.local', 'from_name' => 'test'],
];
require_once __DIR__ . '/../lib/contributions.php';
require_once __DIR__ . '/../lib/notify.php';
db()->exec(file_get_contents(__DIR__ . '/../sql/schema.sqlite.sql'));

q("INSERT INTO users (id,email,full_name,is_admin,approved) VALUES
   ('u1','keeper@test.local','Julius Kong',1,1),
   ('u2','cousin@test.local','',0,1)");
q("INSERT INTO persons (id,name,gen,visibility) VALUES ('a03','十八郎',3,'public')");

$pass = 0; $fail = 0;
function section(string $s) { echo "\n" . strtoupper($s) . "\n"; }
function check(string $what, $got, $want) {
    global $pass, $fail;
    $ok = $got === $want;
    $ok ? $pass++ : $fail++;
    printf("  %-4s %-58s%s\n", $ok ? 'ok' : 'FAIL', $what,
        $ok ? '' : ' got ' . json_encode($got) . ' want ' . json_encode($want));
}
/** Put a contribution in the table directly, so each test picks its own shape. */
function contrib(array $payload, ?string $submittedBy = null): string {
    $id = bin2hex(random_bytes(8));
    q('INSERT INTO contributions (id,payload,status,submitted_by) VALUES (?,?,?,?)',
      [$id, json_encode($payload, JSON_UNESCAPED_UNICODE), 'pending', $submittedBy]);
    return $id;
}

// ---------------------------------------------------------------------------
section('who the note goes to');

$c = contrib(['action'=>'add_child','submitterEmail'=>'typed@example.com'], 'u2');
check('the address typed in the form wins over the account',
      notify_contributor_build($c, 'approved')['to'], 'typed@example.com');

$c = contrib(['action'=>'add_child'], 'u2');
check('falls back to the submitting account',
      notify_contributor_build($c, 'approved')['to'], 'cousin@test.local');

$c = contrib(['action'=>'add_child','contributorContact'=>'call me on 012-333 or anon@example.org thanks']);
check('digs an address out of the free-text contact field',
      notify_contributor_build($c, 'approved')['to'], 'anon@example.org');

$c = contrib(['action'=>'edit','personEmail'=>'subject@example.net']);
check("last resort is the subject's own address",
      notify_contributor_build($c, 'approved')['to'], 'subject@example.net');

$c = contrib(['action'=>'add_child','contributorContact'=>'just a phone 012-3456']);
check('no address at all yields no message, not an error',
      notify_contributor_build($c, 'approved'), null);

$c = contrib(['action'=>'add_child','submitterEmail'=>'not-an-address']);
check('a malformed address is refused rather than mailed',
      notify_contributor_build($c, 'approved'), null);

check('an unknown contribution yields nothing',
      notify_contributor_build('nope', 'approved'), null);

// ---------------------------------------------------------------------------
section('what it says');

$c = contrib(['action'=>'add_child','submitterEmail'=>'a@b.co'], 'u1');
$m = notify_contributor_build($c, 'approved');
check('subject names the action in both languages',
      str_contains($m['subject'], '新增家族成員') && str_contains($m['subject'], 'new family member'), true);
check('approved subject says approved',   str_contains($m['subject'], 'approved'), true);
check('the account holder is greeted by name', str_contains($m['html'], 'Julius Kong'), true);
check('both language sections are present',
      str_contains($m['html'], '加入族譜') && str_contains($m['html'], 'added to the family tree'), true);
check('links back to the site', str_contains($m['html'], 'https://zupu.test'), true);

$m = notify_contributor_build($c, 'rejected', 'Duplicate of an existing entry.');
check('rejected subject does not claim approval', str_contains($m['subject'], 'approved'), false);
check('rejection carries the reviewer note', str_contains($m['html'], 'Duplicate of an existing entry.'), true);
check('rejection says so in Chinese too', str_contains($m['html'], '暫未通過'), true);

$m = notify_contributor_build($c, 'rejected');
check('no reason given means no note block', str_contains($m['html'], '審核備註'), false);

$c = contrib(['action'=>'add_child','submitterEmail'=>'a@b.co','contributor'=>'表妹']);
check('an anonymous submitter is greeted by the name they gave',
      str_contains(notify_contributor_build($c, 'approved')['html'], '表妹'), true);

$c = contrib(['action'=>'weird_action','submitterEmail'=>'a@b.co']);
check('an unknown action degrades to a generic label',
      str_contains(notify_contributor_build($c, 'approved')['subject'], 'submission'), true);

// ---------------------------------------------------------------------------
section('the change table');

$c = contrib(['action'=>'edit','submitterEmail'=>'a@b.co','changes'=>[
    ['field'=>'name','label'=>'Name','from'=>'大信','to'=>'大信公'],
    ['field'=>'bio','label'=>'Biography','from'=>'','to'=>'A teacher at 李朗'],
]]);
$m = notify_contributor_build($c, 'approved');
check('the diff shows the old and new value', str_contains($m['html'], '大信公'), true);
check('a field gets its Chinese label alongside the English', str_contains($m['html'], '姓名 / Name'), true);
check('an empty side renders as a dash rather than blank', str_contains($m['html'], '>—<'), true);
check('the table is built once per language',
      substr_count($m['html'], '<table'), 2);

$c = contrib(['action'=>'edit','submitterEmail'=>'a@b.co']);
check('no changes means no table at all',
      str_contains(notify_contributor_build($c, 'approved')['html'], '<table'), false);

// ---------------------------------------------------------------------------
section('a contribution is not a place to inject html');

$c = contrib(['action'=>'edit','submitterEmail'=>'a@b.co','contributor'=>'<script>alert(1)</script>',
              'changes'=>[['field'=>'bio','label'=>'<img src=x onerror=1>','from'=>'a','to'=>'<b>bold</b>']]]);
$m = notify_contributor_build($c, 'approved');
check('a script tag in the contributor name is escaped',
      str_contains($m['html'], '<script>'), false);
check('markup in a submitted value is escaped',
      str_contains($m['html'], '<b>bold</b>'), false);
check('...and survives as visible text',
      str_contains($m['html'], '&lt;b&gt;bold&lt;/b&gt;'), true);
check('a crafted field label cannot open a tag',
      str_contains($m['html'], '<img src=x'), false);

$m = notify_contributor_build($c, 'rejected', '<script>alert(2)</script>');
check('nor can the rejection reason', str_contains($m['html'], '<script>'), false);

echo "\n{$pass} passed, {$fail} failed\n";
@unlink($dbFile);
exit($fail ? 1 : 0);
