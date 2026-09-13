<?php
/**
 * The members panel.
 *
 *   GET                          the roster
 *   POST {id, approved:bool}     approve or un-approve
 *   POST {id, isAdmin:bool}      grant or remove reviewer rights
 *
 * Admin-only, checked in lib/members.php rather than here, so the rule holds
 * wherever it is called from and can be tested without a web server.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../lib/members.php';
require_once __DIR__ . '/../../lib/notify.php';

$v      = viewer();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        json_out(['members' => members_list($v)]);
    }

    if ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input') ?: '[]', true);
        if (!is_array($body)) json_error('Expected a JSON object.');
        $id = (string)($body['id'] ?? '');
        if ($id === '') json_error('Which member?');

        // One field per request. Sending both would leave the order of two
        // rules — last-admin and approved-implies-admin — deciding the outcome.
        $hasApproved = array_key_exists('approved', $body);
        $hasAdmin    = array_key_exists('isAdmin', $body);
        if ($hasApproved === $hasAdmin) json_error('Send exactly one of approved or isAdmin.');

        if (!$hasApproved) json_out(member_set_admin($v, $id, (bool)$body['isAdmin']));

        $approve = (bool)$body['approved'];
        $res     = member_set_approved($v, $id, $approve);

        // Tell them the wait is over. Only on a real transition INTO approved:
        // un-approval is silent on purpose, and re-clicking approve must not
        // mail twice. Sent after the write, and its failure is logged rather
        // than raised — the approval is the durable thing, the email a courtesy,
        // and an admin who approved somebody correctly must not be shown an
        // error because a mail server was slow.
        if ($approve && $res['changed']) {
            $note = notify_member_approved_build($id);
            if ($note !== null) {
                $sent = mail_send($note['to'], $note['subject'], $note['html'], true);
                access_log($v->userId, $sent ? 'notified' : 'notify_failed', 'member', $id);
                $res['notified'] = $sent;
            } else {
                access_log($v->userId, 'notify_noaddress', 'member', $id);
                $res['notified'] = null;   // null: nobody to write to, not a failure
            }
        }
        json_out($res);
    }
} catch (MemberError $e) {
    json_error($e->getMessage(), $e->status);
}

json_error('GET or POST only.', 405);
