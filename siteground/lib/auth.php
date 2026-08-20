<?php
/**
 * Magic-link sign-in. No passwords: the family is largely elderly relatives, and
 * a password is one more thing to lose. Email possession is the proof.
 *
 * The link necessarily carries a token in the URL — that is what a magic link
 * is. What follows from that is handled rather than ignored:
 *   • 32 random bytes, so it cannot be guessed;
 *   • only the SHA-256 HASH is stored, so a database backup is not a set of
 *     working keys;
 *   • single use and 15 minutes;
 *   • compared with hash_equals, never ===;
 *   • consumed and then redirected, so the token leaves the address bar and does
 *     not end up in browser history or a Referer header.
 */
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

const LOGIN_TOKEN_TTL      = 900;   // 15 minutes
const LOGIN_MAX_PER_EMAIL  = 5;     // per hour
const LOGIN_MAX_PER_IP     = 20;    // per hour

function auth_normalise_email(string $raw): ?string
{
    $e = strtolower(trim($raw));
    return filter_var($e, FILTER_VALIDATE_EMAIL) ? $e : null;
}

/**
 * Timestamps are computed in PHP and passed as parameters rather than written as
 * NOW() / DATE_SUB(), which spell differently in MySQL and SQLite. It also keeps
 * every comparison against one clock.
 */
function sql_now(int $offsetSeconds = 0): string
{
    return gmdate('Y-m-d H:i:s', time() + $offsetSeconds);
}

/** Throttle: stops the form being used to mail-bomb a relative, or to fish for accounts. */
function auth_rate_ok(string $email, string $ip): bool
{
    $hourAgo = sql_now(-3600);
    $byEmail = (int)q1(
        'SELECT COUNT(*) c FROM login_tokens WHERE email = ? AND created_at > ?',
        [$email, $hourAgo])['c'];
    $byIp = (int)q1(
        'SELECT COUNT(*) c FROM login_tokens WHERE created_ip = ? AND created_at > ?',
        [$ip, $hourAgo])['c'];
    return $byEmail < LOGIN_MAX_PER_EMAIL && $byIp < LOGIN_MAX_PER_IP;
}

/** Issue a token and return the URL to email. The caller never sees the hash. */
function auth_issue_token(string $email, string $ip): string
{
    $token = bin2hex(random_bytes(32));
    q('INSERT INTO login_tokens (token_hash, email, expires_at, created_ip, created_at)
       VALUES (?, ?, ?, ?, ?)',
      [hash('sha256', $token), $email, sql_now(LOGIN_TOKEN_TTL), $ip, sql_now()]);

    return rtrim(config()['site_url'], '/') . '/auth/verify.php?t=' . $token;
}

/**
 * Consume a token. Returns the email on success, null on anything else — an
 * expired, already-used, or unknown token are deliberately indistinguishable.
 */
function auth_consume_token(string $token): ?string
{
    if (!preg_match('/^[0-9a-f]{64}$/', $token)) return null;
    $hash = hash('sha256', $token);

    $row = q1('SELECT token_hash, email, used_at, expires_at
                 FROM login_tokens WHERE token_hash = ?', [$hash]);
    if (!$row) return null;

    // Constant-time even though the lookup was by primary key: the comparison
    // habit is what survives a later refactor into a scan.
    if (!hash_equals($row['token_hash'], $hash)) return null;
    if ($row['used_at'] !== null) return null;
    if ($row['expires_at'] <= sql_now()) return null;

    q('UPDATE login_tokens SET used_at = ? WHERE token_hash = ?', [sql_now(), $hash]);
    return (string)$row['email'];
}

/** Sign the user in. Creates the account on first sign-in, unapproved. */
function auth_login(string $email): array
{
    $u = q1('SELECT * FROM users WHERE email = ?', [$email]);
    if (!$u) {
        $id = uuid4();
        q('INSERT INTO users (id, email) VALUES (?,?)', [$id, $email]);
        $u = q1('SELECT * FROM users WHERE id = ?', [$id]);
    }

    session_start_hardened();
    // Fixation defence: whatever id the browser arrived with is discarded.
    session_regenerate_id(true);
    $_SESSION['uid'] = $u['id'];
    q('UPDATE users SET last_seen_at = ? WHERE id = ?', [sql_now(), $u['id']]);
    access_log((string)$u['id'], 'login', 'auth', $email);
    return $u;
}

function auth_logout(): void
{
    session_start_hardened();
    $uid = $_SESSION['uid'] ?? null;
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    if ($uid) access_log((string)$uid, 'logout', 'auth');
}
