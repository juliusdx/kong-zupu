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
 * @param array $file    one entry from $_FILES
 * @param bool  $staged  a photo for a person who does not exist yet — the
 *   contribution form's case. It is stored with no subject and claimed later by
 *   upload_attach() when the reviewer approves the contribution that created
 *   them. Deliberately an explicit argument rather than "both ids were null":
 *   a bug that lost the person id would otherwise turn a normal upload into an
 *   ownerless one, and ownerless is exactly the row nothing gates on a subject.
 * @return array{id:string,path:string,visibility:string}
 */
function upload_photo(Viewer $v, array $file, ?string $personId, ?string $placeId, ?string $caption, bool $staged = false): array
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

    if ($staged) {
        if ($personId !== null || $placeId !== null) {
            throw new UploadError('A staged photo has no subject yet.');
        }
    } elseif (($personId === null) === ($placeId === null)) {
        throw new UploadError('A photo belongs to either a person or a place.');
    }

    $visibility = 'public';
    if ($staged) {
        // Member-tier while it waits. A staged photo is almost always of the
        // living relative being added, and the tier is re-derived from the real
        // subject in upload_attach() anyway — so the safer of the two is the
        // right guess for the window in between. approved = 0 already makes it
        // admin-only; this decides what happens if that ever stops being true.
        $visibility = 'member';
    } elseif ($personId !== null) {
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
    $subdir  = match (true) {
        $staged             => 'staged',
        $personId !== null  => 'p/'  . upload_safe_segment($personId),
        default             => 'pl/' . upload_safe_segment((string)$placeId),
    };
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

// ------------------------------------------------------- claiming a photo ---

/**
 * Attach a staged photo to the person a contribution just created, and approve
 * it. This is what makes the contribution form's photo arrive on the tree.
 *
 * The tier is re-derived from the real subject rather than kept from the staging
 * row: at staging time nobody knew who the photo was of, so the guess made then
 * is not evidence. A minor is refused here too — the person may have been
 * created as one — and refusing means DELETING the staged bytes, because a
 * photo of a child that we decline to publish is not a photo we should keep.
 */
function upload_attach(string $mediaId, string $personId): array
{
    $m = q1('SELECT id, person_id, place_id, path, approved FROM media WHERE id = ?', [$mediaId]);
    if (!$m) throw new UploadError('No such photo.', 404);
    if ($m['person_id'] !== null || $m['place_id'] !== null) {
        throw new UploadError('That photo already belongs to someone.', 409);
    }
    $subject = q1('SELECT id, living, is_minor, visibility FROM persons WHERE id = ?', [$personId]);
    if (!$subject) throw new UploadError('No such person.', 404);

    if ((int)$subject['is_minor'] === 1) {
        upload_unlink_media_file((string)$m['path']);
        q('DELETE FROM media WHERE id = ?', [$mediaId]);
        throw new UploadError('Photos of minors are not accepted.', 403);
    }

    $visibility = ((int)$subject['living'] === 1 || $subject['visibility'] === 'member') ? 'member' : 'public';
    q('UPDATE media SET person_id = ?, visibility = ?, approved = 1 WHERE id = ?', [$personId, $visibility, $mediaId]);
    return ['id' => $mediaId, 'personId' => $personId, 'visibility' => $visibility];
}

/**
 * Store a data: URL as a staged photo.
 *
 * A signed-out contributor cannot upload — an anonymous write endpoint that puts
 * files on disk is a different kind of risk from an anonymous note — so the form
 * embeds the image in the contribution payload instead. That payload is
 * admin-only to read, so the unvetted picture is never public; this turns it
 * into a real file at the moment a reviewer approves it.
 *
 * The bytes are validated exactly as an upload's are: written to a temp file and
 * put through getimagesize, because "data:image/jpeg" in the header is the
 * client's word for it and nothing more.
 */
function upload_from_data_url(?string $userId, string $dataUrl, string $personId): array
{
    if (!preg_match('#^data:image/[a-z.+-]+;base64,#i', $dataUrl)) {
        throw new UploadError('That is not an embedded image.', 415);
    }
    $b64 = substr($dataUrl, strpos($dataUrl, ',') + 1);
    $raw = base64_decode($b64, true);
    if ($raw === false || $raw === '') throw new UploadError('The embedded image could not be read.', 400);
    if (strlen($raw) > UPLOAD_MAX_BYTES) throw new UploadError('Photos must be under 8 MB.', 413);

    $tmp = tempnam(sys_get_temp_dir(), 'zupu_embed_');
    if ($tmp === false || @file_put_contents($tmp, $raw) === false) {
        throw new UploadError('Could not store the photo.', 500);
    }
    try {
        $info = @getimagesize($tmp);
        if ($info === false || !isset(UPLOAD_TYPES[$info[2]])) {
            throw new UploadError('That file is not a JPEG, PNG, GIF or WebP image.', 415);
        }
        $subject = q1('SELECT id, living, is_minor, visibility FROM persons WHERE id = ?', [$personId]);
        if (!$subject) throw new UploadError('No such person.', 404);
        if ((int)$subject['is_minor'] === 1) throw new UploadError('Photos of minors are not accepted.', 403);

        $ext        = UPLOAD_TYPES[$info[2]];
        $visibility = ((int)$subject['living'] === 1 || $subject['visibility'] === 'member') ? 'member' : 'public';
        $id         = uuid4();
        $relPath    = 'p/' . upload_safe_segment($personId) . '/' . $id . '_contrib.' . $ext;

        $root = rtrim((string)config()['media_root'], '/');
        $dest = $root . '/' . $relPath;
        if (!is_dir(dirname($dest)) && !@mkdir(dirname($dest), 0700, true) && !is_dir(dirname($dest))) {
            throw new UploadError('Could not store the photo.', 500);
        }
        if (!@copy($tmp, $dest)) throw new UploadError('Could not store the photo.', 500);
        @chmod($dest, 0600);

        q('INSERT INTO media (id, person_id, path, visibility, approved, uploaded_by)
           VALUES (?, ?, ?, ?, 1, ?)', [$id, $personId, $relPath, $visibility, $userId]);
        access_log($userId, 'uploaded', 'media:' . $id, 'embedded/' . $visibility);
        return ['id' => $id, 'personId' => $personId, 'visibility' => $visibility];
    } finally {
        @unlink($tmp);
    }
}

// ------------------------------------------------------------ housekeeping ---

/**
 * Which photo is the tree avatar. Exclusive per person, so setting one clears
 * the others in the same statement pair rather than leaving two rows claiming it.
 */
function upload_set_cover(Viewer $v, string $mediaId): array
{
    $m = q1('SELECT id, person_id, uploaded_by FROM media WHERE id = ?', [$mediaId]);
    if (!$m) throw new UploadError('No such photo.', 404);
    if ($m['person_id'] === null) throw new UploadError('Only a person’s photo can be the avatar.', 409);
    if (!upload_may_manage($v, $m)) throw new UploadError('That is not your photo.', 403);

    q('UPDATE media SET cover = 0 WHERE person_id = ? AND id <> ?', [$m['person_id'], $mediaId]);
    q('UPDATE media SET cover = 1 WHERE id = ?', [$mediaId]);
    access_log($v->userId, 'cover_set', 'media:' . $mediaId, (string)$m['person_id']);
    return ['id' => $mediaId, 'personId' => $m['person_id'], 'cover' => true];
}

/**
 * Remove a photo, bytes and row together.
 *
 * The uploader may remove their own; an admin may remove any. That mirrors the
 * media_delete policy this is replacing — and the file goes with the row,
 * because a media table that has forgotten a file is exactly how orphaned bytes
 * accumulate in a directory nobody audits.
 */
function upload_delete(Viewer $v, string $mediaId): array
{
    $m = q1('SELECT id, path, uploaded_by FROM media WHERE id = ?', [$mediaId]);
    if (!$m) throw new UploadError('No such photo.', 404);
    if (!upload_may_manage($v, $m)) throw new UploadError('That is not your photo.', 403);

    upload_unlink_media_file((string)$m['path']);
    q('DELETE FROM media WHERE id = ?', [$mediaId]);
    access_log($v->userId, 'deleted', 'media:' . $mediaId, null);
    return ['id' => $mediaId, 'deleted' => true];
}

/** An admin, or the person who uploaded it. */
function upload_may_manage(Viewer $v, array $media): bool
{
    if ($v->isAdmin) return true;
    if (!$v->isSignedIn() || $media['uploaded_by'] === null) return false;
    return hash_equals((string)$media['uploaded_by'], (string)$v->userId);
}

/**
 * Delete a stored file, refusing anything that does not resolve inside the media
 * root. The path comes from our own database, but an unlink that trusts a path
 * is worth checking twice.
 */
function upload_unlink_media_file(string $relPath): void
{
    $root = realpath(rtrim((string)config()['media_root'], '/'));
    if ($root === false) return;
    $full = realpath($root . '/' . $relPath);
    if ($full !== false && str_starts_with($full, $root . DIRECTORY_SEPARATOR) && is_file($full)) @unlink($full);
}
