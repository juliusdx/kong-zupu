<?php
/**
 * The member roster, and the two flags an admin may change on it.
 *
 * `approved` is the second half of the privacy model: signing in shows you who
 * the family are, and being approved shows you their detail — birth years,
 * bios, contacts, photos. New accounts start unapproved, so until someone
 * vouches for them a relative sees living people as name-only skeletons.
 *
 * `is_admin` is reviewer rights: the contribution queue and this screen.
 *
 * Two refusals are the point of this file rather than the UI:
 *
 * 1. NO SELF-DEMOTION. An admin removing their own reviewer rights locks the
 *    panel behind a flag only an admin can set, and the family has exactly one
 *    admin. The button is hidden, but a hidden button is not a rule.
 *
 * 2. NO LAST ADMIN. The Supabase version could not express this — it refused
 *    self-demotion and left it there — but two admins demoting each other in
 *    turn reaches the same locked door by a longer route. The roster is small
 *    enough to count, so count it.
 *
 * Everything here re-checks isAdmin server-side. The client hides the tab; that
 * is cosmetic, and this is the gate.
 */
declare(strict_types=1);
require_once __DIR__ . '/repo.php';

final class MemberError extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 400)
    {
        parent::__construct($message);
    }
}

/** Every account, newest first. Admin-only: it is the family's address book. */
function members_list(Viewer $v): array
{
    if (!$v->isAdmin) { access_log($v->userId, 'refused', 'members'); throw new MemberError('Reviewers only.', 403); }
    $rows = q('SELECT id, email, full_name, person_id, is_admin, approved, created_at, last_seen_at
                 FROM users ORDER BY created_at DESC')->fetchAll();
    // Cast the flags: SQLite hands back "0"/"1" strings and the client tests
    // them for truth, where "0" is true.
    foreach ($rows as &$r) {
        $r['is_admin'] = (bool)$r['is_admin'];
        $r['approved'] = (bool)$r['approved'];
    }
    return $rows;
}

function member_row(string $id): ?array
{
    return q1('SELECT id, email, full_name, is_admin, approved FROM users WHERE id = ?', [$id]);
}

/** Grant or withdraw the detail an approved member may see. */
function member_set_approved(Viewer $v, string $id, bool $approve): array
{
    if (!$v->isAdmin) { access_log($v->userId, 'refused', 'member_approve', $id); throw new MemberError('Reviewers only.', 403); }
    $u = member_row($id);
    if (!$u) throw new MemberError('No such member.', 404);

    // An admin who is not an approved member cannot see what they are reviewing.
    // Revoking approval on an admin is therefore a demotion in disguise; make
    // the caller do it in the open, by removing reviewer rights first.
    if (!$approve && (bool)$u['is_admin']) {
        throw new MemberError('Remove their reviewer rights first — an admin is always an approved member.', 409);
    }

    q('UPDATE users SET approved = ? WHERE id = ?', [$approve ? 1 : 0, $id]);
    access_log($v->userId, $approve ? 'member_approved' : 'member_unapproved', 'member', $id);
    return ['ok' => true, 'id' => $id, 'approved' => $approve];
}

/** Grant or remove reviewer rights. */
function member_set_admin(Viewer $v, string $id, bool $makeAdmin): array
{
    if (!$v->isAdmin) { access_log($v->userId, 'refused', 'member_admin', $id); throw new MemberError('Reviewers only.', 403); }
    $u = member_row($id);
    if (!$u) throw new MemberError('No such member.', 404);

    if (!$makeAdmin) {
        if ($v->userId !== null && hash_equals($v->userId, $id)) {
            throw new MemberError('You cannot remove your own reviewer access.', 409);
        }
        // Count before removing, not after: the check is worth nothing if the
        // row is already gone when it runs.
        $admins = (int)(q1('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1')['n'] ?? 0);
        if ((bool)$u['is_admin'] && $admins <= 1) {
            throw new MemberError('That is the last reviewer — promote someone else first.', 409);
        }
    }

    // A reviewer is always an approved member: promoting someone who was never
    // approved would seat them at the queue while the tree still hid its detail
    // from them.
    $makeAdmin
        ? q('UPDATE users SET is_admin = 1, approved = 1 WHERE id = ?', [$id])
        : q('UPDATE users SET is_admin = 0 WHERE id = ?', [$id]);

    access_log($v->userId, $makeAdmin ? 'member_promoted' : 'member_demoted', 'member', $id);
    return ['ok' => true, 'id' => $id, 'isAdmin' => $makeAdmin];
}
