<?php
/**
 * Contributions: the submit, and the decision that puts one onto the tree.
 *
 * Everything that WRITES to persons/places/media as a result of a contribution
 * lives here, for the same reason every read lives in repo.php: one definition,
 * one place to get it right, one place to look when it is wrong.
 *
 * Two things this file is careful about, both of them scars.
 *
 * 1. THE TARGET. The form has one picker whose meaning changes with the action —
 *    the parent when adding a child, the person being overwritten when correcting
 *    one. Relatives filled it in as though adding a child and the approval wrote
 *    the new person's details onto their ancestor. 江八郎 became 江萬里; 大信
 *    became 永宏. The generation is therefore DERIVED from the relative here and
 *    never taken from the payload, and a correction that replaces the target's
 *    name outright is reported back so a human confirms it rather than a form.
 *
 * 2. THE SECOND TABLE. A living member's birth year and bio live in
 *    person_details, which is merged ON TOP of the persons row when the tree is
 *    read. An edit that wrote only to persons looked like it worked and silently
 *    reverted on the next load — one relative tried the same birth year ten
 *    times. Any write to those two fields updates both tables or neither.
 *
 * The whole decision runs in a transaction, which the Supabase version could not
 * do: there, a person could be inserted and the re-parent that followed could
 * fail, leaving them attached to nothing. Here it either all lands or none does.
 */
declare(strict_types=1);
require_once __DIR__ . '/repo.php';

/**
 * A contribution that cannot be applied. Carries the status an endpoint should
 * report, but throws rather than exits so the decision logic can be tested and
 * so a failure mid-transaction rolls back instead of ending the process.
 */
final class ContribError extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 400)
    {
        parent::__construct($message);
    }
}

/** Fields a submitter is allowed to blank. Empty values are dropped from the
 *  payload before it is stored, so the intent to clear arrives as a list of
 *  names instead — and that list is the only way a field can be nulled. */
const CLEARABLE = [
    'pinyin'     => 'pinyin',
    'ritualName' => 'ritual_name',
    'milkName'   => 'milk_name',
    'aka'        => 'aka',
    'birth'      => 'birth_year',
    'bio'        => 'bio',
];

// ---------------------------------------------------------------- submit ----

/**
 * Store a contribution for review. Deliberately open to signed-out visitors:
 * the older relatives who know the most are the least likely to have accounts.
 * Nothing here reaches the tree until an admin approves it.
 */
function contribution_submit(array $payload, ?string $userId): string
{
    $action = (string)($payload['action'] ?? '');
    if (!in_array($action, ['add_child', 'add_spouse', 'edit', 'add_place'], true)) {
        throw new ContribError('Unknown contribution type.');
    }
    if ($action !== 'add_place' && ($payload['relatedTo'] ?? '') === '') {
        throw new ContribError('A contribution must say who it relates to.');
    }
    // Store the payload as sent. Interpreting it is the reviewer's step, not
    // this one — and the raw submission is the evidence if a decision is wrong.
    $id = uuid4();
    q('INSERT INTO contributions (id, payload, status, submitted_by) VALUES (?, ?, ?, ?)',
      [$id, json_encode($payload, JSON_UNESCAPED_UNICODE), 'pending', $userId]);
    return $id;
}

// ---------------------------------------------------------------- decide ----

/**
 * Approve or reject. Returns a short report of what it did, so the caller can
 * show the reviewer the consequence rather than a bare "ok".
 */
function contribution_decide(Viewer $v, string $id, string $status, ?string $reason = null): array
{
    if (!$v->isAdmin) { access_log($v->userId, 'refused', 'contribution', $id); throw new ContribError('Reviewers only.', 403); }
    if (!in_array($status, ['approved', 'rejected'], true)) throw new ContribError('Decision must be approved or rejected.');

    $row = q1('SELECT * FROM contributions WHERE id = ?', [$id]);
    if (!$row) throw new ContribError('No such contribution.', 404);
    if ($row['status'] !== 'pending') throw new ContribError('That contribution was already ' . $row['status'] . '.', 409);

    $payload = json_decode((string)$row['payload'], true) ?: [];
    $report  = ['id' => $id, 'status' => $status, 'applied' => []];

    db()->beginTransaction();
    try {
        if ($status === 'approved') {
            $action = (string)($payload['action'] ?? '');
            if ($action === 'add_child' || $action === 'add_spouse') {
                $report['applied'][] = contrib_add_person($id, $payload, $action);
            } elseif ($action === 'edit') {
                $report['applied'][] = contrib_edit_person($payload);
            } elseif ($action === 'add_place') {
                $report['applied'][] = contrib_add_place($id, $payload);
            }
        }
        q('UPDATE contributions SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
             rejection_reason = ? WHERE id = ?',
          [$status, $v->userId, $status === 'rejected' ? $reason : null, $id]);
        db()->commit();
    } catch (Throwable $e) {
        db()->rollBack();
        throw $e;
    }
    access_log($v->userId, $status, 'contribution', $id);
    return $report;
}

/**
 * Does approving this correction replace the target's name with an unrelated
 * one? That is the signature of a mistargeted submission, and it is how two
 * ancestors were overwritten. The caller shows this to a human before deciding;
 * it is not a refusal, because sometimes a name really is being corrected.
 */
function contribution_rename_warning(array $payload): ?array
{
    if (($payload['action'] ?? '') !== 'edit' || ($payload['name'] ?? '') === '') return null;
    $target = q1('SELECT id, name, pinyin FROM persons WHERE id = ?', [$payload['relatedTo'] ?? '']);
    if (!$target) return null;
    $cur = trim((string)$target['name']);
    $new = trim((string)$payload['name']);
    if ($cur === '' || $new === '' || $cur === $new) return null;
    // Substrings are a normal refinement — 起瀾 becoming 江起瀾公 is the same man.
    if (str_contains($new, $cur) || str_contains($cur, $new)) return null;
    return ['personId' => $target['id'], 'from' => $cur, 'to' => $new, 'pinyin' => $target['pinyin']];
}

// ------------------------------------------------------------- the writes ---

function contrib_add_person(string $contribId, array $payload, string $action): array
{
    $living = ($payload['living'] ?? null) === 'true' || ($payload['living'] ?? null) === true;
    $row = [
        'id'          => 'c_' . substr($contribId, 0, 8),
        'name'        => ($payload['name'] ?? '') !== '' ? $payload['name'] : '(unnamed)',
        'pinyin'      => $payload['pinyin']     ?? null,
        'ritual_name' => $payload['ritualName'] ?? null,
        'milk_name'   => $payload['milkName']   ?? null,
        'aka'         => $payload['aka']        ?? null,
        'gender'      => in_array($payload['gender'] ?? '', ['m','f'], true) ? $payload['gender'] : 'm',
        // Derived from the relative, never from the payload. See the note at the top.
        'gen'         => contrib_rel_gen($action, $payload['relatedTo'] ?? null, $payload['gen'] ?? null),
        'bio'         => $payload['bio']   ?? null,
        'birth_year'  => $payload['birth'] ?? null,
        'living'      => $living ? 1 : 0,
        'visibility'  => $living ? 'member' : 'public',
        'confidence'  => 'low',
        'source'      => 'contribution',
    ];
    if ($action === 'add_spouse') $row['spouse_of'] = $payload['relatedTo'] ?? null;
    else                          $row['father_id'] = $payload['relatedTo'] ?? null;

    $lat = filter_var($payload['lat'] ?? null, FILTER_VALIDATE_FLOAT);
    $lng = filter_var($payload['lng'] ?? null, FILTER_VALIDATE_FLOAT);
    if ($lat !== false && $lng !== false) { $row['lat'] = $lat; $row['lng'] = $lng; }

    $cols = implode(',', array_keys($row));
    $qs   = implode(',', array_fill(0, count($row), '?'));
    q("INSERT INTO persons ({$cols}) VALUES ({$qs})", array_values($row));

    // A living person's detail belongs in the gated table as well as the row.
    if ($living && (($row['birth_year'] ?? null) !== null || ($row['bio'] ?? null) !== null)) {
        contrib_write_detail($row['id'], ['birth_year' => $row['birth_year'], 'bio' => $row['bio']]);
    }
    return ['added' => $row['id'], 'name' => $row['name'], 'gen' => $row['gen'],
            'visibility' => $row['visibility']];
}

function contrib_edit_person(array $payload): array
{
    $pid = (string)($payload['relatedTo'] ?? '');
    if ($pid === '') throw new ContribError("This correction doesn't say which person it edits.");
    $cur = q1('SELECT * FROM persons WHERE id = ?', [$pid]);
    if (!$cur) throw new ContribError('Unknown person for this correction: ' . $pid, 404);

    $has    = fn(string $k) => array_key_exists($k, $payload);
    $fields = [];
    // name is NOT NULL — a correction may change it but never blank it.
    if (($payload['name'] ?? '') !== '') $fields['name'] = $payload['name'];
    if ($has('pinyin'))     $fields['pinyin']      = $payload['pinyin']     ?: null;
    if ($has('ritualName')) $fields['ritual_name'] = $payload['ritualName'] ?: null;
    if ($has('milkName'))   $fields['milk_name']   = $payload['milkName']   ?: null;
    if ($has('aka'))        $fields['aka']         = $payload['aka']        ?: null;
    if (in_array($payload['gender'] ?? '', ['m','f'], true)) $fields['gender'] = $payload['gender'];
    if ($has('birth'))      $fields['birth_year']  = $payload['birth'] ?: null;
    if ($has('bio'))        $fields['bio']         = $payload['bio']   ?: null;
    if ($has('living')) {
        $live = $payload['living'] === 'true' || $payload['living'] === true;
        $fields['living']     = $live ? 1 : 0;
        $fields['visibility'] = $live ? 'member' : 'public';
    }
    // A hand-typed generation is ignored: the tree derives it from parentage, and
    // letting a form override that is how people end up floating a level away
    // from their own father. Skipped entirely when the same correction re-parents
    // them, because the move sets it.
    if ($has('gen') && $payload['gen'] !== '' && empty($payload['moveTo'])) {
        $dad = $cur['father_id'] ? q1('SELECT gen FROM persons WHERE id = ?', [$cur['father_id']]) : null;
        $fields['gen'] = ($dad && $dad['gen'] !== null) ? (int)$dad['gen'] + 1 : (int)$payload['gen'];
    }
    $lat = filter_var($payload['lat'] ?? null, FILTER_VALIDATE_FLOAT);
    $lng = filter_var($payload['lng'] ?? null, FILTER_VALIDATE_FLOAT);
    if ($lat !== false && $lng !== false) { $fields['lat'] = $lat; $fields['lng'] = $lng; }

    // Deliberate blanks arrive as a list of names, because the payload drops
    // empty values before it is stored.
    $cleared = is_array($payload['cleared'] ?? null) ? $payload['cleared'] : [];
    foreach ($cleared as $f) {
        if (isset(CLEARABLE[$f])) $fields[CLEARABLE[$f]] = null;
    }

    if ($fields) {
        $set = implode(', ', array_map(fn($c) => "{$c} = ?", array_keys($fields)));
        q("UPDATE persons SET {$set} WHERE id = ?", [...array_values($fields), $pid]);
    }

    // Keep person_details in step or the edit reverts on the next read.
    $detail = [];
    if ($has('birth')) $detail['birth_year'] = $payload['birth'] ?: null;
    if ($has('bio'))   $detail['bio']        = $payload['bio']   ?: null;
    foreach ($cleared as $f) {
        if ($f === 'birth') $detail['birth_year'] = null;
        if ($f === 'bio')   $detail['bio']        = null;
    }
    if ($detail) contrib_write_detail($pid, $detail);

    $moved = null;
    if (!empty($payload['moveTo'])) {
        $moved = contrib_apply_move($pid, (string)($payload['moveRel'] ?? 'child'), (string)$payload['moveTo']);
    }
    return array_filter([
        'edited'  => $pid,
        'fields'  => array_keys($fields),
        'cleared' => $cleared ?: null,
        'moved'   => $moved,
    ], fn($x) => $x !== null);
}

function contrib_add_place(string $contribId, array $payload): array
{
    // A place may arrive with no pin. Half the graves in the book are recorded
    // only as a 土名 and nobody alive knows where that is on a modern map;
    // refusing those would either lose the fact or invite an invented
    // coordinate, which is worse than an honest blank.
    $lat = filter_var($payload['lat'] ?? null, FILTER_VALIDATE_FLOAT);
    $lng = filter_var($payload['lng'] ?? null, FILTER_VALIDATE_FLOAT);
    $located = $lat !== false && $lng !== false;
    $id = 'pl_' . substr($contribId, 0, 8);
    // The column is constrained to these; check here so a bad value is a clear
    // refusal at the door rather than a constraint violation halfway through.
    $type = (string)($payload['placeType'] ?? 'residence');
    if (!in_array($type, ['origin','residence','grave','church_grave','hall','diaspora'], true)) {
        throw new ContribError('Unknown place type: ' . $type);
    }
    q('INSERT INTO places (id, type, name, name_en, lat, lng, approximate, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        $id,
        $type,
        ($payload['name'] ?? '') !== '' ? $payload['name'] : '(unnamed)',
        $payload['nameEn'] ?? null,
        $located ? $lat : null,
        $located ? $lng : null,
        $located ? 0 : 1,
        $payload['note'] ?? null,
    ]);
    return ['place' => $id, 'located' => $located];
}

// ------------------------------------------------------------- the moves ----

/** A child sits one below; a spouse and a sibling sit level. */
function contrib_gen_for(string $rel, ?int $targetGen): ?int
{
    if ($targetGen === null) return null;
    if ($rel === 'child')  return $targetGen + 1;
    if ($rel === 'parent') return $targetGen - 1;
    return $targetGen;
}

/** Generation for a NEW person, taken from the relative they were hung on. A
 *  submitted number is a last resort, used only when the relative has none. */
function contrib_rel_gen(string $action, ?string $relatedTo, $submitted): ?int
{
    if ($relatedTo) {
        $rel = q1('SELECT gen FROM persons WHERE id = ?', [$relatedTo]);
        if ($rel && $rel['gen'] !== null) {
            return $action === 'add_spouse' ? (int)$rel['gen'] : (int)$rel['gen'] + 1;
        }
    }
    return ($submitted === null || $submitted === '') ? null : (int)$submitted;
}

/** Everyone below a person, by blood. Spouses are attached separately because
 *  they move with the family without being descended from it. */
function contrib_descendants(string $id): array
{
    $out = [];
    $queue = [$id];
    $guard = 0;
    while ($queue) {
        $cur = array_shift($queue);
        if (++$guard > 10000) break;                      // cycles cannot outrun this
        foreach (q('SELECT id FROM persons WHERE father_id = ? AND spouse_of IS NULL', [$cur])->fetchAll() as $k) {
            if (in_array($k['id'], $out, true)) continue;
            $out[] = $k['id'];
            $queue[] = $k['id'];
        }
    }
    return $out;
}

/**
 * Re-hang a person, and carry everyone below them to the new depth.
 *
 * Refuses to move someone under their own descendant: that detaches the whole
 * branch from the tree and there is no undo a relative could reach for.
 */
function contrib_apply_move(string $pid, string $rel, string $targetId): array
{
    $p = q1('SELECT id, gen, father_id FROM persons WHERE id = ?', [$pid]);
    $t = q1('SELECT id, gen, father_id FROM persons WHERE id = ?', [$targetId]);
    if (!$p) throw new ContribError('Unknown person for this move: ' . $pid, 404);
    if (!$t) throw new ContribError('Unknown target for this move: ' . $targetId, 404);
    if (in_array($targetId, contrib_descendants($pid), true)) {
        throw new ContribError('That would move someone underneath their own descendant.', 409);
    }
    $g = contrib_gen_for($rel, $t['gen'] === null ? null : (int)$t['gen']);
    $fields = ['gen' => $g];
    if ($rel === 'child')        { $fields['father_id'] = $t['id'];         $fields['spouse_of'] = null; }
    elseif ($rel === 'spouse')   { $fields['spouse_of'] = $t['id'];         $fields['father_id'] = null; }
    elseif ($rel === 'sibling')  { $fields['father_id'] = $t['father_id'];  $fields['spouse_of'] = null; }
    else throw new ContribError('A move must be child, spouse or sibling.');

    $set = implode(', ', array_map(fn($c) => "{$c} = ?", array_keys($fields)));
    q("UPDATE persons SET {$set} WHERE id = ?", [...array_values($fields), $pid]);

    $delta = ($g === null || $p['gen'] === null) ? 0 : $g - (int)$p['gen'];
    $n = $delta ? contrib_cascade_gen($pid, $delta) : 0;
    return ['to' => $targetId, 'as' => $rel, 'gen' => $g, 'shifted' => $n];
}

/** Shift a whole branch by the same amount, spouses included. */
function contrib_cascade_gen(string $rootId, int $delta): int
{
    if (!$delta) return 0;
    $kin = contrib_descendants($rootId);
    $in  = array_merge([$rootId], $kin);
    $ph  = implode(',', array_fill(0, count($in), '?'));
    foreach (q("SELECT id FROM persons WHERE spouse_of IN ({$ph})", $in)->fetchAll() as $sp) {
        if (!in_array($sp['id'], $kin, true)) $kin[] = $sp['id'];
    }
    $n = 0;
    foreach ($kin as $kid) {
        $row = q1('SELECT gen FROM persons WHERE id = ?', [$kid]);
        if (!$row || $row['gen'] === null) continue;
        q('UPDATE persons SET gen = ? WHERE id = ?', [(int)$row['gen'] + $delta, $kid]);
        $n++;
    }
    return $n;
}

/** Insert-or-update the gated detail row. Split out because forgetting it is
 *  the mistake that made ten identical corrections look like they had failed. */
function contrib_write_detail(string $personId, array $detail): void
{
    $existing = q1('SELECT person_id FROM person_details WHERE person_id = ?', [$personId]);
    if ($existing) {
        $set = implode(', ', array_map(fn($c) => "{$c} = ?", array_keys($detail)));
        q("UPDATE person_details SET {$set} WHERE person_id = ?", [...array_values($detail), $personId]);
    } else {
        $detail['person_id'] = $personId;
        $cols = implode(',', array_keys($detail));
        $qs   = implode(',', array_fill(0, count($detail), '?'));
        q("INSERT INTO person_details ({$cols}) VALUES ({$qs})", array_values($detail));
    }
}
