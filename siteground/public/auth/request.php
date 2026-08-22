<?php
/**
 * POST { email } → emails a sign-in link.
 *
 * Always answers the same regardless of whether the address has an account, so
 * the form cannot be used to find out who is in the family.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../lib/auth.php';
require_once __DIR__ . '/../../lib/mailer.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_error('POST only', 405);

$body  = json_decode(file_get_contents('php://input') ?: '{}', true) ?: $_POST;
$email = auth_normalise_email((string)($body['email'] ?? ''));
$same  = ['ok' => true, 'message' => 'If that address is in the family records, a sign-in link is on its way.'];

if ($email === null) json_out($same);

if (!auth_rate_ok($email, client_ip())) {
    access_log(null, 'throttled', 'auth_request', $email);
    json_out($same);                       // same answer: don't confirm the throttle either
}

$url  = auth_issue_token($email, client_ip());
$body = "有人以此電郵登入江氏族譜。\n"
      . "Someone asked to sign in to the Kong family zupu with this address.\n\n"
      . $url . "\n\n"
      . "此連結 15 分鐘內有效，只能使用一次。\n"
      . "The link works once and expires in 15 minutes.\n\n"
      . "若不是您本人，請忽略此郵件。\n"
      . "If this wasn't you, nothing has happened — just ignore this email.\n";

if (!mail_send($email, '登入族譜 · Sign in to the zupu', $body)) {
    // Same public answer either way; the failure is recorded for the keeper,
    // because a silent dead mailbox would lock every relative out.
    access_log(null, 'mail_failed', 'auth_request', $email);
}
json_out($same);
