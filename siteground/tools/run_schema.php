<?php
/**
 * Run sql/schema.mysql.sql against the configured database. All statements in
 * the schema are IF NOT EXISTS / REPLACE-safe, so this can be re-run — on
 * deploy day and again at cutover without fear.
 *
 *     php tools/run_schema.php
 */
declare(strict_types=1);
require_once __DIR__ . '/../lib/bootstrap.php';

if ((config()['db']['driver'] ?? '') !== 'mysql') {
    fwrite(STDERR, "refusing: config is not mysql\n");
    exit(1);
}

$sql = file_get_contents(__DIR__ . '/../sql/schema.mysql.sql');
if ($sql === false) { fwrite(STDERR, "schema file missing\n"); exit(1); }

// The schema holds plain statements only (no routines, no triggers), so a
// semicolon-at-end-of-line split is safe; comments are stripped first.
$sql = preg_replace('/^--.*$/m', '', $sql);
$stmts = array_filter(array_map('trim', preg_split("/;\s*\n/", $sql)));

$n = 0;
foreach ($stmts as $st) {
    if ($st === '' || $st === 'SET NAMES utf8mb4') {
        db()->exec($st === '' ? '' : $st);
        continue;
    }
    db()->exec($st);
    $n++;
    echo 'ok: ', substr(preg_replace('/\s+/', ' ', $st), 0, 60), "…\n";
}

$tables = db()->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
echo "\ndone — $n statements, tables now:\n";
foreach ($tables as $t) printf("  %-20s %d rows\n", $t, (int)q1("SELECT COUNT(*) c FROM `$t`")['c']);
