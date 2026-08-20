<?php
/**
 * The privacy model, in one place.
 *
 * On Supabase this lived in 24 RLS policies. Here it is a set of WHERE clauses.
 * The rule that makes that safe is: NOTHING reads persons/media/places directly.
 * Every read goes through a function in this file, so there is exactly one
 * definition of "may this viewer see this row", the way there was exactly one
 * before. Two permission systems can drift; one cannot.
 *
 *   public  → anyone, signed in or not
 *   member  → any signed-in user
 *   admin   → admins only
 *   is_minor → admins only, whatever the visibility column says
 *
 * Detail (birth year, bio, contacts) needs an APPROVED member, not merely a
 * signed-in one — same two-step as before.
 */
declare(strict_types=1);

final class Viewer
{
    public function __construct(
        public readonly ?string $userId = null,
        public readonly bool $isAdmin = false,
        public readonly bool $isApproved = false,
        public readonly ?string $personId = null,
    ) {}

    public function isSignedIn(): bool { return $this->userId !== null; }

    public static function anonymous(): self { return new self(); }
}

final class Visibility
{
    /**
     * Row-level gate for persons/places/media.
     *
     * Returns [sqlFragment, params]. The fragment is always parenthesised so it
     * can be dropped into a larger WHERE with AND without precedence surprises.
     *
     * @param string $alias table alias, e.g. "p"
     */
    public static function rowGate(Viewer $v, string $alias, bool $hasMinor = true, bool $hasArchived = true): array
    {
        $a = self::safeAlias($alias);
        $clauses = [];
        $params  = [];

        if ($hasArchived) {
            // Archived rows are hidden from everyone except admins, who need to
            // see them in order to restore them.
            $clauses[] = $v->isAdmin ? "1=1" : "{$a}.archived = 0";
        }

        if ($v->isAdmin) {
            $clauses[] = "1=1";                      // admins see every tier
        } elseif ($v->isSignedIn()) {
            $clauses[] = "{$a}.visibility IN ('public','member')";
        } else {
            $clauses[] = "{$a}.visibility = 'public'";
        }

        // Minors are never visible to anyone but an admin — not to other
        // signed-in members either. This is deliberately a separate clause from
        // the tier above so it cannot be lost by editing the tier logic.
        if ($hasMinor && !$v->isAdmin) {
            $clauses[] = "{$a}.is_minor = 0";
        }

        return ['(' . implode(' AND ', $clauses) . ')', $params];
    }

    /**
     * May this viewer see gated DETAIL (birth year, bio) for a person?
     * Admin, an approved member, or the person themselves.
     */
    public static function maySeeDetail(Viewer $v, ?string $personId = null): bool
    {
        if ($v->isAdmin) return true;
        if ($personId !== null && $v->personId !== null && hash_equals($v->personId, $personId)) return true;
        return $v->isApproved;
    }

    /** Contacts are stricter still: the person themselves, or an admin. */
    public static function maySeeContact(Viewer $v, string $personId): bool
    {
        if ($v->isAdmin) return true;
        return $v->personId !== null && hash_equals($v->personId, $personId);
    }

    /**
     * May this viewer be served this photo? Used by photo.php, which is the ONLY
     * way bytes leave the server.
     *
     * @param array $media a row from `media` joined to its subject's visibility
     */
    public static function maySeePhoto(Viewer $v, array $media): bool
    {
        if ($v->isAdmin) return true;
        if (!$media['approved']) return false;               // unreviewed uploads: admin only
        if ($media['subject_is_minor'] ?? false) return false;
        return match ($media['visibility']) {
            'public' => true,
            'member' => $v->isSignedIn(),
            default  => false,
        };
    }

    private static function safeAlias(string $alias): string
    {
        if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $alias)) {
            throw new InvalidArgumentException('bad table alias');
        }
        return $alias;
    }
}
