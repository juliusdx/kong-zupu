<?php
/**
 * Receive a photo, or decide one.
 *
 *   POST  multipart: photo=<file>, personId= | placeId=, caption=
 *   PATCH {mediaId, approve:true|false}      admins
 *
 * On Supabase this was a direct write to a storage bucket, which is how two
 * member photos ended up publicly fetchable: the bucket did not know what the
 * database knew. Here the bytes land outside the web root and the only reader
 * is photo.php, which checks before it opens the file.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../lib/uploads.php';

$v      = viewer();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    // Uploading requires a session. Contributing text does not — an elderly
    // relative can send a correction without an account — but a photo is a file
    // on our disk, and an anonymous write endpoint is a different kind of risk.
    if (!$v->isSignedIn()) json_error('Please sign in to add a photo.', 401);

    $personId = ($_POST['personId'] ?? '') !== '' ? (string)$_POST['personId'] : null;
    $placeId  = ($_POST['placeId']  ?? '') !== '' ? (string)$_POST['placeId']  : null;
    try {
        json_out(upload_photo($v, $_FILES['photo'] ?? [], $personId, $placeId, $_POST['caption'] ?? null));
    } catch (UploadError $e) {
        json_error($e->getMessage(), $e->status);
    }
}

if ($method === 'PATCH') {
    $body = json_decode(file_get_contents('php://input') ?: '[]', true);
    if (!is_array($body)) json_error('Expected a JSON object.');
    try {
        json_out(upload_approve($v, (string)($body['mediaId'] ?? ''), (bool)($body['approve'] ?? false)));
    } catch (UploadError $e) {
        json_error($e->getMessage(), $e->status);
    }
}

json_error('POST or PATCH only.', 405);
