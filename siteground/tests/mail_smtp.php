<?php
/**
 * Manual deliverability test — NOT part of the assertion suites, sends real
 * email. Run wherever config.php exists (the server, or locally once filled):
 *
 *     php tests/mail_smtp.php <to@example.com> [label]
 *
 * Reports which transport was used (authenticated SMTP or the mail()
 * fallback), so the junk-folder question can be answered per transport.
 */
declare(strict_types=1);
require_once __DIR__ . '/../lib/mailer.php';

$to    = $argv[1] ?? null;
$label = $argv[2] ?? '';
if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    exit("usage: php tests/mail_smtp.php <to@example.com> [label]\n");
}

$m       = config()['mail'];
$viaSmtp = !empty($m['smtp']['host']);
$subject = '族譜郵件測試 · Zupu Mail Test'
         . ($label !== '' ? " ($label)" : '')
         . ' — ' . date('Y-m-d H:i:s');
$body = "Deliverability test for the Kong family zupu.\n"
      . 'Transport: ' . ($viaSmtp ? 'authenticated SMTP (' . $m['smtp']['host'] . ')' : 'raw mail() fallback') . "\n"
      . 'From: ' . mail_from() . "\n\n"
      . "Please report where this landed: INBOX / SPAM / MISSING.\n";

$ok = mail_send($to, $subject, $body);
echo $ok ? ("accepted by " . ($viaSmtp ? 'SMTP' : 'sendmail') . " — check $to\n")
         : "REJECTED by transport — see access_log / smtp_fail detail\n";
exit($ok ? 0 : 1);
