<?php
/**
 * Put a new MySQL password into config.php, without it ever touching a command
 * line, a shell history, or a chat log.
 *
 *   ssh zupu 'cd ~/www/zupu.accme.my && php tools/set_db_password.php'
 *   (it prompts; or pipe the password in on stdin)
 *
 * Change the password in Site Tools FIRST, then run this to update the file.
 *
 * It backs up config.php, tests the new credentials BEFORE writing, and refuses
 * if they do not work — so a mistyped password leaves the site running on the
 * old file rather than taking it down.
 *
 * The 1045 trap, which cost hours once: MySQL reports a NONEXISTENT USER with
 * the same "Access denied" it uses for a wrong password. If this refuses, check
 * the USERNAME against the panel character by character before touching the
 * password again — config.php once held upjzie6jrksppi for upjzie6jrkspi.
 */
declare(strict_types=1);

$file = __DIR__ . '/../config.php';
if (!is_file($file)) { fwrite(STDERR, "no config.php beside tools/\n"); exit(1); }

$cfg = require $file;
$db  = $cfg['db'] ?? [];
fwrite(STDERR, "host={$db['host']} db={$db['name']} user={$db['user']}\n");
fwrite(STDERR, "new password (not echoed): ");

// Read without echoing when we have a terminal; accept a pipe otherwise.
if (stream_isatty(STDIN)) { shell_exec('stty -echo'); $pw = trim((string)fgets(STDIN)); shell_exec('stty echo'); fwrite(STDERR, "\n"); }
else                      { $pw = trim((string)fgets(STDIN)); }
if ($pw === '') { fwrite(STDERR, "nothing entered; unchanged\n"); exit(1); }

// Prove it works before writing anything.
try {
    new PDO("mysql:host={$db['host']};port=" . ($db['port'] ?? 3306) . ";dbname={$db['name']};charset=utf8mb4",
            $db['user'], $pw, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (PDOException $e) {
    fwrite(STDERR, "\nREFUSING — those credentials do not connect:\n  " . $e->getMessage() . "\n\n");
    if (str_contains($e->getMessage(), '1045')) {
        fwrite(STDERR, "1045 means EITHER a wrong password OR a username that does not exist.\n"
                     . "Compare '{$db['user']}' against Site Tools character by character first.\n");
    }
    fwrite(STDERR, "config.php is unchanged and the site is still running.\n");
    exit(1);
}

$backup = $file . '.bak-pw-' . date('Ymd-His');
copy($file, $backup);
$src = file_get_contents($file);
$new = preg_replace_callback(
    "/('pass'\s*=>\s*)'(?:[^'\\\\]|\\\\.)*'/",
    fn($m) => $m[1] . "'" . str_replace(["\\", "'"], ["\\\\", "\\'"], $pw) . "'",
    $src, 1, $n
);
if ($n !== 1) { fwrite(STDERR, "could not find the db password line; nothing written\n"); exit(1); }
file_put_contents($file, $new);

// Read it back the way the app will.
$check = require $file;
$ok = ($check['db']['pass'] ?? null) === $pw;
fwrite(STDERR, $ok ? "written, and config.php reads back correctly (backup: " . basename($backup) . ")\n"
                   : "*** WROTE, BUT IT DOES NOT READ BACK — restore " . basename($backup) . "\n");
exit($ok ? 0 : 1);
