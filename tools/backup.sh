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
: "${PGURI:?set PGURI — see the header of this script}"
: "${SUPABASE_URL:?set SUPABASE_URL}"
: "${SUPABASE_KEY:?set SUPABASE_KEY (service-role)}"

mkdir -p "$OUT/storage"
echo "→ $OUT"

# 1. Schema and data. Roles/ownership are skipped: they don't restore onto a different
#    host, and the point of this dump is to be portable.
echo "  schema…"
pg_dump "$PGURI" --schema-only --no-owner --no-privileges --schema=public > "$OUT/schema.sql"
echo "  data…"
pg_dump "$PGURI" --data-only  --no-owner --no-privileges --schema=public > "$OUT/data.sql"

# 2. Storage. The buckets hold the family's photos and the scanned book — the part that
#    cannot be re-typed from the book if it is lost.
for BUCKET in photos photos-private documents; do
  echo "  bucket $BUCKET…"
  mkdir -p "$OUT/storage/$BUCKET"
  curl -s -X POST "$SUPABASE_URL/storage/v1/object/list/$BUCKET" \
    -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"prefix":"","limit":1000}' \
  | python3 -c '
import sys, json
for o in json.load(sys.stdin):
    if o.get("name"): print(o["name"])
' > "$OUT/storage/$BUCKET.list"

  # list only returns one level, so walk any folders it reported
  while read -r ENTRY; do
    [ -z "$ENTRY" ] && continue
    curl -s -X POST "$SUPABASE_URL/storage/v1/object/list/$BUCKET" \
      -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"prefix\":\"$ENTRY\",\"limit\":1000}" \
    | python3 -c "
import sys, json
for o in json.load(sys.stdin):
    n = o.get('name')
    if n and o.get('id'): print('$ENTRY/' + n)
"
  done < "$OUT/storage/$BUCKET.list" >> "$OUT/storage/$BUCKET.files" || true

  # the top level may itself hold files, not just folders
  cat "$OUT/storage/$BUCKET.list" >> "$OUT/storage/$BUCKET.files"

  sort -u "$OUT/storage/$BUCKET.files" | while read -r F; do
    [ -z "$F" ] && continue
    DEST="$OUT/storage/$BUCKET/$F"
    mkdir -p "$(dirname "$DEST")"
    CODE=$(curl -s -o "$DEST" -w '%{http_code}' \
      "$SUPABASE_URL/storage/v1/object/$BUCKET/$F" \
      -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY")
    [ "$CODE" = "200" ] || rm -f "$DEST"      # folders come back as errors; drop them
  done
done

# 3. The public static data, so a restore doesn't depend on the repo being reachable.
cp "$(dirname "$0")/../data/lineage.js" "$OUT/lineage.js"

echo
echo "done:"
du -sh "$OUT"
find "$OUT/storage" -type f ! -name '*.list' ! -name '*.files' | wc -l | xargs echo "  files backed up:"
