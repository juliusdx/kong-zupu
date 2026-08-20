<?php
/**
 * The only way a photo leaves this server.
 *
 * Files live OUTSIDE the web root, so there is no URL that reaches them. This
 * script checks the session and the media row's visibility, and only then reads
 * the bytes. The gate and the file are the same code path, which is exactly the
 * property that failed on Supabase: there, RLS hid the media ROW while the FILE
 * sat in a public bucket, and two member-only photos were fetchable by anyone
 * who had the link.
 *
 *   GET /photo.php?id=<media uuid>
 */
declare(strict_types=1);
require_once __DIR__ . '/../lib/bootstrap.php';

$id = (string)($_GET['id'] ?? '');
if ($id === '' || !preg_match('/^[0-9a-f-]{36}$/i', $id)) {
    http_response_code(400);
    exit('bad id');
}

$v = viewer();

// Pull the row together with the subject's own gating, so a member photo of a
// minor cannot be reached even if the media row itself says 'public'.
$m = q1(
    'SELECT m.id, m.path, m.visibility, m.approved,
            COALESCE(p.is_minor, 0) AS subject_is_minor,
            COALESCE(p.archived, 0) AS subject_archived
       FROM media m
       LEFT JOIN persons p ON p.id = m.person_id
      WHERE m.id = ?',
    [$id]
);

if (!$m || ($m['subject_archived'] && !$v->isAdmin)) {
    // Same answer for "no such photo" and "not for you": a 404 tells an attacker
    // nothing about which ids exist.
    http_response_code(404);
    exit('not found');
}

if (!Visibility::maySeePhoto($v, $m)) {
    access_log($v->userId, 'refused', 'photo:' . $id, 'visibility=' . $m['visibility']);
    http_response_code(404);
    exit('not found');
}

// Resolve inside media_root and refuse anything that climbs out of it. The path
// comes from our own database, but a traversal bug here would serve any file on
// the account, so it is checked rather than trusted.
// realpath BOTH sides before comparing. A home directory that is itself reached
// through a symlink — /var → /private/var on macOS, and commonly on shared hosts —
// makes the resolved file path disagree with the configured root, and every photo
// 404s. Failing closed, but failing.
$root = realpath(rtrim(config()['media_root'], '/'));
$full = $root === false ? false : realpath($root . '/' . $m['path']);
if ($root === false || $full === false || !str_starts_with($full, $root . DIRECTORY_SEPARATOR) || !is_file($full)) {
    access_log($v->userId, 'missing', 'photo:' . $id, $m['path']);
    http_response_code(404);
    exit('not found');
}

$mime = match (strtolower(pathinfo($full, PATHINFO_EXTENSION))) {
    'jpg', 'jpeg' => 'image/jpeg',
    'png'         => 'image/png',
    'gif'         => 'image/gif',
    'webp'        => 'image/webp',
    default       => 'application/octet-stream',
};

// A member photo must never be cached by a shared proxy: the next viewer through
// that cache may not be signed in.
$public = $m['visibility'] === 'public';
header('Content-Type: ' . $mime);
header('Content-Length: ' . (string)filesize($full));
header('X-Content-Type-Options: nosniff');
header('Content-Disposition: inline; filename="' . basename($full) . '"');
header($public ? 'Cache-Control: public, max-age=3600' : 'Cache-Control: private, no-store');

readfile($full);
