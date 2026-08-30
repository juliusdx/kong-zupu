<?php
/**
 * Run the whole site — static front-end AND this PHP backend — on one origin,
 * so the parts that have been ported can be driven in a browser.
 *
 *   php tools/serve_local.php --init          # build a throwaway SQLite db + config
 *   php -S localhost:8910 -t .. tools/serve_local.php
 *   php tools/serve_local.php --link you@example.com   # print a sign-in link
 *
 * WHY ONE ORIGIN. The session is a cookie. Serving the page from one port and
 * the API from another makes every request look signed out, and the bug you
 * then chase is not in the code. The real deploy has them on one host too.
 *
 * WHY A ROUTER AND NOT A COPY. index.html is rewritten in flight to
 * BACKEND:"php" so the committed file keeps saying "supabase" — the switch
 * flips for the harness only, and nobody can push a local experiment by
 * accident. Add ?backend=supabase to any page URL to serve the file exactly as
 * committed, which is how you check the OTHER path still works without
 * stopping the server.
 *
 * Everything it writes lives in a throwaway directory in the system temp dir,
 * outside the repo and outside anything this server hands out.
 */
declare(strict_types=1);

$root  = dirname(__DIR__);              // siteground/
$site  = dirname($root);                // kong-zupu/
// OUTSIDE the served tree, deliberately. An earlier version of this file kept
// the throwaway media under tools/.local/, which is inside the directory the
// server hands out — so a staged photo was fetchable at its own URL and the
// harness "proved" the opposite of the property it exists to demonstrate.
// Production puts media_root beside public_html for the same reason.
$local = sys_get_temp_dir() . '/zupu-local';
$cfgF  = $local . '/config.php';

// ---------------------------------------------------------------- CLI ------
if (PHP_SAPI === 'cli') {
    $args = array_slice($argv, 1);
    $cmd  = $args[0] ?? '--help';

    if ($cmd === '--init') {
        @mkdir($local . '/media/a', 0777, true);
        file_put_contents($local . '/media/a/sample.jpg', 'not-a-real-jpeg');
        // localhost, not 127.0.0.1: verify.php redirects to site_url after
        // setting the session, and the two spellings are different cookie jars.
        $port = $args[1] ?? '8910';
        file_put_contents($cfgF, '<?php return ' . var_export([
            'db'               => ['driver' => 'sqlite', 'path' => $local . '/zupu.db'],
            'media_root'       => $local . '/media',
            'docs_root'        => $local . '/docs',
            'site_url'         => 'http://localhost:' . $port,
            'secure_cookies'   => false,          // no TLS on the built-in server
            'enforce_approval' => false,
            'mail'             => ['from' => 'zupu@localhost', 'from_name' => 'Zupu (local)'],
        ], true) . ";\n");

        @unlink($local . '/zupu.db');
        $pdo = new PDO('sqlite:' . $local . '/zupu.db', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $pdo->exec(file_get_contents($root . '/sql/schema.sqlite.sql'));
        // Enough of a family to exercise every gate: a public ancestor, a
        // living adult, an admin, an approved member, and someone waiting.
        $pdo->exec("INSERT INTO persons (id,name,gen,visibility,living) VALUES
            ('a01','江八郎',1,'public',0),
            ('a02','萬里',2,'public',0),
            ('live1','A Living Cousin',26,'member',1)");
        $pdo->exec("UPDATE persons SET father_id='a01' WHERE id='a02'");
        $pdo->exec("INSERT INTO media (id,person_id,path,visibility,approved) VALUES
            ('11111111-1111-1111-1111-111111111111','a01','a/sample.jpg','public',1)");
        $pdo->exec("INSERT INTO users (id,email,full_name,is_admin,approved) VALUES
            ('u-keeper','keeper@localhost','The Keeper',1,1),
            ('u-member','cousin@localhost','A Cousin',0,1),
            ('u-new','newcousin@localhost','Waiting Cousin',0,0)");
        fwrite(STDOUT, "ready: {$local}\nnow run:  php -S localhost:{$port} -t " . escapeshellarg($site) . " tools/serve_local.php\n"
                     . "sign in:  php tools/serve_local.php --link keeper@localhost\n");
        exit(0);
    }

    if ($cmd === '--link') {
        $email = $args[1] ?? '';
        if ($email === '') { fwrite(STDERR, "usage: --link <email>\n"); exit(1); }
        if (!is_file($cfgF)) { fwrite(STDERR, "run --init first\n"); exit(1); }
        putenv('ZUPU_CONFIG_FILE=' . $cfgF);
        require_once $root . '/lib/auth.php';
        // Printed rather than emailed: there is no SMTP here, and the token is
        // only ever in the mail. Single use and 15 minutes apply as they will
        // in production.
        fwrite(STDOUT, auth_issue_token(auth_normalise_email($email) ?? $email, '127.0.0.1') . "\n");
        exit(0);
    }

    fwrite(STDOUT, "usage:\n  php tools/serve_local.php --init [port]\n"
                 . "  php -S localhost:8910 -t " . escapeshellarg($site) . " tools/serve_local.php\n"
                 . "  php tools/serve_local.php --link <email>\n");
    exit(0);
}

// ------------------------------------------------------------- routing -----
putenv('ZUPU_CONFIG_FILE=' . $cfgF);
$api  = $root . '/public';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// The backend's own source is not part of the site. Serving the repo root is a
// harness convenience — in production the document root is public/ — so refuse
// the one directory where that convenience would hand out config.php (database
// password, mail credentials) and every lib/ file the built-in server would
// happily EXECUTE on request.
if (str_starts_with($path, '/siteground/')) {
    http_response_code(404);
    echo 'not found';
    return true;
}

if (preg_match('#^/(api|auth)/#', $path) || $path === '/photo.php' || $path === '/doc.php') {
    $f = $api . $path;
    if (is_file($f)) { $_SERVER['SCRIPT_FILENAME'] = $f; require $f; return true; }
    http_response_code(404); echo 'no such endpoint'; return true;
}

if ($path === '/' || $path === '/index.html') {
    $html = file_get_contents($site . '/index.html');
    if (($_GET['backend'] ?? '') !== 'supabase') {
        $html = str_replace('BACKEND: "supabase"', 'BACKEND: "php"', $html);
    }
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    echo $html;
    return true;
}

// no-store on everything: the browser otherwise keeps serving the app.js you
// just edited, and you debug a file that is no longer running.
$f = $site . $path;
if (is_file($f)) { header('Cache-Control: no-store'); return false; }
http_response_code(404); echo 'not found';
return true;
