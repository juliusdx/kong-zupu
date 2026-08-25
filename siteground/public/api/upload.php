<?php
/**
 * Receive a photo, or decide what happens to one.
 *
 *   POST  multipart: photo=<file>, personId= | placeId= | staged=1, caption=
 *   PATCH {mediaId, approve:true|false}      admins — approve, or refuse and delete
 *   PATCH {mediaId, cover:true}              uploader or admin — the tree avatar
 *   DELETE {mediaId}                         uploader or admin
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

/** PATCH and DELETE bodies do not arrive in $_POST. */
function upload_body(): array
{
    $body = json_decode(file_get_contents('php://input') ?: '[]', true);
    if (!is_array($body)) json_error('Expected a JSON object.');
    return $body;
}

try {
    if ($method === 'POST') {
        // Uploading requires a session. Contributing text does not — an elderly
        // relative can send a correction without an account — but a photo is a
        // file on our disk, and an anonymous write endpoint is a different kind
        // of risk. Signed-out contributors embed the image in the payload
        // instead, and it becomes a file only when a reviewer approves it.
        if (!$v->isSignedIn()) json_error('Please sign in to add a photo.', 401);

        $staged   = ($_POST['staged'] ?? '') === '1';
        $personId = ($_POST['personId'] ?? '') !== '' ? (string)$_POST['personId'] : null;
        $placeId  = ($_POST['placeId']  ?? '') !== '' ? (string)$_POST['placeId']  : null;
        json_out(upload_photo($v, $_FILES['photo'] ?? [], $personId, $placeId, $_POST['caption'] ?? null, $staged));
    }

    if ($method === 'PATCH') {
        $body    = upload_body();
        $mediaId = (string)($body['mediaId'] ?? '');
        // One decision per request: approving and re-covering in one call would
        // leave the order of two rules deciding the outcome.
        if (array_key_exists('cover', $body)) {
            if (!$body['cover']) json_error('Set another photo as the avatar instead.', 400);
            json_out(upload_set_cover($v, $mediaId));
        }
        if (!$v->isSignedIn()) json_error('Please sign in.', 401);
        json_out(upload_approve($v, $mediaId, (bool)($body['approve'] ?? false)));
    }

    if ($method === 'DELETE') {
        json_out(upload_delete($v, (string)(upload_body()['mediaId'] ?? '')));
    }
} catch (UploadError $e) {
    json_error($e->getMessage(), $e->status);
}

json_error('POST, PATCH or DELETE only.', 405);
