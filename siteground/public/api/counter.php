<?php
/**
 * The visitor count in the header.
 *
 *   GET            read it
 *   POST {bump:1}  count this visit, then read it
 *
 * Open to anonymous visitors on purpose: counting only signed-in relatives
 * would make the number meaningless for a site whose whole point is that
 * distant family can find it. It carries no personal data — one row, one
 * integer — so there is nothing here to gate.
 *
 * The browser decides what a visit is (a sessionStorage flag, so a reload is
 * not a new one), which means the number is honest about roughly how many
 * people came and makes no claim to be more precise than that.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../lib/bootstrap.php';

const COUNTER_KEY = 'site_visits';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $body = json_decode(file_get_contents('php://input') ?: '[]', true);
    if (is_array($body) && !empty($body['bump'])) {
        // One statement, so two visits landing together cannot read the same
        // value and both write back the same increment. The upsert is spelled
        // differently by the two engines this runs on — MySQL in production,
        // SQLite under the tests — and there is no portable form.
        $sqlite = (config()['db']['driver'] ?? 'mysql') === 'sqlite';
        q($sqlite
            ? 'INSERT INTO counters (key, value) VALUES (?, 1)
                 ON CONFLICT(key) DO UPDATE SET value = value + 1'
            : 'INSERT INTO counters (`key`, value) VALUES (?, 1)
                 ON DUPLICATE KEY UPDATE value = value + 1',
          [COUNTER_KEY]);
    }
}

// `key` is reserved in MySQL and must be quoted; SQLite accepts the backticks
// too, so one spelling works on both.
$row = q1('SELECT value FROM counters WHERE `key` = ?', [COUNTER_KEY]);
json_out(['count' => (int)($row['value'] ?? 0)]);
