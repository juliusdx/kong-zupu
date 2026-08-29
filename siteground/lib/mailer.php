<?php
/**
 * Outbound email — one function, two transports.
 *
 * Production uses AUTHENTICATED SMTP (config['mail']['smtp']): a real mailbox
 * speaking for itself, LOGIN auth visible end-to-end. A 2026-08-22 test sent
 * through raw mail()/sendmail arrived correctly signed (dkim=pass,
 * d=accme.my) but landed in Outlook's junk — a first-ever sender with no
 * reputation. Authenticated submission from a real mailbox is the fix that
 * stays self-hosted; if a retest still junks, the next step is an external
 * transactional relay for magic links only.
 *
 * When SMTP is not configured (fresh install, local tests) we fall back to
 * raw mail(), but with -f so the envelope sender matches the From domain.
 * Without it PHP uses the system user (u2883-…@siteground.biz) as
 * Return-Path, which SPF-aligns with nothing and reads as spamware.
 */
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

/** RFC 2047 UTF-8 encoded word, for any header that may carry Chinese. */
function mail_encode_header(string $raw): string
{
    return '=?UTF-8?B?' . base64_encode($raw) . '?=';
}

function mail_from(): string
{
    return (string)(config()['mail']['from'] ?? '');
}

/**
 * Send one message. Returns whether the transport accepted it — the caller
 * decides what to tell the user (the sign-in endpoint deliberately answers
 * the same either way, so the form cannot be used to probe anything).
 *
 * $html switches the content type only. The sign-in mail stays plain text —
 * a link a person is about to trust reads better without markup around it —
 * while the contribution notice is a bilingual layout with a diff table in it,
 * which plain text cannot carry.
 */
function mail_send(string $to, string $subject, string $body, bool $html = false): bool
{
    $m   = config()['mail'];
    $hdr = 'From: ' . mail_encode_header((string)($m['from_name'] ?? '')) . ' <' . mail_from() . '>' . "\r\n"
         . 'MIME-Version: 1.0' . "\r\n"
         . 'Content-Type: text/' . ($html ? 'html' : 'plain') . '; charset=UTF-8' . "\r\n";
    $subj = mail_encode_header($subject);

    if (!empty($m['smtp_host'])) {
        // Config carries the credentials flat (smtp_host/smtp_port/…);
        // gather them once here so smtp_send stays about the conversation.
        $s = [
            'host' => $m['smtp_host'],
            'port' => $m['smtp_port'] ?? 465,
            'user' => $m['smtp_user'] ?? '',
            'pass' => $m['smtp_pass'] ?? '',
        ];
        return smtp_send($to, $subj, $body, $hdr, $s);
    }

    // Fallback transport: same headers request.php always sent, plus the
    // aligned envelope. @ because mail() warns into its own log on failure.
    return @mail($to, $subj, $body, $hdr, '-f' . mail_from());
}

/**
 * Minimal SMTP client: implicit TLS, AUTH LOGIN, one message per connection.
 *
 * Replies are read until a line whose code carries no '-' continuation, and
 * every step's code is checked before the next command — half-sent mail is
 * worse than none, and a wrong password must not look like success.
 */
function smtp_send(string $to, string $subjectEnc, string $body, string $headers, array $s): bool
{
    $eno = 0; $estr = '';
    $fp = @stream_socket_client(
        'ssl://' . $s['host'] . ':' . (int)$s['port'],
        $eno, $estr, 15
    );
    if (!$fp) {
        access_log(null, 'smtp_fail', 'mailer', "connect $eno: $estr");
        return false;
    }
    stream_set_timeout($fp, 15);

    $helo = parse_url((string)config()['site_url'], PHP_URL_HOST) ?: 'localhost';
    try {
        smtp_expect($fp, [220], 'greeting');
        smtp_cmd($fp, "EHLO $helo", [250], 'ehlo');
        smtp_cmd($fp, 'AUTH LOGIN', [334], 'auth');
        smtp_cmd($fp, base64_encode((string)$s['user']), [334], 'auth user');
        smtp_cmd($fp, base64_encode((string)$s['pass']), [235], 'auth pass');
        smtp_cmd($fp, 'MAIL FROM:<' . mail_from() . '>', [250], 'mail from');
        smtp_cmd($fp, "RCPT TO:<$to>", [250, 251], 'rcpt');
        smtp_cmd($fp, 'DATA', [354], 'data');

        // Dot-stuffing: RFC 5321 §4.5.2 — a body line starting with '.'
        // would otherwise terminate DATA early.
        $stuffed = preg_replace('/^\./m', '..', str_replace("\r\n", "\n", $body));
        $msg     = $headers
                 . "To: <$to>\r\n"
                 . "Subject: $subjectEnc\r\n"
                 . "\r\n"
                 . str_replace("\n", "\r\n", $stuffed)
                 . "\r\n.";
        fwrite($fp, $msg . "\r\n");
        smtp_expect($fp, [250], 'end of data');
        smtp_cmd($fp, 'QUIT', [221], 'quit');
        fclose($fp);
        return true;
    } catch (RuntimeException $e) {
        fclose($fp);
        access_log(null, 'smtp_fail', 'mailer', $e->getMessage());
        return false;
    }
}

function smtp_read_reply($fp): array
{
    $lines = [];
    do {
        $line = fgets($fp);
        if ($line === false || $line === '') {
            throw new RuntimeException('no reply' . (count($lines) ? ': ' . end($lines) : ''));
        }
        $lines[] = trim($line);
    } while (strlen($line) >= 4 && $line[3] === '-');
    $last = trim($line);
    return [(int)substr($last, 0, 3), $last];
}

/** @throws RuntimeException when the server's code is not in $want */
function smtp_expect($fp, array $want, string $step): void
{
    [$code, $raw] = smtp_read_reply($fp);
    if (!in_array($code, $want, true)) {
        throw new RuntimeException("$step: $raw");
    }
}

function smtp_cmd($fp, string $cmd, array $want, string $step): void
{
    fwrite($fp, $cmd . "\r\n");
    smtp_expect($fp, $want, $step);
}
