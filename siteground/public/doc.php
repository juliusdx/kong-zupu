<?php
/**
 * The only way a source document leaves this server.
 *
 * The same shape as photo.php and for the same reason: the files live outside
 * the web root, so the URL that serves them IS the check. On Supabase these sat
 * in a `documents` bucket whose policy was scoped to `authenticated`, and the
 * app minted a signed URL per view. That gating is carried over rather than
 * reconsidered — a signed-in relative may read the scans; a stranger may not.
 *
 *   GET /doc.php?key=kong-family-book-pt1.pdf
 *
 * Note what is NOT gated, deliberately: the page images in data/scans/ and the
 * bilingual transcription pages are public by the family's own decision, and
 * the Sources tab reads those without coming here. This is only the original
 * full PDF, which is the heavy artifact rather than the readable one.
 */
declare(strict_types=1);
require_once __DIR__ . '/../lib/bootstrap.php';

$key = (string)($_GET['key'] ?? '');

// A document key is a bare filename from our own manifest. No directories, no
// dots that could climb, nothing but the shape we publish — the traversal check
// below is the real defence, but refusing the shape first keeps the log honest
// about what was actually asked for.
if ($key === '' || !preg_match('/^[a-z0-9][a-z0-9._-]{0,80}\.pdf$/i', $key) || str_contains($key, '..')) {
    http_response_code(400);
    exit('bad key');
}

$v = viewer();
if (!$v->isSignedIn()) {
    access_log($v->userId, 'refused', 'doc:' . $key, 'not signed in');
    // 404 rather than 403: which documents exist is not a stranger's business.
    http_response_code(404);
    exit('not found');
}

// realpath BOTH sides — ~/www is a symlink on this host, and resolving only one
// side makes every document 404 while looking like a permissions bug.
$root = realpath(rtrim((string)(config()['docs_root'] ?? ''), '/'));
$full = $root === false ? false : realpath($root . '/' . $key);
if ($root === false || $full === false
    || !str_starts_with($full, $root . DIRECTORY_SEPARATOR) || !is_file($full)) {
    access_log($v->userId, 'missing', 'doc:' . $key, null);
    http_response_code(404);
    exit('not found');
}

// Signed-in only, so never cacheable by a shared proxy: the next reader through
// that cache may not be signed in.
header('Content-Type: application/pdf');
header('Content-Length: ' . (string)filesize($full));
header('X-Content-Type-Options: nosniff');
header('Content-Disposition: inline; filename="' . basename($full) . '"');
header('Cache-Control: private, no-store');

readfile($full);
