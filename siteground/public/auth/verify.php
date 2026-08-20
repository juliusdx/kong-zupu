<?php
/**
 * GET /auth/verify.php?t=… — consume the link, start the session, redirect.
 *
 * The redirect matters: it takes the token out of the address bar, so it does
 * not linger in history, in a bookmark, or in the Referer of the next request.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../lib/auth.php';

$token = (string)($_GET['t'] ?? '');
$email = auth_consume_token($token);
$home  = rtrim(config()['site_url'], '/') . '/';

if ($email === null) {
    access_log(null, 'bad_token', 'auth_verify');
    header('Location: ' . $home . '?signin=expired', true, 302);
    exit;
}

auth_login($email);
header('Location: ' . $home . '?signin=ok', true, 302);
exit;
