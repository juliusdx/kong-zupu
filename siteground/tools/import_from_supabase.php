<?php
/**
 * One-way import: Supabase → MySQL. Run it as many times as you like; it is
 * idempotent (REPLACE INTO), so you can rehearse the migration, keep using the
 * live site, and re-run it on cutover day to pick up whatever changed.
 *
 *   ZUPU_CONFIG_FILE=/path/to/config.php \
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_KEY=<secret key> \
 *   php tools/import_from_supabase.php [flags]
 *
 *     --photos DIR     copy files from a tools/backup.sh storage folder
 *     --fetch-photos   read each object from its bucket instead (fresher)
 *     --fetch-docs     copy the source PDFs into config['docs_root']
 *     --prune          delete rows Supabase no longer has (see below)
 *     --dry-run        do all of it, report it, then roll back
 *
 * Cutover day is: --dry-run --prune --fetch-photos first, read the prune list,
 * then the same command without --dry-run.
 *
 * The service-role key is needed because this must read the GATED rows too —
 * that is the whole point. It is read from the environment and never stored.
 *
 * Photos: pass --photos pointing at the storage folder produced by
 * tools/backup.sh. Files are copied into config['media_root'] and the media
 * rows rewritten to a single `path` column, because on this side there is no
 * public bucket and no URL — photo.php checks, then serves.
 *
 * --prune makes this a MIRROR rather than an accumulation, and cutover day
 * needs it. REPLACE INTO updates and inserts but never deletes, so anything
 * removed on Supabase after an earlier run simply stays here: on 2026-08-29 a
 * photo deleted from the live site was still present in MySQL, and a plain
 * re-import would have republished it. Deleting something is a decision
 * somebody made, often on a relative's behalf, and a migration that silently
 * reverses it is worse than one that fails.
 *
 * Prune deletes rows whose primary key is absent from what Supabase just
 * returned, reports every deletion by id, and removes the underlying file for
 * a pruned photo. It runs inside the same transaction as the import, so a
 * foreign-key violation aborts the whole run rather than leaving a half-mirror.
 * If a table comes back empty while MySQL holds rows it refuses instead of
 * emptying the table, on the same reasoning as the accounts check below: a
 * zero that arrives by accident must not be obeyed.
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
$fetch    = false;
$prune    = false;
$dryRun   = false;
$fetchDocs = false;
foreach ($argv as $i => $a) {
    if ($a === '--photos')       $photoSrc = rtrim($argv[$i + 1] ?? '', '/');
    if ($a === '--fetch-photos') $fetch    = true;
    if ($a === '--prune')        $prune    = true;
    if ($a === '--dry-run')      $dryRun   = true;
    if ($a === '--fetch-docs')   $fetchDocs = true;
}

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

/**
 * Pull one object out of Supabase Storage.
 *
 * The alternative was a local backup passed with --photos, which is only ever
 * as fresh as the last backup — ours held four files against six media rows,
 * and the two it lacked were the two most recently added. Reading the bucket
 * directly means the photos match the rows they belong to, and that the whole
 * import stays re-runnable on cutover day, which is the point of it.
 *
 * A secret key reads private buckets straight, with no signed URL to mint.
 */
function sb_object(string $bucket, string $path): ?string
{
    global $SB_URL, $SB_KEY;
    $url = "{$SB_URL}/storage/v1/object/{$bucket}/" . implode('/', array_map('rawurlencode', explode('/', $path)));
    $ctx = stream_context_create(['http' => ['method' => 'GET',
        'header' => "apikey: {$SB_KEY}\r\nAuthorization: Bearer {$SB_KEY}\r\n", 'ignore_errors' => true]]);
    $raw = @file_get_contents($url, false, $ctx);
    $status = 0;
    foreach ($http_response_header ?? [] as $h) {
        if (preg_match('#^HTTP/\S+\s+(\d+)#', $h, $m)) $status = (int)$m[1];
    }
    if ($raw === false || $status !== 200 || $raw === '') {
        fwrite(STDERR, "  ! could not fetch {$bucket}/{$path} (HTTP {$status})\n");
        return null;
    }
    return $raw;
}

/**
 * What is in a bucket. The storage API lists a prefix at a time and returns
 * objects and folders together; these buckets are flat, so one call is enough.
 */
function sb_list(string $bucket): array
{
    global $SB_URL, $SB_KEY;
    $ctx = stream_context_create(['http' => ['method' => 'POST',
        'header'  => "apikey: {$SB_KEY}\r\nAuthorization: Bearer {$SB_KEY}\r\nContent-Type: application/json\r\n",
        'content' => json_encode(['prefix' => '', 'limit' => 1000]),
        'ignore_errors' => true]]);
    $raw = @file_get_contents("{$SB_URL}/storage/v1/object/list/{$bucket}", false, $ctx);
    $status = 0;
    foreach ($http_response_header ?? [] as $h) {
        if (preg_match('#^HTTP/\S+\s+(\d+)#', $h, $m)) $status = (int)$m[1];
    }
    if ($raw === false || $status !== 200) {
        fwrite(STDERR, "  ! could not list bucket {$bucket} (HTTP {$status})\n");
        return [];
    }
    $out = [];
    foreach (json_decode($raw, true) ?: [] as $o) {
        if (!empty($o['name']) && !empty($o['id'])) $out[] = (string)$o['name'];  // id null = folder
    }
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

/**
 * Delete rows this import did not bring across.
 *
 * $keep is the set of primary keys Supabase just returned. Anything else in
 * the table predates a deletion made upstream and has to go, or the new site
 * shows content the old one no longer does.
 *
 * The empty-$keep case is deliberately a refusal, not a DELETE: an empty table
 * is indistinguishable here from a request that failed and decoded to nothing,
 * and one of those two readings destroys the archive.
 */
function prune(string $table, string $pkCol, array $keep, bool $enabled): array
{
    if (!$enabled) return [];
    $have = array_column(q("SELECT {$pkCol} FROM {$table}")->fetchAll(), $pkCol);
    $gone = array_values(array_diff($have, $keep));
    if (!$gone) return [];
    if (!$keep) {
        fwrite(STDERR, "\nRefusing to prune {$table}: Supabase returned no rows at all while\n"
                     . "MySQL holds " . count($have) . ". That is far more likely to be a failed\n"
                     . "read than a deliberately emptied table.\n");
        exit(1);
    }
    $st = db()->prepare("DELETE FROM {$table} WHERE {$pkCol} = ?");
    foreach ($gone as $id) $st->execute([$id]);
    return $gone;
}

db()->beginTransaction();

$persons = sb_get('persons');
echo 'persons        ', put('persons', $persons, [
    'id','gen','name','pinyin','ritual_name','formal_name','hao','milk_name','aka','gender',
    'father_id','spouse_of','birth_year','death_year','lifespan','religion','relation','bio',
    'birth_place','residence_place','burial_place','lat','lng','living','is_minor','visibility',
    'confidence','source','archived','archived_at','archived_by','archived_reason','created_at',
]), "\n";

$personDetails = sb_get('person_details');
echo 'person_details ', put('person_details', $personDetails,
    ['person_id','birth_year','death_year','lifespan','religion','occupation','bio','updated_at']), "\n";
$contacts = sb_get('contacts');
echo 'contacts       ', put('contacts', $contacts,
    ['person_id','email','phone','wechat','address','updated_at']), "\n";
$places = sb_get('places');
echo 'places         ', put('places', $places,
    ['id','type','name','name_en','lat','lng','approximate','note','visibility','created_at']), "\n";
$contributions = sb_get('contributions');
echo 'contributions  ', put('contributions', $contributions,
    ['id','payload','status','submitted_by','reviewed_by','created_at','reviewed_at','rejection_reason']), "\n";
$transcriptions = sb_get('transcriptions');
echo 'transcriptions ', put('transcriptions', $transcriptions,
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
$copied = 0; $missing = 0;
foreach ($media as $m) {
    $path = $m['private_path'] ?: null;
    $bucket = 'photos-private';
    if (!$path && !empty($m['url']) && str_contains($m['url'], '/object/public/')) {
        $after  = explode('/object/public/', $m['url'], 2)[1] ?? '';
        $bucket = explode('/', $after, 2)[0] ?? 'photos';
        $path   = urldecode(explode('/', $after, 2)[1] ?? '');
    }
    if (!$path) { fwrite(STDERR, "  ! media {$m['id']} has no file, skipped\n"); continue; }

    if ($photoSrc !== null || $fetch) {
        $dst = rtrim(config()['media_root'], '/') . '/' . $path;
        $src = $photoSrc !== null ? $photoSrc . '/' . $bucket . '/' . $path : null;
        if ($src !== null && is_file($src)) {
            @mkdir(dirname($dst), 0750, true);
            copy($src, $dst);
            @chmod($dst, 0600);
            $copied++;
        } elseif ($fetch) {
            // Either no backup was given, or it predates this photo.
            $bytes = sb_object($bucket, $path);
            if ($bytes !== null) {
                @mkdir(dirname($dst), 0750, true);
                file_put_contents($dst, $bytes);
                @chmod($dst, 0600);
                $copied++;
            } else {
                $missing++;
            }
        } else {
            fwrite(STDERR, "  ! file not in backup: {$bucket}/{$path}\n");
            $missing++;
        }
    }
    $m['path'] = $path;
    $mediaRows[] = $m;
}
if ($photoSrc !== null || $fetch) {
    // Say it plainly: a media row whose bytes never arrived is a photo that
    // 404s for everyone, and it should not hide inside a success message.
    printf("photo files    %d copied, %d missing\n", $copied, $missing);
}
echo 'media          ', put('media', $mediaRows,
    ['id','person_id','place_id','path','caption','visibility','approved','cover','uploaded_by','created_at']), "\n";

// Anything upstream deleted. Children before parents, so a row never outlives
// the person it points at; the transaction means a foreign key we got wrong
// aborts the run instead of leaving the tables half-mirrored.
if ($prune) {
    echo "\nprune\n";
    $mediaPaths = [];
    foreach (q('SELECT id, path FROM media')->fetchAll() as $r) $mediaPaths[$r['id']] = $r['path'];

    $pruned = [
        'person_details' => prune('person_details', 'person_id', array_column($personDetails, 'person_id'), true),
        'contacts'       => prune('contacts', 'person_id', array_column($contacts, 'person_id'), true),
        'media'          => prune('media', 'id', array_column($mediaRows, 'id'), true),
        'contributions'  => prune('contributions', 'id', array_column($contributions, 'id'), true),
        'persons'        => prune('persons', 'id', array_column($persons, 'id'), true),
        'places'         => prune('places', 'id', array_column($places, 'id'), true),
        'users'          => prune('users', 'id', array_column($users, 'id'), true),
    ];

    $total = 0;
    foreach ($pruned as $table => $ids) {
        $total += count($ids);
        foreach ($ids as $id) echo "  - {$table} {$id}\n";
    }
    if (!$total) echo "  nothing to remove — the two sides already agree\n";

    // A pruned photo's bytes go too. Leaving the file behind is not a leak on
    // its own, since photo.php will not serve what has no row, but a deletion
    // that leaves the thing on disk is not a deletion.
    foreach ($pruned['media'] as $id) {
        $p = $mediaPaths[$id] ?? null;
        if ($p === null) continue;
        $f = rtrim(config()['media_root'], '/') . '/' . $p;
        if (!is_file($f)) continue;
        if ($dryRun)                 echo "  - file {$p} (would delete)\n";
        elseif (@unlink($f))         echo "  - file {$p}\n";
        else                         fwrite(STDERR, "  ! could not delete file {$p}\n");
    }
}

// The source PDFs behind the Sources tab. They are files with no table, so
// there is nothing to reconcile — they either arrived or they did not, and the
// count says which. Taken from the bucket rather than from local copies of the
// scans, because the two are not the same: the story PDF in the bucket is
// 10.8 MB while the local file of that name is 1.2 MB, so "the copy on my
// laptop" would have quietly published a different document.
if ($fetchDocs) {
    $docsRoot = rtrim((string)(config()['docs_root'] ?? ''), '/');
    if ($docsRoot === '') {
        fwrite(STDERR, "set docs_root in config.php before --fetch-docs\n");
        exit(1);
    }
    @mkdir($docsRoot, 0750, true);
    $got = 0; $lost = 0;
    foreach (sb_list('documents') as $name) {
        $bytes = sb_object('documents', $name);
        if ($bytes === null) { $lost++; continue; }
        file_put_contents($docsRoot . '/' . basename($name), $bytes);
        @chmod($docsRoot . '/' . basename($name), 0600);
        $got++;
    }
    printf("documents     %d copied, %d missing\n", $got, $lost);
}

// A migration that quietly drops the gating would be the worst possible outcome,
// so say out loud what came across. This runs INSIDE the transaction, before
// the commit-or-rollback below, so a dry run reports the numbers the import
// would produce rather than the ones it started from — a verification block
// that describes the old state is worse than none, because it looks like proof.
$n = fn(string $sql) => (int)q1($sql)['c'];
echo "\nverification\n";
printf("  %-34s %d\n", 'people total',            $n('SELECT COUNT(*) c FROM persons'));
printf("  %-34s %d\n", 'gated (living or minor)', $n('SELECT COUNT(*) c FROM persons WHERE living = 1 OR is_minor = 1'));
printf("  %-34s %d\n", 'minors (admin-only)',     $n('SELECT COUNT(*) c FROM persons WHERE is_minor = 1'));
printf("  %-34s %d\n", 'member-tier photos',      $n("SELECT COUNT(*) c FROM media WHERE visibility <> 'public'"));
printf("  %-34s %d\n", 'admins',                  $n('SELECT COUNT(*) c FROM users WHERE is_admin = 1'));

// A dry run reads everything, does every write, reports exactly what a real run
// would do — and then throws it away. The point is to see the prune list before
// agreeing to it, on cutover day, against the real data rather than a rehearsal
// copy. Note the photo files fetched by --fetch-photos are NOT rolled back;
// they are only ever added, never replaced with something worse.
if ($dryRun) {
    db()->rollBack();
    echo "\nDRY RUN — everything above was rolled back, nothing was written.\n";
} else {
    db()->commit();
}

echo "\nCompare those against the Supabase numbers before pointing anyone at the new site.\n";
