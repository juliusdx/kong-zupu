<?php
/**
 * Direct edits to a person, as opposed to contributions.
 *
 * A contribution is somebody proposing a change; this is a reviewer making one.
 * Marking an entry verified, archiving a duplicate, restoring it — the actions
 * that have no proposer and no queue.
 *
 * THE SEED PROBLEM, which shapes everything here. The tree the family sees is
 * this table merged onto data/lineage.js, a 519-person public file transcribed
 * from the book. Most people in the tree therefore have no row at all. Archiving
 * one, or marking one verified, means creating the row first — the Supabase
 * client did this by posting a snapshot it built from the seed in the browser.
 *
 * That snapshot is not trusted here. The seed is a public file, so a caller
 * offering one reveals nothing, but it is still client-supplied data landing in
 * the gated table, and the interesting fields are exactly the dangerous ones.
 * So the server takes only descriptive columns from it and forces the three that
 * matter: a person materialised out of the public seed is `public`, not living,
 * not a minor. That is not a guess — tools/check_privacy.js fails the build if
 * anyone living or minor is in the seed, so it is an invariant we can rely on,
 * and asserting it here means a forged snapshot cannot smuggle a living relative
 * into public view.
 */
declare(strict_types=1);
require_once __DIR__ . '/repo.php';

/** Descriptive columns a caller may supply when materialising a seed person. */
const PERSON_SEED_COLS = [
    'gen', 'name', 'pinyin', 'ritual_name', 'formal_name', 'hao', 'milk_name', 'aka',
    'gender', 'father_id', 'spouse_of', 'birth_year', 'death_year', 'lifespan',
    'religion', 'relation', 'bio', 'birth_place', 'residence_place', 'burial_place',
    'lat', 'lng', 'confidence',
];

/** Columns a direct edit may change on an existing row. */
const PERSON_EDITABLE = [
    'gen', 'name', 'pinyin', 'ritual_name', 'formal_name', 'hao', 'milk_name', 'aka',
    'gender', 'father_id', 'spouse_of', 'birth_year', 'death_year', 'lifespan',
    'religion', 'relation', 'bio', 'birth_place', 'residence_place', 'burial_place',
    'lat', 'lng', 'confidence', 'living', 'is_minor', 'visibility',
];

class PersonError extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 400)
    {
        parent::__construct($message);
    }
}

/** Reviewers only, for every direct edit. The queue is the path for everyone else. */
function person_require_reviewer(Viewer $v, string $what, ?string $id): void
{
    if ($v->isAdmin) return;
    access_log($v->userId, 'refused', $what, $id);
    throw new PersonError('Reviewers only.', 403);
}

/**
 * Make sure a row exists for this person, creating it from the public seed if
 * not. Returns whether it had to create one.
 *
 * Separate from person_write() because archiving needs a row to exist without
 * being an edit to any field — an earlier version faked a field change to force
 * the row into being and silently overwrote `confidence` doing it.
 */
function person_materialise(string $id, array $seed): bool
{
    if (q1('SELECT id FROM persons WHERE id = ?', [$id])) return false;

    $row = ['id' => $id];
    foreach (PERSON_SEED_COLS as $c) if (array_key_exists($c, $seed)) $row[$c] = $seed[$c];
    if (($row['name'] ?? '') === '') throw new PersonError('That person is not in the tree.', 404);

    // Asserted, never accepted — see the note at the top of this file.
    $row['living']     = 0;
    $row['is_minor']   = 0;
    $row['visibility'] = 'public';
    $row['source']     = 'seed';

    $cols = array_keys($row);
    q('INSERT INTO persons (' . implode(',', $cols) . ') VALUES ('
      . implode(',', array_fill(0, count($cols), '?')) . ')', array_values($row));
    return true;
}

/**
 * Apply $fields to a person, creating the row from $seed if they exist only in
 * the public seed. Reviewers only — this is the unqueued path.
 */
function person_write(Viewer $v, string $id, array $fields, array $seed = []): array
{
    person_require_reviewer($v, 'person_write', $id);
    if ($id === '') throw new PersonError('Which person?');

    $set = [];
    foreach (PERSON_EDITABLE as $c) if (array_key_exists($c, $fields)) $set[$c] = $fields[$c];
    if (!$set) throw new PersonError('Nothing to change.');

    if (isset($set['visibility']) && !in_array($set['visibility'], ['public', 'member', 'admin'], true)) {
        throw new PersonError('Unknown visibility.');
    }

    db()->beginTransaction();
    try {
        $created = person_materialise($id, $seed);
        q('UPDATE persons SET ' . implode(', ', array_map(fn($c) => "{$c} = ?", array_keys($set)))
          . ' WHERE id = ?', [...array_values($set), $id]);
        db()->commit();
    } catch (Throwable $e) {
        db()->rollBack();
        throw $e;
    }

    access_log($v->userId, $created ? 'person_created' : 'person_edited', 'person', $id);
    return ['id' => $id, 'created' => $created, 'fields' => array_keys($set)];
}

/**
 * Take somebody out of the tree.
 *
 * Archiving rather than deleting, because the usual reason is a duplicate and
 * the usual next discovery is that it was not one. The row keeps everything it
 * had; `archived` is what removes the person from every reader — including, via
 * the tombstone in repo_persons(), their twin in the public seed.
 */
function person_archive(Viewer $v, string $id, ?string $reason, array $seed = []): array
{
    person_require_reviewer($v, 'person_archive', $id);
    if ($id === '') throw new PersonError('Which person?');

    db()->beginTransaction();
    try {
        $created = person_materialise($id, $seed);
        q('UPDATE persons SET archived = 1, archived_at = CURRENT_TIMESTAMP, archived_by = ?,
             archived_reason = ? WHERE id = ?', [$v->userId, $reason, $id]);
        db()->commit();
    } catch (Throwable $e) {
        db()->rollBack();
        throw $e;
    }

    access_log($v->userId, 'archived', 'person', $id);
    return ['id' => $id, 'archived' => true, 'created' => $created];
}

/** Put them back. The row never lost anything, so this only clears the flag. */
function person_restore(Viewer $v, string $id): array
{
    if (!$v->isAdmin) {
        access_log($v->userId, 'refused', 'person_restore', $id);
        throw new PersonError('Reviewers only.', 403);
    }
    if (!q1('SELECT id FROM persons WHERE id = ?', [$id])) throw new PersonError('No such person.', 404);
    q('UPDATE persons SET archived = 0, archived_at = NULL, archived_by = NULL,
         archived_reason = NULL WHERE id = ?', [$id]);
    access_log($v->userId, 'restored', 'person', $id);
    return ['id' => $id, 'archived' => false];
}

/**
 * The archived list, with who removed each person and when.
 *
 * The same accountability the review log has: an entry that vanished from the
 * family tree should say whose decision that was.
 */
function person_archived_list(Viewer $v): array
{
    if (!$v->isAdmin) {
        access_log($v->userId, 'refused', 'archived_list', null);
        throw new PersonError('Reviewers only.', 403);
    }
    $names = [];
    foreach (q('SELECT id, full_name, email FROM users')->fetchAll() as $u) {
        $names[(string)$u['id']] = ($u['full_name'] ?? '') !== '' ? (string)$u['full_name'] : (string)$u['email'];
    }
    $out = [];
    foreach (q('SELECT id, name, pinyin, gen, archived_at, archived_by, archived_reason
                  FROM persons WHERE archived = 1 ORDER BY archived_at DESC')->fetchAll() as $r) {
        $out[] = [
            'id'       => $r['id'],
            'name'     => $r['name'],
            'pinyin'   => $r['pinyin'],
            'gen'      => $r['gen'],
            'archivedAt'     => $r['archived_at'],
            'archivedBy'     => $r['archived_by'],
            'archivedByName' => $r['archived_by'] !== null ? ($names[(string)$r['archived_by']] ?? null) : null,
            'archivedReason' => $r['archived_reason'],
        ];
    }
    return $out;
}
