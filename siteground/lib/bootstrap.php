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
 */
function session_start_hardened(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $cfg = config();
    session_name('zupu_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => (bool)($cfg['secure_cookies'] ?? true),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
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
