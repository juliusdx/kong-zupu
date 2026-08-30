<?php
/**
 * Loaded first by every entry point. Config, session, viewer, JSON helpers.
 */
declare(strict_types=1);

require_once __DIR__ . '/visibility.php';
require_once __DIR__ . '/db.php';

function config(): array
{
    // Tests and the importer inject configuration instead of shipping a
    // config.php; read it fresh each call so a test can flip a switch mid-run.
    if (isset($GLOBALS['ZUPU_CONFIG'])) return $GLOBALS['ZUPU_CONFIG'];

    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $file = getenv('ZUPU_CONFIG_FILE') ?: __DIR__ . '/../config.php';
    if (!is_file($file)) {
        http_response_code(500);
        exit('config.php missing — copy config.example.php and fill it in.');
    }
    $cfg = require $file;
    return $cfg;
}

/**
 * Session cookie hardening. HttpOnly keeps it away from any script on the page;
 * SameSite=Lax means another site cannot ride the family's session; Secure means
 * it is never sent in the clear. session_regenerate_id(true) happens at LOGIN
 * (auth/verify.php), not here, so a pre-set id cannot be fixated.
 *
 * HOW LONG IT LASTS is a decision, and the defaults made the wrong one. A
 * lifetime of 0 is a browser-session cookie — gone when the window closes — and
 * PHP's gc_maxlifetime here is 1440 seconds, so the server forgot anyone idle
 * for 24 minutes. On Supabase a signed-in relative stayed signed in for weeks,
 * so the cutover silently turned "you are signed in" into "you were signed in
 * for the next twenty minutes". The first report was an admin saying she no
 * longer had permission to approve reviews: she had it, she was signed out, and
 * a signed-out admin and an unauthorised one look identical from the outside.
 *
 * This is a family archive that people visit occasionally, not a bank. Thirty
 * days, renewed on each visit.
 *
 * The save path matters as much as the lifetime. PHP's default here is /tmp,
 * shared with the other applications on this hosting account — any one of them
 * running session GC with a shorter lifetime deletes OUR sessions too, and
 * their code sits beside our session files. Ours live in a directory of their
 * own, outside every web root, created 0700.
 */
function session_start_hardened(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $cfg  = config();
    $days = (int)($cfg['session_days'] ?? 30);
    $ttl  = $days * 86400;

    $path = (string)($cfg['session_path'] ?? '');
    if ($path !== '') {
        if (!is_dir($path)) @mkdir($path, 0700, true);
        if (is_dir($path) && is_writable($path)) session_save_path($path);
    }

    // Both halves, or the shorter one wins: the cookie is how long the browser
    // offers the id back, gc_maxlifetime is how long the server still knows it.
    ini_set('session.gc_maxlifetime', (string)$ttl);

    session_name('zupu_session');
    session_set_cookie_params([
        'lifetime' => $ttl,
        'path'     => '/',
        'domain'   => '',
        'secure'   => (bool)($cfg['secure_cookies'] ?? true),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();

    // Slide the window forward on each visit, so somebody who uses the site
    // every few weeks is never signed out mid-use. Only for an established
    // session: re-sending it for an anonymous visitor would set a cookie on
    // people who have never signed in.
    if (!empty($_SESSION['uid'])) {
        setcookie(session_name(), session_id(), [
            'expires'  => time() + $ttl,
            'path'     => '/',
            'secure'   => (bool)($cfg['secure_cookies'] ?? true),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
}

/** Who is asking? Re-read from the database so a revoked admin loses it at once. */
function viewer(): Viewer
{
    static $v = null;
    if ($v instanceof Viewer) return $v;
    session_start_hardened();
    $uid = $_SESSION['uid'] ?? null;
    if (!$uid) return $v = Viewer::anonymous();

    $u = q1('SELECT id, is_admin, approved, person_id FROM users WHERE id = ?', [$uid]);
    if (!$u) {                       // account deleted mid-session
        $_SESSION = [];
        return $v = Viewer::anonymous();
    }
    return $v = new Viewer(
        userId:     (string)$u['id'],
        isAdmin:    (bool)$u['is_admin'],
        isApproved: (bool)$u['approved'],
        personId:   $u['person_id'] !== null ? (string)$u['person_id'] : null,
    );
}

function json_out(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $msg, int $status = 400): never
{
    json_out(['error' => $msg], $status);
}

function client_ip(): string
{
    return (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}
