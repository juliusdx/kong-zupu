<?php
/**
 * One-way import: Supabase → MySQL. Run it as many times as you like; it is
 * idempotent (REPLACE INTO), so you can rehearse the migration, keep using the
 * live site, and re-run it on cutover day to pick up whatever changed.
 *
 *   ZUPU_CONFIG_FILE=/path/to/config.php \
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_KEY=<service-role key> \
 *   php tools/import_from_supabase.php [--photos /path/to/backup/storage]
 *
 * The service-role key is needed because this must read the GATED rows too —
 * that is the whole point. It is read from the environment and never stored.
 *
 * Photos: pass --photos pointing at the storage folder produced by
 * tools/backup.sh. Files are copied into config['media_root'] and the media
 * rows rewritten to a single `path` column, because on this side there is no
 * public bucket and no URL — photo.php checks, then serves.
 */
declare(strict_types=1);
require_once __DIR__ . '/../lib/bootstrap.php';

$SB_URL = rtrim((string)(getenv('SUPABASE_URL') ?: ''), '/');
$SB_KEY = (string)(getenv('SUPABASE_KEY') ?: '');
if ($SB_URL === '' || $SB_KEY === '') {
    fwrite(STDERR, "set SUPABASE_URL and SUPABASE_KEY (service-role)\n");
    exit(1);
}
$photoSrc = null;
foreach ($argv as $i => $a) if ($a === '--photos') $photoSrc = rtrim($argv[$i + 1] ?? '', '/');

function sb_get(string $table, string $select = '*'): array
{
    global $SB_URL, $SB_KEY;
    $rows = [];
    $from = 0;
    do {                                   // PostgREST caps a page at 1000
        $ctx = stream_context_create(['http' => ['method' => 'GET', 'header' =>
            // apikey ONLY: the sb_secret_ keys are not JWTs, and putting one
            // on Authorization makes the platform try to parse it as one.
            // Same trap tools/backup.sh fell into (fixed 2026-08-20).
            "apikey: {$SB_KEY}\r\n" .
            'Range: ' . $from . '-' . ($from + 999) . "\r\n", 'ignore_errors' => true]]);
        $raw = file_get_contents("{$SB_URL}/rest/v1/{$table}?select={$select}", false, $ctx);
        if ($raw === false) { fwrite(STDERR, "read failed: {$table}\n"); exit(1); }

        // Check the STATUS before the body. ignore_errors means a 401 arrives
        // here as content, not as a failure, and PostgREST reports errors as a
        // JSON OBJECT — which json_decode turns into an array just like a list
        // of rows does. is_array() alone therefore accepted an auth failure as
        // data: the error object was merged into $rows, each "row" was a bare
        // string, and the import died deep inside an INSERT with "Column 'id'
        // cannot be null" instead of saying the key was refused.
        $status = 0;
        foreach ($http_response_header ?? [] as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d+)#', $h, $m)) $status = (int)$m[1];
        }
        $page = json_decode($raw, true);
        if ($status !== 200 && $status !== 206) {
            $msg = is_array($page) ? ($page['message'] ?? $page['hint'] ?? '') : '';
            fwrite(STDERR, "Supabase refused the read of '{$table}' — HTTP {$status}"
                         . ($msg !== '' ? ": {$msg}" : '') . "\n");
            if ($status === 401 || $status === 403) {
                fwrite(STDERR, "  the SUPABASE_KEY is not accepted. It must be a SECRET key\n"
                             . "  (sb_secret_...), sent on the apikey header, and not revoked.\n");
            }
            exit(1);
        }
        // A list of rows is a LIST. Anything else — an object, a scalar — is not
        // data, whatever the status said.
        if (!is_array($page) || !array_is_list($page)) {
            fwrite(STDERR, "bad response for {$table}: " . substr($raw, 0, 200) . "\n");
            exit(1);
        }
        $rows = array_merge($rows, $page);
        $from += 1000;
    } while (count($page) === 1000);
    return $rows;
}

/**
 * id => email for every account, from the Auth admin API.
 *
 * auth.users is not reachable through PostgREST, and the view that used to
 * stand in for it is gated on a signed-in admin. This endpoint takes the secret
 * key directly. The key is sent on `apikey` — these keys are not JWTs, and the
 * platform may reject one it tries to parse as such on Authorization — but some
 * deployments still want it there, so both are tried before giving up.
 */
function sb_auth_emails(): array
{
    global $SB_URL, $SB_KEY;
    $out  = [];
    $page = 1;
    do {
        $found = false;
        foreach (["apikey: {$SB_KEY}\r\n", "apikey: {$SB_KEY}\r\nAuthorization: Bearer {$SB_KEY}\r\n"] as $hdr) {
            $ctx = stream_context_create(['http' => ['method' => 'GET', 'header' => $hdr, 'ignore_errors' => true]]);
            $raw = @file_get_contents("{$SB_URL}/auth/v1/admin/users?page={$page}&per_page=200", false, $ctx);
            $status = 0;
            foreach ($http_response_header ?? [] as $h) {
                if (preg_match('#^HTTP/\S+\s+(\d+)#', $h, $m)) $status = (int)$m[1];
            }
            if ($raw === false || $status !== 200) continue;
            $d = json_decode($raw, true);
            $users = $d['users'] ?? null;
            if (!is_array($users)) continue;
            foreach ($users as $u) {
                if (!empty($u['id']) && !empty($u['email'])) $out[$u['id']] = $u['email'];
            }
            $found = true;
            $more  = count($users) === 200;
            break;
        }
        if (!$found) {
            fwrite(STDERR, "could not read /auth/v1/admin/users — the key may not have admin rights\n");
            return $out;
        }
        $page++;
    } while (!empty($more));
    return $out;
}

function put(string $table, array $rows, array $cols): int
{
    if (!$rows) return 0;
    $ph = '(' . implode(',', array_fill(0, count($cols), '?')) . ')';
    $sql = 'REPLACE INTO ' . $table . ' (' . implode(',', $cols) . ') VALUES ' . $ph;
    $st = db()->prepare($sql);
    $n = 0;
    foreach ($rows as $r) {
        $vals = [];
        foreach ($cols as $c) {
            $v = $r[$c] ?? null;
            if (is_bool($v)) $v = $v ? 1 : 0;
            if (is_array($v)) $v = json_encode($v, JSON_UNESCAPED_UNICODE);
            $vals[] = $v;
        }
        $st->execute($vals);
        $n++;
    }
    return $n;
}

db()->beginTransaction();

$persons = sb_get('persons');
echo 'persons        ', put('persons', $persons, [
    'id','gen','name','pinyin','ritual_name','formal_name','hao','milk_name','aka','gender',
    'father_id','spouse_of','birth_year','death_year','lifespan','religion','relation','bio',
    'birth_place','residence_place','burial_place','lat','lng','living','is_minor','visibility',
    'confidence','source','archived','archived_at','archived_by','archived_reason','created_at',
]), "\n";

echo 'person_details ', put('person_details', sb_get('person_details'),
    ['person_id','birth_year','death_year','lifespan','religion','occupation','bio','updated_at']), "\n";
echo 'contacts       ', put('contacts', sb_get('contacts'),
    ['person_id','email','phone','wechat','address','updated_at']), "\n";
echo 'places         ', put('places', sb_get('places'),
    ['id','type','name','name_en','lat','lng','approximate','note','visibility','created_at']), "\n";
echo 'contributions  ', put('contributions', sb_get('contributions'),
    ['id','payload','status','submitted_by','reviewed_by','created_at','reviewed_at','rejection_reason']), "\n";
echo 'transcriptions ', put('transcriptions', sb_get('transcriptions'),
    ['doc_id','page','text','updated_by','updated_at']), "\n";

// profiles → users.
//
// This used to read the members_admin view, and silently imported NOTHING. That
// view is defined `where public.is_admin()`, which resolves against auth.uid() —
// a signed-in user's token. A secret key has no user context, so is_admin() is
// false and the view returns zero rows every time, however valid the key. The
// import "succeeded" with no accounts and therefore no admins, which is a site
// nobody can log in to and review.
//
// So: flags come from `profiles` (a real table; a secret key bypasses RLS), and
// the addresses come from the Auth admin API, because auth.users is not exposed
// through PostgREST at all.
$profiles = sb_get('profiles', 'id,full_name,person_id,is_admin,approved,created_at');
$emails   = sb_auth_emails();
$users = [];
foreach ($profiles as $p) {
    $email = $emails[$p['id']] ?? null;
    if ($email === null) { fwrite(STDERR, "  ! profile {$p['id']} has no address, skipped\n"); continue; }
    $users[] = [
        'id' => $p['id'], 'email' => strtolower($email), 'full_name' => $p['full_name'],
        'person_id' => $p['person_id'], 'is_admin' => $p['is_admin'], 'approved' => $p['approved'],
        'created_at' => $p['created_at'],
    ];
}
// An import that lands no accounts is not a successful import — it is a site
// with no way in. Refuse rather than report a cheerful zero.
if ($profiles && !$users) {
    fwrite(STDERR, "\nRefusing: " . count($profiles) . " profiles but not one address was\n"
                 . "resolved, so nobody could sign in. Check the key can reach\n"
                 . "/auth/v1/admin/users on this project.\n");
    exit(1);
}
echo 'users          ', put('users', $users,
    ['id','email','full_name','person_id','is_admin','approved','created_at']), "\n";

// media: url + private_path collapse into one path, relative to media_root.
$media = sb_get('media');
$mediaRows = [];
foreach ($media as $m) {
    $path = $m['private_path'] ?: null;
    $bucket = 'photos-private';
    if (!$path && !empty($m['url']) && str_contains($m['url'], '/object/public/')) {
        $after  = explode('/object/public/', $m['url'], 2)[1] ?? '';
        $bucket = explode('/', $after, 2)[0] ?? 'photos';
        $path   = urldecode(explode('/', $after, 2)[1] ?? '');
    }
    if (!$path) { fwrite(STDERR, "  ! media {$m['id']} has no file, skipped\n"); continue; }

    if ($photoSrc !== null) {
        $src = $photoSrc . '/' . $bucket . '/' . $path;
        $dst = rtrim(config()['media_root'], '/') . '/' . $path;
        if (is_file($src)) {
            @mkdir(dirname($dst), 0750, true);
            copy($src, $dst);
        } else {
            fwrite(STDERR, "  ! file not in backup: {$bucket}/{$path}\n");
        }
    }
    $m['path'] = $path;
    $mediaRows[] = $m;
}
echo 'media          ', put('media', $mediaRows,
    ['id','person_id','place_id','path','caption','visibility','approved','cover','uploaded_by','created_at']), "\n";

db()->commit();

// A migration that quietly drops the gating would be the worst possible outcome,
// so say out loud what came across.
$n = fn(string $sql) => (int)q1($sql)['c'];
echo "\nverification\n";
printf("  %-34s %d\n", 'people total',            $n('SELECT COUNT(*) c FROM persons'));
printf("  %-34s %d\n", 'gated (living or minor)', $n('SELECT COUNT(*) c FROM persons WHERE living = 1 OR is_minor = 1'));
printf("  %-34s %d\n", 'minors (admin-only)',     $n('SELECT COUNT(*) c FROM persons WHERE is_minor = 1'));
printf("  %-34s %d\n", 'member-tier photos',      $n("SELECT COUNT(*) c FROM media WHERE visibility <> 'public'"));
printf("  %-34s %d\n", 'admins',                  $n('SELECT COUNT(*) c FROM users WHERE is_admin = 1'));
echo "\nCompare those against the Supabase numbers before pointing anyone at the new site.\n";
