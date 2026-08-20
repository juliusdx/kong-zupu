#!/usr/bin/env bash
# Full backup of the zupu backend — schema, data, and the storage buckets.
#
# WHY THIS EXISTS
# A 20-year family archive was living on a free tier with no backup. Whatever happens
# with hosting, this is the thing that means a bad day costs an afternoon, not the
# archive. Run it before any migration, and on a schedule after.
#
# USAGE
#   PGURI='postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres' \
#   SUPABASE_URL=https://<ref>.supabase.co \
#   SUPABASE_KEY=<service-role key> \
#   tools/backup.sh [output-dir]
#
# Get PGURI from: Supabase dashboard → Project Settings → Database → Connection string
# (URI). Get the service-role key from Project Settings → API.
#
# Needs: pg_dump (brew install libpq), curl, python3.
set -euo pipefail

OUT="${1:-$HOME/Projects_2026/China Lineage Trip/zupu-backups/$(date +%Y-%m-%d_%H%M)}"

# Credentials are prompted for when not already set. Putting them on the command
# line means one very long line, which mangles on paste and leaves both secrets
# sitting in shell history. Typed here they are echoed nowhere and stored nowhere.
ask() {                       # ask VAR "prompt" [default]
  local var="$1" prompt="$2" default="${3:-}" val=""
  if [ -n "${!var:-}" ]; then return 0; fi
  if [ ! -t 0 ]; then echo "$var is not set and there is no terminal to ask on." >&2; exit 1; fi
  if [ -n "$default" ]; then
    printf '%s [%s]: ' "$prompt" "$default" >&2; IFS= read -r val || true
    val="${val:-$default}"
  else
    printf '%s: ' "$prompt" >&2; IFS= read -rs val || true; printf '\n' >&2
  fi
  [ -n "$val" ] || { echo "$var is required." >&2; exit 1; }
  printf -v "$var" '%s' "$val"
}
ask SUPABASE_URL "Project URL" "https://pefnwwlbjfksyaenapgv.supabase.co"
ask PGURI        "Session-pooler URI (dashboard > Database > Connection string)"
ask SUPABASE_KEY "Secret key (sb_secret_...)"

# pg_dump must be at least as new as the server, or it refuses outright. Homebrew
# often leaves an older one first on PATH, so find a good one rather than blaming
# the user for a PATH they did not know they had.
SERVER_MAJOR=17
if ! command -v pg_dump >/dev/null || [ "$(pg_dump --version | sed -E 's/.* ([0-9]+).*/\1/')" -lt "$SERVER_MAJOR" ]; then
  for CAND in /opt/homebrew/opt/postgresql@*/bin /usr/local/opt/postgresql@*/bin /opt/homebrew/opt/libpq/bin; do
    if [ -x "$CAND/pg_dump" ] && [ "$("$CAND/pg_dump" --version | sed -E 's/.* ([0-9]+).*/\1/')" -ge "$SERVER_MAJOR" ]; then
      PATH="$CAND:$PATH"; break
    fi
  done
fi
if ! command -v pg_dump >/dev/null; then
  echo "pg_dump not found. brew install postgresql@17" >&2; exit 1
fi
echo "  using $(command -v pg_dump) ($(pg_dump --version))"

mkdir -p "$OUT/storage"
echo "→ $OUT"

# 1. Schema and data. Roles/ownership are skipped: they don't restore onto a different
#    host, and the point of this dump is to be portable.
echo "  schema…"
pg_dump "$PGURI" --schema-only --no-owner --no-privileges --schema=public > "$OUT/schema.sql"
echo "  data…"
pg_dump "$PGURI" --data-only  --no-owner --no-privileges --schema=public > "$OUT/data.sql"

# Auth headers depend on the key type. The legacy service_role key was a JWT and
# wanted both headers. A modern secret key (sb_secret_…) is NOT a JWT: sent as a
# Bearer token the platform tries to parse it as one and refuses, so it goes on
# the apikey header alone.
EMPTY_BUCKETS=0

case "$SUPABASE_KEY" in
  sb_secret_*|sb_publishable_*) SB_AUTH=(-H "apikey: $SUPABASE_KEY") ;;
  *) SB_AUTH=(-H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY") ;;
esac

# 2. Storage. The buckets hold the family's photos and the scanned book — the part that
#    cannot be re-typed from the book if it is lost.
for BUCKET in photos photos-private documents; do
  echo "  bucket ${BUCKET}…"
  mkdir -p "$OUT/storage/$BUCKET"
  # List the bucket recursively. The API returns one level at a time: entries with
  # an id are objects, entries without are folders. Walking a fixed two levels — as
  # this did — silently dropped anything deeper, and contribution photos stage at
  # contrib/<uuid>/<file>, which is three. A backup that quietly skips a whole
  # shape of file is the kind of thing you discover when you need it.
  SUPABASE_URL="$SUPABASE_URL" SUPABASE_KEY="$SUPABASE_KEY" BUCKET="$BUCKET" \
  python3 - > "$OUT/storage/$BUCKET.files" <<'PY'
import json, os, sys, urllib.request

url    = os.environ["SUPABASE_URL"].rstrip("/")
key    = os.environ["SUPABASE_KEY"]
bucket = os.environ["BUCKET"]
hdrs   = {"apikey": key, "Content-Type": "application/json"}
if not key.startswith(("sb_secret_", "sb_publishable_")):
    hdrs["Authorization"] = "Bearer " + key   # legacy JWT keys want both

def page(prefix):
    out, offset = [], 0
    while True:
        body = json.dumps({"prefix": prefix, "limit": 1000, "offset": offset}).encode()
        req  = urllib.request.Request(
            "%s/storage/v1/object/list/%s" % (url, bucket), data=body, headers=hdrs)
        try:
            data = json.load(urllib.request.urlopen(req))
        except Exception as e:
            sys.exit("  ! listing %s/%s failed: %s" % (bucket, prefix, e))
        if not isinstance(data, list):
            sys.exit("  ! listing refused: %s" % json.dumps(data)[:300])
        out += data
        if len(data) < 1000:
            return out
        offset += len(data)          # keep paging; a bucket can outgrow one page

seen, queue = [], [""]
while queue:
    prefix = queue.pop()
    for o in page(prefix):
        name = o.get("name")
        if not name:
            continue
        full = prefix + name if not prefix else prefix + "/" + name
        if o.get("id"):
            seen.append(full)        # an object
        else:
            queue.append(full)       # a folder: go deeper
for f in sorted(set(seen)):
    print(f)
PY

  # A key without storage access lists an empty bucket rather than erroring, so a
  # silent zero would look exactly like a successful backup. Say so loudly: an
  # archive you think you have is worse than one you know you don't.
  WANT=$(grep -c . "$OUT/storage/$BUCKET.files" || true)
  echo "    listed $WANT object(s)"
  if [ "$WANT" -eq 0 ]; then
    echo "  ! $BUCKET listed 0 objects — SUPABASE_KEY may not be able to read storage."
    EMPTY_BUCKETS=$((EMPTY_BUCKETS + 1))
  fi

  sort -u "$OUT/storage/$BUCKET.files" | while read -r F; do
    [ -z "$F" ] && continue
    DEST="$OUT/storage/$BUCKET/$F"
    mkdir -p "$(dirname "$DEST")"
    CODE=$(curl -s -o "$DEST" -w '%{http_code}' \
      "$SUPABASE_URL/storage/v1/object/$BUCKET/$F" \
      "${SB_AUTH[@]}")
    [ "$CODE" = "200" ] || { echo "  ! $BUCKET/$F -> HTTP $CODE"; rm -f "$DEST"; }
  done

  # Listed and downloaded must agree. A 404 or a permission failure on a single
  # object would otherwise vanish into a count nobody checks.
  GOT=$(find "$OUT/storage/$BUCKET" -type f | wc -l | tr -d ' ')
  if [ "$GOT" -ne "$WANT" ]; then
    echo "  ! $BUCKET: listed $WANT but downloaded $GOT. Backup is INCOMPLETE."
    EMPTY_BUCKETS=$((EMPTY_BUCKETS + 1))
  fi
done

# 3. The public static data, so a restore doesn't depend on the repo being reachable.
cp "$(dirname "$0")/../data/lineage.js" "$OUT/lineage.js"

echo
echo "done:"
du -sh "$OUT"
find "$OUT/storage" -type f ! -name '*.list' ! -name '*.files' | wc -l | xargs echo "  files backed up:"
for B in photos photos-private documents; do
  echo "    $B: $(find "$OUT/storage/$B" -type f 2>/dev/null | wc -l | tr -d ' ')"
done
if [ "$EMPTY_BUCKETS" -gt 0 ]; then
  echo
  echo "INCOMPLETE: $EMPTY_BUCKETS bucket(s) came back empty. Do not treat this as a backup."
  exit 1
fi
