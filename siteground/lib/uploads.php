<?php
/**
 * Receiving a photo.
 *
 * The counterpart to photo.php, and the other half of its argument. Files are
 * written OUTSIDE the web root, under a path this file decides — never one the
 * uploader supplies — so there is no URL that reaches them and no filename that
 * can climb out of the media root. Serving them is photo.php's job and the only
 * way out.
 *
 * Everything arrives unapproved. On Supabase, contribution photos were staged in
 * the PUBLIC bucket until a reviewer got to them, which meant a photo of a living
 * relative was fetchable by anyone with the link during exactly the window when
 * nobody had agreed to publish it. Here `approved = 0` already means admin-only
 * in maySeePhoto, so the staging window is private by construction rather than by
 * remembering to make it so.
 *
 * The visibility of the photo follows the SUBJECT, not the uploader's intent: a
 * picture of a living member is member-tier whatever the form said, and a
 * picture of a minor is refused outright rather than stored and hidden. A file
 * that is never written cannot later be exposed by a bug in who may read it.
 */
declare(strict_types=1);
require_once __DIR__ . '/repo.php';

const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

/** Extension per real image type. The key is what getimagesize() reports, so an
 *  .png that is actually a PHP script does not get to keep its extension. */
const UPLOAD_TYPES = [
    IMAGETYPE_JPEG => 'jpg',
    IMAGETYPE_PNG  => 'png',
    IMAGETYPE_GIF  => 'gif',
    IMAGETYPE_WEBP => 'webp',
];

final class UploadError extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 400)
    {
        parent::__construct($message);
    }
}

/**
 * Store an uploaded photo and record it, unapproved.
 *
 * @param array $file  one entry from $_FILES
 * @return array{id:string,path:string,visibility:string}
 */
function upload_photo(Viewer $v, array $file, ?string $personId, ?string $placeId, ?string $caption): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new UploadError(match ($file['error'] ?? -1) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'That photo is too large.',
            UPLOAD_ERR_NO_FILE => 'No photo was attached.',
            default => 'The upload did not complete.',
        }, 413);
    }
    if (($file['size'] ?? 0) > UPLOAD_MAX_BYTES) {
        throw new UploadError('Photos must be under 8 MB.', 413);
    }
    $tmp = (string)($file['tmp_name'] ?? '');
    // is_uploaded_file is the guard against being handed a path to something
    // else on the server. Skipped only under test, where there is no real POST.
    if (!defined('ZUPU_TESTING') && !is_uploaded_file($tmp)) {
        throw new UploadError('That was not an uploaded file.', 400);
    }
    if (!is_file($tmp)) throw new UploadError('The upload did not arrive.', 400);

    // Trust the bytes, not the name or the client's content-type. An extension
    // is decided from what the file actually is.
    $info = @getimagesize($tmp);
    if ($info === false || !isset(UPLOAD_TYPES[$info[2]])) {
        throw new UploadError('That file is not a JPEG, PNG, GIF or WebP image.', 415);
    }
    $ext = UPLOAD_TYPES[$info[2]];

    if (($personId === null) === ($placeId === null)) {
        throw new UploadError('A photo belongs to either a person or a place.');
    }

    $visibility = 'public';
    if ($personId !== null) {
        $subject = q1('SELECT id, living, is_minor, visibility, archived FROM persons WHERE id = ?', [$personId]);
        if (!$subject) throw new UploadError('No such person.', 404);
        // Refused rather than stored-and-hidden. The safest photo of a child is
        // the one that was never written to disk.
        if ((int)$subject['is_minor'] === 1) {
            access_log($v->userId, 'refused', 'upload', 'minor:' . $personId);
            throw new UploadError('Photos of minors are not accepted.', 403);
        }
        if ((int)$subject['archived'] === 1) throw new UploadError('That person has been removed from the tree.', 409);
        // Follows the subject. A living relative's photo is member-tier even if
        // the person they descend from is a public ancestor.
        $visibility = ((int)$subject['living'] === 1 || $subject['visibility'] === 'member') ? 'member' : 'public';
    } else {
        if (!q1('SELECT id FROM places WHERE id = ?', [$placeId])) throw new UploadError('No such place.', 404);
    }

    // The path is ours. The uploader's filename survives only as a hint inside a
    // directory we chose, stripped to characters that cannot mean anything to a
    // filesystem.
    $id      = uuid4();
    $subdir  = $personId !== null ? 'p/' . upload_safe_segment($personId) : 'pl/' . upload_safe_segment((string)$placeId);
    $stem    = upload_safe_segment(pathinfo((string)($file['name'] ?? 'photo'), PATHINFO_FILENAME)) ?: 'photo';
    $relPath = $subdir . '/' . $id . '_' . substr($stem, 0, 40) . '.' . $ext;

    $root = rtrim((string)config()['media_root'], '/');
    $dest = $root . '/' . $relPath;
    if (!is_dir(dirname($dest)) && !@mkdir(dirname($dest), 0700, true) && !is_dir(dirname($dest))) {
        throw new UploadError('Could not store the photo.', 500);
    }
    $ok = defined('ZUPU_TESTING') ? @copy($tmp, $dest) : @move_uploaded_file($tmp, $dest);
    if (!$ok) throw new UploadError('Could not store the photo.', 500);
    @chmod($dest, 0600);

    // Belt and braces: the path we just built must resolve inside the root. If
    // it does not, the file is removed rather than left where photo.php will
    // later refuse to serve it anyway.
    $realRoot = realpath($root);
    $realDest = realpath($dest);
    if ($realRoot === false || $realDest === false || !str_starts_with($realDest, $realRoot . DIRECTORY_SEPARATOR)) {
        @unlink($dest);
        throw new UploadError('Could not store the photo.', 500);
    }

    q('INSERT INTO media (id, person_id, place_id, path, caption, visibility, approved, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
      [$id, $personId, $placeId, $relPath, $caption ?: null, $visibility, $v->userId]);

    access_log($v->userId, 'uploaded', 'media:' . $id, $visibility);
    return ['id' => $id, 'path' => $relPath, 'visibility' => $visibility, 'approved' => false];
}

/**
 * Reduce a string to something that cannot mean anything to a filesystem: no
 * separators, no dots, no leading dashes. Traversal is not defended against by
 * spotting "..", it is defended against by there being no way to write one.
 */
function upload_safe_segment(string $s): string
{
    $s = preg_replace('/[^\p{L}\p{N}_-]+/u', '_', $s) ?? '';
    $s = trim($s, '_-');
    return substr($s, 0, 64);
}

/** Approve a staged photo. Until this runs, only an admin can see it. */
function upload_approve(Viewer $v, string $mediaId, bool $approve): array
{
    if (!$v->isAdmin) throw new UploadError('Reviewers only.', 403);
    $m = q1('SELECT id, path FROM media WHERE id = ?', [$mediaId]);
    if (!$m) throw new UploadError('No such photo.', 404);
    if ($approve) {
        q('UPDATE media SET approved = 1 WHERE id = ?', [$mediaId]);
    } else {
        // A refused photo is deleted, not merely flagged. Keeping the bytes of a
        // picture someone decided not to publish is the thing we are trying to
        // avoid, and photo.php would be the only reader anyway.
        $root = realpath(rtrim((string)config()['media_root'], '/'));
        $full = $root === false ? false : realpath($root . '/' . $m['path']);
        if ($full !== false && str_starts_with($full, $root . DIRECTORY_SEPARATOR) && is_file($full)) @unlink($full);
        q('DELETE FROM media WHERE id = ?', [$mediaId]);
    }
    access_log($v->userId, $approve ? 'approved' : 'deleted', 'media:' . $mediaId, null);
    return ['id' => $mediaId, 'approved' => $approve];
}
