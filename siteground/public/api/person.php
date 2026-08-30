<?php
/**
 * Direct edits to a person — the actions with no queue behind them.
 *
 *   GET  ?archived=1                    the archived list (reviewers)
 *   POST {id, fields, seed}             apply an edit
 *   POST {id, action:"archive", reason} take them out of the tree
 *   POST {id, action:"restore"}         put them back
 *   POST {action:"merge", keepId, dupId, relink[]}  fold one into the other
 *
 * `seed` is the person as the PUBLIC file data/lineage.js has them, sent when
 * the tree shows somebody who has no row yet. lib/persons.php takes only
 * descriptive columns from it and asserts the privacy ones, so a forged seed
 * cannot publish a living relative.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../lib/persons.php';

$v = viewer();

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        if (($_GET['archived'] ?? '') !== '') json_out(['archived' => person_archived_list($v)]);
        json_error('Nothing to get here.', 404);
    }

    $body = json_decode(file_get_contents('php://input') ?: '[]', true);
    if (!is_array($body)) json_error('Expected a JSON object.');

    $id     = (string)($body['id'] ?? '');
    $action = (string)($body['action'] ?? 'edit');
    $seed   = is_array($body['seed'] ?? null) ? $body['seed'] : [];

    if ($action === 'archive') {
        $reason = ($body['reason'] ?? '') !== '' ? (string)$body['reason'] : null;
        json_out(person_archive($v, $id, $reason, $seed));
    }
    if ($action === 'restore') json_out(person_restore($v, $id));
    if ($action === 'merge') {
        json_out(person_merge($v, (string)($body['keepId'] ?? ''), (string)($body['dupId'] ?? ''), $body));
    }
    if ($action === 'edit') {
        $fields = is_array($body['fields'] ?? null) ? $body['fields'] : [];
        json_out(person_write($v, $id, $fields, $seed));
    }
    json_error('Unknown action.', 400);
} catch (PersonError $e) {
    // Every write above runs in a transaction, so a refusal has already rolled
    // back and the tree is untouched. Say what was wrong and leave it.
    json_error($e->getMessage(), $e->status);
}
