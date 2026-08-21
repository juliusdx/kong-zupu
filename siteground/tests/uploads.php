<?php
/**
 * Upload tests. The other half of the photo argument: files that arrive must
 * land where no URL reaches them, under a name we chose, gated by the subject.
 *
 *   php tests/uploads.php
 */
declare(strict_types=1);
define('ZUPU_TESTING', true);          // no real POST, so skip is_uploaded_file

$dbFile = sys_get_temp_dir() . '/zupu_upload_' . getmypid() . '.db';
$root   = sys_get_temp_dir() . '/zupu_upload_media_' . getmypid();
@unlink($dbFile);
@mkdir($root, 0700, true);

$GLOBALS['ZUPU_CONFIG'] = [
    'db'               => ['driver' => 'sqlite', 'path' => $dbFile],
    'media_root'       => $root,
    'site_url'         => 'https://test.local',
    'secure_cookies'   => false,
    'enforce_approval' => true,
    'mail'             => ['from' => 't@test.local', 'from_name' => 'test'],
];
require_once __DIR__ . '/../lib/uploads.php';
db()->exec(file_get_contents(__DIR__ . '/../sql/schema.sqlite.sql'));

$ins = function (string $t, array $row) {
    $cols = implode(',', array_keys($row));
    $qs   = implode(',', array_fill(0, count($row), '?'));
    q("INSERT INTO {$t} ({$cols}) VALUES ({$qs})", array_values($row));
};
$ins('persons', ['id'=>'anc1','name'=>'江八郎','gen'=>1,'visibility'=>'public','living'=>0]);
$ins('persons', ['id'=>'mem1','name'=>'Living Relative','gen'=>26,'visibility'=>'member','living'=>1]);
$ins('persons', ['id'=>'kid1','name'=>'A Child','gen'=>27,'visibility'=>'member','living'=>1,'is_minor'=>1]);
$ins('persons', ['id'=>'arc1','name'=>'Removed','gen'=>26,'visibility'=>'public','archived'=>1]);
$ins('places',  ['id'=>'pl1','type'=>'grave','name'=>'黃泥夾']);

$admin = new Viewer(userId:'u1', isAdmin:true,  isApproved:true);
$user  = new Viewer(userId:'u2', isAdmin:false, isApproved:true);
$anon  = Viewer::anonymous();

$pass = 0; $fail = 0;
function section(string $s) { echo "\n" . strtoupper($s) . "\n"; }
function check(string $what, $got, $want) {
    global $pass, $fail;
    $ok = $got === $want; $ok ? $pass++ : $fail++;
    printf("  %-4s %-58s%s\n", $ok ? 'ok' : 'FAIL', $what,
        $ok ? '' : ' got ' . json_encode($got) . ' want ' . json_encode($want));
}
/** A real PNG on disk, since the code reads the bytes rather than the name. */
function fixture(string $name, string $kind = 'png'): array {
    $p = sys_get_temp_dir() . '/' . uniqid('up_', true);
    if ($kind === 'png')  { $im = imagecreatetruecolor(4,4); imagepng($im, $p); }
    elseif ($kind === 'jpg') { $im = imagecreatetruecolor(4,4); imagejpeg($im, $p); }
    else { file_put_contents($p, "<?php echo 'not an image';"); }
    return ['name'=>$name, 'tmp_name'=>$p, 'size'=>filesize($p), 'error'=>UPLOAD_ERR_OK];
}
function tryUpload(Viewer $v, array $file, ?string $pid, ?string $plid = null): array|string {
    try { return upload_photo($v, $file, $pid, $plid, null); }
    catch (UploadError $e) { return 'refused: ' . $e->getMessage(); }
}

// ---------------------------------------------------------------------------
section('what may be uploaded');
$r = tryUpload($user, fixture('grandfather.png'), 'anc1');
check('a real png is accepted',            is_array($r), true);
check('and is not approved yet',           $r['approved'], false);
$mediaId = $r['id'];

check('a php file named .png is refused',
      tryUpload($user, fixture('evil.png', 'php'), 'anc1'),
      'refused: That file is not a JPEG, PNG, GIF or WebP image.');
check('a jpeg is accepted',                is_array(tryUpload($user, fixture('x.jpg','jpg'), 'anc1')), true);
check('an oversized file is refused',
      tryUpload($user, ['name'=>'big.png','tmp_name'=>'/dev/null','size'=>UPLOAD_MAX_BYTES+1,'error'=>UPLOAD_ERR_OK], 'anc1'),
      'refused: Photos must be under 8 MB.');
check('a photo must have a subject',       tryUpload($user, fixture('a.png'), null, null),
      'refused: A photo belongs to either a person or a place.');
check('and not two',                       tryUpload($user, fixture('a.png'), 'anc1', 'pl1'),
      'refused: A photo belongs to either a person or a place.');
check('an unknown person is refused',      tryUpload($user, fixture('a.png'), 'nobody'), 'refused: No such person.');
check('a place photo is accepted',         is_array(tryUpload($user, fixture('grave.png'), null, 'pl1')), true);

// ---------------------------------------------------------------------------
section('who the photo is of');
check('a photo of a minor is refused outright',
      tryUpload($user, fixture('child.png'), 'kid1'), 'refused: Photos of minors are not accepted.');
check('and no file was written for them',
      count(glob($GLOBALS['ZUPU_CONFIG']['media_root'] . '/p/kid1/*') ?: []), 0);
check('a photo of a living member is member-tier',
      tryUpload($user, fixture('mum.png'), 'mem1')['visibility'], 'member');
check('a photo of a public ancestor is public',
      tryUpload($user, fixture('anc.png'), 'anc1')['visibility'], 'public');
check('a removed person takes no photos',
      tryUpload($user, fixture('x.png'), 'arc1'), 'refused: That person has been removed from the tree.');

// ---------------------------------------------------------------------------
section('where the bytes land');
$row  = q1('SELECT path FROM media WHERE id = ?', [$mediaId]);
$full = $GLOBALS['ZUPU_CONFIG']['media_root'] . '/' . $row['path'];
check('the file exists on disk',           is_file($full), true);
check('inside the media root',             str_starts_with(realpath($full), realpath($GLOBALS['ZUPU_CONFIG']['media_root'])), true);
check('not readable by group or other',    substr(sprintf('%o', fileperms($full)), -3), '600');

// The uploader's filename never becomes the path.
$nasty = tryUpload($user, fixture('../../../../etc/passwd.png'), 'anc1');
check('a traversing filename still lands inside the root',
      str_starts_with(realpath($GLOBALS['ZUPU_CONFIG']['media_root'] . '/' . q1('SELECT path FROM media WHERE id = ?', [$nasty['id']])['path']),
                      realpath($GLOBALS['ZUPU_CONFIG']['media_root'])), true);
check('and the path has no traversal in it',
      str_contains(q1('SELECT path FROM media WHERE id = ?', [$nasty['id']])['path'], '..'), false);
check('a slashed filename cannot make directories',
      str_contains(q1('SELECT path FROM media WHERE id = ?', [$nasty['id']])['path'], 'etc'), false);

// ---------------------------------------------------------------------------
section('the staging window');
// Everything arrives unapproved, and unapproved means admin-only. This is the
// window in which Supabase served two member photos to anyone with the link.
$m = q1('SELECT m.*, 0 AS subject_is_minor FROM media m WHERE m.id = ?', [$mediaId]);
check('an unapproved photo is hidden from anon',   Visibility::maySeePhoto($anon, $m), false);
check('and from a signed-in member',               Visibility::maySeePhoto($user, $m), false);
check('but an admin can review it',                Visibility::maySeePhoto($admin, $m), true);

check('a member may not approve',
      (function () use ($user, $mediaId) { try { upload_approve($user, $mediaId, true); return 'allowed'; }
        catch (UploadError $e) { return 'refused'; } })(), 'refused');

upload_approve($admin, $mediaId, true);
$m = q1('SELECT m.*, 0 AS subject_is_minor FROM media m WHERE m.id = ?', [$mediaId]);
check('once approved a public photo is visible',   Visibility::maySeePhoto($anon, $m), true);

// ---------------------------------------------------------------------------
section('refusing a photo');
$doomed = tryUpload($user, fixture('regret.png'), 'mem1');
$dPath  = $GLOBALS['ZUPU_CONFIG']['media_root'] . '/' . q1('SELECT path FROM media WHERE id = ?', [$doomed['id']])['path'];
check('the file was written',              is_file($dPath), true);
upload_approve($admin, $doomed['id'], false);
check('refusing deletes the row',          q1('SELECT id FROM media WHERE id = ?', [$doomed['id']]), null);
check('and the bytes with it',             is_file($dPath), false);

echo "\n{$pass} passed, {$fail} failed\n";
array_map('unlink', glob("$root/*/*/*") ?: []);
@unlink($dbFile);
exit($fail ? 1 : 0);
