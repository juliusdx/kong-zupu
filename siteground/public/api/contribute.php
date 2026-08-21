<?php
/**
 * Submit a contribution. Open to signed-out visitors on purpose: the relatives
 * who remember the most are the least likely to hold an account, and nothing
 * submitted here reaches the tree until an admin approves it.
 *
 * Replaces the front-end's direct POST to the Supabase contributions table.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../lib/contributions.php';
require_once __DIR__ . '/../../lib/auth.php';   // sql_now(), which is portable across both drivers

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_error('POST only.', 405);

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 256 * 1024) json_error('Submission too large.', 413);
$body = json_decode($raw ?: '[]', true);
if (!is_array($body)) json_error('Expected a JSON object.');

// One submission per address per minute. A form anyone may post to is a form
// anyone may flood, and the queue is read by a person.
$ip = client_ip();
$recent = q1("SELECT COUNT(*) AS n FROM access_log
               WHERE resource = 'contribute' AND detail = ? AND at > ?",
             [$ip, sql_now(-60)]);
if ((int)($recent['n'] ?? 0) >= 5) {
    access_log(null, 'refused', 'contribute', $ip);
    json_error('Too many submissions just now. Please wait a moment.', 429);
}

$v = viewer();
try {
    $id = contribution_submit($body, $v->userId);
} catch (ContribError $e) {
    json_error($e->getMessage(), $e->status);
}
access_log($v->userId, 'submitted', 'contribute', $ip);

json_out(['ok' => true, 'id' => $id, 'status' => 'pending']);
