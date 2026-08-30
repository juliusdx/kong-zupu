<?php
/**
 * The gated people, so an admin can check none of them are in the public file.
 *
 * data/lineage.js ships to a world-readable repo and carries no privacy flags
 * at all, while the persons table carries `living` and `is_minor` and gates on
 * them. Nothing structurally keeps the two apart — one record (漢能) had already
 * crossed over once — so the check is: is anybody gated here also present in
 * that file?
 *
 * The comparison stays in the browser, which is where the public file already
 * is. This endpoint answers only the half the browser cannot know: who is
 * gated. Admins only, because that list is the private half.
 *
 * Note what "clean" is worth: a run that returns nothing gated proves nothing,
 * so the caller is told the count and treats an empty answer as a failed check
 * rather than a pass — the same reasoning tools/check_privacy.js uses when it
 * refuses to pass on a key that cannot see gated rows.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../lib/repo.php';

$v = viewer();
if (!$v->isAdmin) { access_log($v->userId, 'refused', 'privacy_check', null); json_error('Reviewers only.', 403); }

$rows = q("SELECT id, name, living, is_minor, visibility, archived
             FROM persons WHERE living = 1 OR is_minor = 1")->fetchAll();

$out = array_map(fn($r) => [
    'id'         => $r['id'],
    'name'       => $r['name'],
    'living'     => (bool)$r['living'],
    'is_minor'   => (bool)$r['is_minor'],
    'visibility' => $r['visibility'],
    'archived'   => (bool)$r['archived'],
], $rows);

json_out(['gated' => $out, 'count' => count($out)]);
