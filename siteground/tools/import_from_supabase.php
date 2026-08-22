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
        $page = json_decode($raw, true);
        if (!is_array($page)) { fwrite(STDERR, "bad response for {$table}: " . substr($raw, 0, 200) . "\n"); exit(1); }
        $rows = array_merge($rows, $page);
        $from += 1000;
    } while (count($page) === 1000);
    return $rows;
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

// profiles → users. Email lives in auth.users on Supabase, which the REST API
// does not expose, so it comes from the members_admin view the app already uses.
$members = sb_get('members_admin');
$users = array_map(fn($m) => [
    'id' => $m['id'], 'email' => strtolower((string)$m['email']), 'full_name' => $m['full_name'],
    'person_id' => $m['person_id'], 'is_admin' => $m['is_admin'], 'approved' => $m['approved'],
    'created_at' => $m['created_at'],
], array_filter($members, fn($m) => !empty($m['email'])));
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
