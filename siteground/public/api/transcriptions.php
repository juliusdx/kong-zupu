<?php
/**
 * Approved corrections to the page transcriptions.
 *
 *   GET ?doc=book_pt1   the corrections for one document
 *
 * Public, because the transcriptions themselves are: the bilingual pages and
 * the page scans are readable without signing in by the family's own decision,
 * and a correction to a page of a 19th-century book is the same kind of thing.
 * Only SUBMITTING one goes through the contribution queue, and only a reviewer
 * approving it writes a row here.
 *
 * The seed transcription lives in the static data/transcription.js and is not
 * touched; this table holds only what a person has since corrected, and the
 * page shows it on top.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../lib/bootstrap.php';

$doc = (string)($_GET['doc'] ?? '');
if ($doc !== '' && !preg_match('/^[a-z0-9_]{1,64}$/i', $doc)) json_error('bad doc id');

$rows = $doc !== ''
    ? q('SELECT doc_id, page, text, updated_at FROM transcriptions WHERE doc_id = ? ORDER BY page', [$doc])->fetchAll()
    : q('SELECT doc_id, page, text, updated_at FROM transcriptions ORDER BY doc_id, page')->fetchAll();

json_out(['transcriptions' => array_map(fn($r) => [
    'docId'     => $r['doc_id'],
    'page'      => (int)$r['page'],
    'text'      => $r['text'],
    'updatedAt' => $r['updated_at'],
], $rows)]);
