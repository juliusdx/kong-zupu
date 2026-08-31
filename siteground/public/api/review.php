<?php
/**
 * The reviewer's queue, and the decision.
 *
 *   GET  ?status=pending|decided   list contributions
 *   POST {id, status, reason, seeds}  approve or reject one
 *
 * `seeds` maps a person id to that person as the PUBLIC data/lineage.js has
 * them, for targets with no database row yet. See contrib_edit_person().
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
require_once __DIR__ . '/../../lib/notify.php';

$v = viewer();
if (!$v->isAdmin) { access_log($v->userId, 'refused', 'review', null); json_error('Reviewers only.', 403); }

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $which = ($_GET['status'] ?? 'pending') === 'pending' ? 'pending' : 'decided';
    $rows = $which === 'pending'
        ? q("SELECT * FROM contributions WHERE status = 'pending' ORDER BY created_at DESC")->fetchAll()
        : q("SELECT * FROM contributions WHERE status <> 'pending' ORDER BY reviewed_at DESC LIMIT 50")->fetchAll();

    // Name the reviewers in one pass rather than per row. The log says "who
    // decided this" as well as "what changed", and with more than one person
    // approving now, a bare uuid answers neither.
    $names = [];
    foreach (q('SELECT id, full_name, email FROM users')->fetchAll() as $u) {
        $names[(string)$u['id']] = $u['full_name'] !== null && $u['full_name'] !== ''
            ? (string)$u['full_name'] : (string)$u['email'];
    }

    $out = [];
    foreach ($rows as $r) {
        $payload = json_decode((string)$r['payload'], true) ?: [];
        $item = [
            'id'        => $r['id'],
            'status'    => $r['status'],
            'createdAt' => $r['created_at'],
            'payload'   => $payload,
            'reviewedBy'=> $r['reviewed_by'],
            'reviewedByName' => $r['reviewed_by'] !== null ? ($names[(string)$r['reviewed_by']] ?? null) : null,
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
        // Build the note BEFORE deciding: an approval can rewrite the payload's
        // subject, and a rejection reason belongs to this decision, but the
        // contributor's address and what they submitted are what they are now.
        $reason = $body['reason'] ?? null;
        $note   = notify_contributor_build($id, $status, $reason);

        // `seeds` is how a correction to somebody who exists only in the public
        // data/lineage.js gets applied: the reviewer's browser has the merged
        // tree, the server has only the 322 rows, and most corrections are to
        // one of the other 197.
        $seeds  = is_array($body['seeds'] ?? null) ? $body['seeds'] : [];
        $report = contribution_decide($v, $id, $status, $reason, $seeds);

        // The decision is the durable thing; the email is a courtesy. It is
        // sent after the transaction has committed and its failure is logged
        // rather than raised — a reviewer who approved something correctly must
        // not be told it failed because a mail server was slow.
        if ($note !== null) {
            $sent = mail_send($note['to'], $note['subject'], $note['html'], true);
            access_log($v->userId, $sent ? 'notified' : 'notify_failed', 'contribution', $id);
            $report['notified'] = $sent;
        } else {
            access_log($v->userId, 'notify_noaddress', 'contribution', $id);
            $report['notified'] = null;   // null: nobody to write to, not a failure
        }
        json_out($report);
    } catch (ContribError $e) {
        // The decision runs in a transaction, so a refusal here has already
        // rolled back: the contribution is still pending and the tree is
        // untouched. Say what was wrong and leave it for the reviewer.
        json_error($e->getMessage(), $e->status);
    }
}

json_error('GET or POST only.', 405);
