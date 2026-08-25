<?php
/**
 * The magic-link round trip over real HTTP: verify.php → session cookie →
 * me.php → logout.
 *
 * tests/run.php already covers issuing and consuming a token as function calls.
 * What it cannot cover is the part the browser actually depends on — that the
 * session survives as a cookie, that me.php answers with the identity the
 * sign-in button renders, and that signing out really ends it on the server
 * rather than only in the page. js/auth.js builds its whole state from this one
 * response, so its shape is a contract and is asserted field by field here.
 *
 * The token is issued in-process against the same SQLite file the server reads,
 * because only its SHA-256 hash is stored and no test can recover it from the
 * database — which is the point of storing it that way.
 *
 *   php tests/http_auth.php
 */
declare(strict_types=1);

$tmp = sys_get_temp_dir() . '/zupu_httpauth_' . getmypid();
$dbF = $tmp . '/zupu.db';
@mkdir($tmp . '/media', 0777, true);

$PORT = 8902;                      // not 8901: http_photo.php may be running
$cfg  = [
    'db'               => ['driver' => 'sqlite', 'path' => $dbF],
    'media_root'       => $tmp . '/media',
    'site_url'         => 'http://127.0.0.1:' . $PORT,
    'secure_cookies'   => false,   // no TLS on the built-in server
    'enforce_approval' => true,
    'mail'             => ['from' => 't@t', 'from_name' => 't'],
];
file_put_contents($tmp . '/config.php', '<?php return ' . var_export($cfg, true) . ';');

$pdo = new PDO('sqlite:' . $dbF, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec(file_get_contents(__DIR__ . '/../sql/schema.sqlite.sql'));
$pdo->exec("INSERT INTO persons (id,name,visibility,living) VALUES ('mem1','Living Relative','member',1)");
$pdo->exec("INSERT INTO users (id,email,full_name,person_id,is_admin,approved) VALUES
    ('u-admin','keeper@test.local','The Keeper',NULL,1,1),
    ('u-plain','cousin@test.local','A Cousin','mem1',0,0)");

// Issue tokens in-process, against the same file the server will read.
$GLOBALS['ZUPU_CONFIG'] = $cfg;
require_once __DIR__ . '/../lib/auth.php';
$adminToken = token_of(auth_issue_token('keeper@test.local', '127.0.0.1'));
$plainToken = token_of(auth_issue_token('cousin@test.local', '127.0.0.1'));

// An already-expired token, to prove verify.php refuses it rather than trusting
// the link's mere existence.
$staleRaw  = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO login_tokens (token_hash,email,expires_at,created_ip) VALUES (?,?,?,?)')
    ->execute([hash('sha256', $staleRaw), 'cousin@test.local', gmdate('Y-m-d H:i:s', time() - 60), '127.0.0.1']);

/** auth_issue_token returns the whole link; the test wants the token in it. */
function token_of(string $url): string
{
    parse_str((string)parse_url($url, PHP_URL_QUERY), $q);
    return (string)($q['t'] ?? '');
}

$root = realpath(__DIR__ . '/..');
$cmd  = 'ZUPU_CONFIG_FILE=' . escapeshellarg($tmp . '/config.php')
      . ' php -S 127.0.0.1:' . $PORT . ' -t ' . escapeshellarg($root . '/public') . ' > /dev/null 2>&1 & echo $!';
$pid  = (int)shell_exec($cmd);
usleep(700000);

/**
 * One request, carrying whatever cookie the last one set. Redirects are NOT
 * followed: verify.php sets the session on the 302 itself, and following it
 * would throw away the header under test.
 */
function hit(string $path, array &$jar, string $method = 'GET'): array
{
    global $PORT;
    $headers = ["Accept: application/json"];
    if ($jar) {
        $pairs = [];
        foreach ($jar as $k => $v) $pairs[] = $k . '=' . $v;
        $headers[] = 'Cookie: ' . implode('; ', $pairs);
    }
    $ctx = stream_context_create(['http' => [
        'method'        => $method,
        'header'        => implode("\r\n", $headers),
        'ignore_errors' => true,
        'follow_location' => 0,
        'timeout'       => 5,
    ]]);
    $body = @file_get_contents('http://127.0.0.1:' . $PORT . $path, false, $ctx);
    $code = 0; $loc = null;
    foreach ($http_response_header ?? [] as $h) {
        if (preg_match('#HTTP/\S+\s+(\d+)#', $h, $m)) $code = (int)$m[1];
        if (stripos($h, 'Location:') === 0) $loc = trim(substr($h, 9));
        if (stripos($h, 'Set-Cookie:') === 0 && preg_match('/^Set-Cookie:\s*([^=]+)=([^;]*)/i', $h, $m)) {
            $jar[trim($m[1])] = $m[2];
        }
    }
    return [$code, json_decode((string)$body, true), $loc, (string)$body];
}

$pass = 0; $fail = 0;
function check(string $what, $got, $want) {
    global $pass, $fail;
    $ok = $got === $want; $ok ? $pass++ : $fail++;
    printf("  %s %-56s %s\n", $ok ? 'ok  ' : 'FAIL', $what,
        $ok ? '' : '(got ' . var_export($got, true) . ', want ' . var_export($want, true) . ')');
}

echo "\nBEFORE SIGNING IN\n";
$jar = [];
[$c, $me] = hit('/auth/me.php', $jar);
check('me.php answers a stranger', $c, 200);
check('  …as signed out',        $me['signedIn'] ?? null, false);
check('  …with no admin',        $me['admin'] ?? null, false);
// isset(), not ??: the key is present and null, and either way the claim being
// made is simply that no address comes back to someone who has not signed in.
check('  …and volunteers no address', isset($me['email']), false);
check('  …nor a name',                isset($me['fullName']), false);
check('  …nor a user id',             isset($me['userId']), false);

echo "\nA STALE LINK\n";
$jar = [];
[$c, , $loc] = hit('/auth/verify.php?t=' . $staleRaw, $jar);
check('an expired token redirects', $c, 302);
check('  …and says so, so the page can explain', str_contains((string)$loc, 'signin=expired'), true);
[, $me] = hit('/auth/me.php', $jar);
check('  …and starts no session', $me['signedIn'] ?? null, false);

echo "\nTHE KEEPER SIGNS IN\n";
$jar = [];
[$c, , $loc] = hit('/auth/verify.php?t=' . $adminToken, $jar);
check('a good token redirects', $c, 302);
check('  …to the site, not back to the token', str_contains((string)$loc, 'signin=ok'), true);
check('  …and the token is gone from the URL', str_contains((string)$loc, $adminToken), false);
check('  …leaving a session cookie', isset($jar['zupu_session']), true);

[$c, $me] = hit('/auth/me.php', $jar);
check('me.php now knows them', $me['signedIn'] ?? null, true);
check('  …as an admin',        $me['admin'] ?? null, true);
check('  …approved',           $me['approved'] ?? null, true);
check('  …by name, for the button', $me['fullName'] ?? null, 'The Keeper');
check('  …and by address',     $me['email'] ?? null, 'keeper@test.local');
check('  …with the id writes are attributed to', $me['userId'] ?? null, 'u-admin');

echo "\nTHE SAME LINK, TWICE\n";
$jar2 = [];
[$c, , $loc] = hit('/auth/verify.php?t=' . $adminToken, $jar2);
check('a used token is refused', str_contains((string)$loc, 'signin=expired'), true);
[, $me] = hit('/auth/me.php', $jar2);
check('  …and signs nobody in', $me['signedIn'] ?? null, false);

echo "\nAN ORDINARY COUSIN\n";
$jarC = [];
hit('/auth/verify.php?t=' . $plainToken, $jarC);
[, $me] = hit('/auth/me.php', $jarC);
check('signed in',                 $me['signedIn'] ?? null, true);
check('  …but not an admin',       $me['admin'] ?? null, false);
check('  …and not yet approved',   $me['approved'] ?? null, false);
check('  …linked to their own person, so they can see their own detail',
      $me['personId'] ?? null, 'mem1');

echo "\nSIGNING OUT\n";
[$c] = hit('/auth/logout.php', $jar, 'POST');
check('logout answers', $c, 200);
[, $me] = hit('/auth/me.php', $jar);
check('  …and the server has forgotten them', $me['signedIn'] ?? null, false);
check('  …so the admin flag is gone with it', $me['admin'] ?? null, false);

echo "\nSESSIONS DO NOT BLEED\n";
[, $me] = hit('/auth/me.php', $jarC);
check("the cousin's session survived the keeper's logout", $me['signedIn'] ?? null, true);
check('  …and is still not an admin', $me['admin'] ?? null, false);

exec('kill ' . $pid . ' 2>/dev/null');
exec('rm -rf ' . escapeshellarg($tmp));
printf("\n%d passed, %d failed\n", $pass, $fail);
exit($fail === 0 ? 0 : 1);
