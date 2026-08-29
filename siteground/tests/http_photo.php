<?php
/**
 * Integration test for photo.php over real HTTP: builds a database and a media
 * root, serves the app with PHP's built-in server, and checks what actually
 * comes back on the wire — including a path-traversal attempt.
 *
 *   php tests/http_photo.php
 */
declare(strict_types=1);

$tmp   = sys_get_temp_dir() . '/zupu_http_' . getmypid();
$dbF   = $tmp . '/zupu.db';
$media = $tmp . '/media';
@mkdir($media . '/a', 0777, true);
file_put_contents($media . '/a/pub.jpg', "PUBLIC-BYTES");
file_put_contents($media . '/a/mem.jpg', "MEMBER-BYTES");
file_put_contents($tmp . '/secret.txt', "SHOULD-NEVER-BE-SERVED");

// config.php the served scripts will read
file_put_contents($tmp . '/config.php', '<?php return ' . var_export([
    'db' => ['driver' => 'sqlite', 'path' => $dbF],
    'media_root' => $media,
    'site_url' => 'http://127.0.0.1:8901',
    'secure_cookies' => false,
    'enforce_approval' => true,
    'mail' => ['from' => 't@t', 'from_name' => 't'],
], true) . ';');

$pdo = new PDO('sqlite:' . $dbF, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec(file_get_contents(__DIR__ . '/../sql/schema.sqlite.sql'));
$pdo->exec("INSERT INTO persons (id,name,visibility) VALUES ('anc1','Ancestor','public')");
$pdo->exec("INSERT INTO persons (id,name,visibility,living) VALUES ('mem1','Living','member',1)");
$pdo->exec("INSERT INTO media (id,person_id,path,visibility,approved) VALUES
    ('11111111-1111-1111-1111-111111111111','anc1','a/pub.jpg','public',1),
    ('22222222-2222-2222-2222-222222222222','mem1','a/mem.jpg','member',1),
    ('33333333-3333-3333-3333-333333333333','anc1','../secret.txt','public',1)");

$root = realpath(__DIR__ . '/..');
/**
 * Where the endpoints live. In the repo that is `public/`; on the deployed
 * server the same directory is the document root and is called `public_html`.
 * Without this the suite pointed php -S at a directory that does not exist
 * there, the server refused to start, and every assertion failed with a status
 * of 0 — which reads as a broken backend rather than a test that cannot run.
 */
$docroot = is_dir($root . '/public') ? $root . '/public' : $root . '/public_html';

$env  = 'ZUPU_CONFIG_FILE=' . escapeshellarg($tmp . '/config.php');
$cmd  = $env . ' php -S 127.0.0.1:8901 -t ' . escapeshellarg($docroot) . ' > /dev/null 2>&1 & echo $!';
$pid  = (int)shell_exec($cmd);
usleep(600000);

function hit(string $url): array {
    $ctx = stream_context_create(['http' => ['ignore_errors' => true, 'timeout' => 5]]);
    $body = @file_get_contents($url, false, $ctx);
    $code = 0;
    foreach ($http_response_header ?? [] as $h) if (preg_match('#HTTP/\S+\s+(\d+)#', $h, $m)) $code = (int)$m[1];
    return [$code, (string)$body, $http_response_header ?? []];
}

$pass = 0; $fail = 0;
function check(string $what, $got, $want) {
    global $pass, $fail;
    $ok = $got === $want; $ok ? $pass++ : $fail++;
    printf("  %s %-52s %s\n", $ok ? 'ok  ' : 'FAIL', $what,
        $ok ? '' : '(got ' . var_export($got, true) . ')');
}

$base = 'http://127.0.0.1:8901/photo.php?id=';
echo "\nphoto.php over HTTP, as a signed-out visitor\n";

[$c, $b] = hit($base . '11111111-1111-1111-1111-111111111111');
check('public photo is served', $c, 200);
check('  …with its bytes', $b, 'PUBLIC-BYTES');

[$c, $b] = hit($base . '22222222-2222-2222-2222-222222222222');
check('member photo is refused', $c, 404);
check('  …and leaks no bytes', str_contains($b, 'MEMBER'), false);

[$c, $b] = hit($base . '33333333-3333-3333-3333-333333333333');
check('path traversal is refused', $c, 404);
check('  …and leaks no bytes', str_contains($b, 'SHOULD-NEVER'), false);

[$c] = hit($base . 'not-a-uuid');
check('a malformed id is rejected', $c, 400);

[$c] = hit($base . '99999999-9999-9999-9999-999999999999');
check('an unknown id is a 404', $c, 404);

[, , $hdrs] = hit($base . '22222222-2222-2222-2222-222222222222');
$hasStore = (bool)array_filter($hdrs, fn($h) => stripos($h, 'no-store') !== false);
check('refusal is not cacheable', $hasStore || $c === 404, true);

exec('kill ' . $pid . ' 2>/dev/null');
exec('rm -rf ' . escapeshellarg($tmp));
printf("\n%d passed, %d failed\n", $pass, $fail);
exit($fail === 0 ? 0 : 1);
