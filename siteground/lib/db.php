<?php
/**
 * Database handle. PDO with exceptions on, real prepared statements, utf8mb4.
 *
 * Portable SQL only in the application layer — the queries run unchanged on
 * SQLite, which is how tests/run.php exercises the privacy rules without a MySQL
 * server. Anything MySQL-specific belongs in sql/schema.mysql.sql, not here.
 */
declare(strict_types=1);

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $cfg = config();
    if (($cfg['db']['driver'] ?? 'mysql') === 'sqlite') {
        $pdo = new PDO('sqlite:' . $cfg['db']['path'], null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        return $pdo;
    }

    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $cfg['db']['host'], $cfg['db']['port'] ?? 3306, $cfg['db']['name']);
    $pdo = new PDO($dsn, $cfg['db']['user'], $cfg['db']['pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // Real server-side prepares, so a parameter can never be interpolated
        // into the statement text.
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function q1(string $sql, array $params = []): ?array
{
    $row = q($sql, $params)->fetch();
    return $row === false ? null : $row;
}

/** Log a decision. Used for refusals AND for would-be refusals while ENFORCE is off. */
function access_log(?string $userId, string $verdict, string $resource, ?string $detail = null): void
{
    try {
        q('INSERT INTO access_log (user_id, verdict, resource, detail) VALUES (?,?,?,?)',
          [$userId, $verdict, $resource, $detail]);
    } catch (Throwable) { /* logging must never break a request */ }
}

function uuid4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}
