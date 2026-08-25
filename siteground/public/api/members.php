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

        json_out($hasApproved
            ? member_set_approved($v, $id, (bool)$body['approved'])
            : member_set_admin($v, $id, (bool)$body['isAdmin']));
    }
} catch (MemberError $e) {
    json_error($e->getMessage(), $e->status);
}

json_error('GET or POST only.', 405);
