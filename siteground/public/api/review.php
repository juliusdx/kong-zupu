<?php
/**
 * The reviewer's queue, and the decision.
 *
 *   GET  ?status=pending|decided   list contributions
 *   POST {id, status, reason}      approve or reject one
 *
 * A GET on a pending item carries `renameWarning` when approving it would
 * replace the target's name with an unrelated one. That is the shape of a
 * mistargeted submission — the form has one picker whose meaning changes with
 * the action — and it is how 江八郎 and 大信 were overwritten. It is surfaced
 * rather than refused, because sometimes a name really is being corrected; the
 * point is that a person sees the swap in words before agreeing to it.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../lib/contributions.php';

$v = viewer();
if (!$v->isAdmin) { access_log($v->userId, 'refused', 'review', null); json_error('Reviewers only.', 403); }

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $which = ($_GET['status'] ?? 'pending') === 'pending' ? 'pending' : 'decided';
    $rows = $which === 'pending'
        ? q("SELECT * FROM contributions WHERE status = 'pending' ORDER BY created_at DESC")->fetchAll()
        : q("SELECT * FROM contributions WHERE status <> 'pending' ORDER BY reviewed_at DESC LIMIT 50")->fetchAll();

    $out = [];
    foreach ($rows as $r) {
        $payload = json_decode((string)$r['payload'], true) ?: [];
        $item = [
            'id'        => $r['id'],
            'status'    => $r['status'],
            'createdAt' => $r['created_at'],
            'payload'   => $payload,
            'reviewedBy'=> $r['reviewed_by'],
            'reviewedAt'=> $r['reviewed_at'],
            'reason'    => $r['rejection_reason'],
        ];
        if ($r['status'] === 'pending') {
            // Name the person this actually lands on. A reviewer trusting the
            // submitted name rather than the target is how the wrong ancestor
            // gets overwritten.
            $t = ($payload['relatedTo'] ?? '') !== ''
                ? q1('SELECT id, name, pinyin, gen FROM persons WHERE id = ?', [$payload['relatedTo']])
                : null;
            $item['target'] = $t;
            $item['renameWarning'] = contribution_rename_warning($payload);
            // A payload with no `changes` was never prefilled from the target,
            // which usually means the picker was pointing somewhere else.
            $item['unprefilled'] = ($payload['action'] ?? '') === 'edit' && empty($payload['changes']);
        }
        $out[] = $item;
    }
    json_out(['contributions' => $out]);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input') ?: '[]', true);
    if (!is_array($body)) json_error('Expected a JSON object.');
    $id     = (string)($body['id'] ?? '');
    $status = (string)($body['status'] ?? '');
    if ($id === '') json_error('Which contribution?');
    try {
        json_out(contribution_decide($v, $id, $status, $body['reason'] ?? null));
    } catch (ContribError $e) {
        // The decision runs in a transaction, so a refusal here has already
        // rolled back: the contribution is still pending and the tree is
        // untouched. Say what was wrong and leave it for the reviewer.
        json_error($e->getMessage(), $e->status);
    }
}

json_error('GET or POST only.', 405);
