#!/usr/bin/env bash
#
# Put the static front-end into the SiteGround document root, pointed at the
# PHP backend.
#
#     tools/deploy_frontend.sh [ssh-host]        # default host: zupu
#
# WHY THE FRONT-END HAS TO LIVE HERE AT ALL. The API sends no CORS headers and
# its session cookie is SameSite=Lax, so a page served from anywhere else —
# GitHub Pages included — cannot call it. Not a limitation to work around: a
# same-origin API is the safer arrangement, and it is what the local harness
# models too. The consequence is simply that the site and the API share a host.
#
# WHY BACKEND IS REWRITTEN RATHER THAN COMMITTED. index.html in git says
# "supabase", because that is what GitHub Pages serves and what the family uses
# today. This deployment says "php". One source file, rewritten at deploy time,
# so the two deployments cannot drift and a local experiment cannot be pushed
# into the live site by accident.
#
# Only what the site actually loads is copied. The repo also carries the PHP
# backend, the SQL migrations and node_modules, none of which belong in a
# document root — the same reasoning as the Pages workflow.
set -euo pipefail

HOST="${1:-zupu}"
SITE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEST="~/www/zupu.accme.my/public_html"

echo "deploying $SITE  ->  $HOST:$DEST"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

for item in index.html css js data img; do
    [ -e "$SITE/$item" ] || { echo "missing: $item" >&2; exit 1; }
    cp -R "$SITE/$item" "$STAGE/"
done

# Point it at this backend. Fail loudly rather than deploy a site that silently
# talks to Supabase from a host whose cookies Supabase will never see.
if ! grep -q 'BACKEND: "supabase"' "$STAGE/index.html"; then
    echo "refusing: could not find BACKEND in index.html" >&2
    exit 1
fi
sed -i.bak 's/BACKEND: "supabase"/BACKEND: "php"/' "$STAGE/index.html"
rm -f "$STAGE/index.html.bak"
grep -q 'BACKEND: "php"' "$STAGE/index.html" || { echo "refusing: rewrite failed" >&2; exit 1; }

# STAMP EVERY LOCAL SCRIPT AND STYLESHEET WITH THIS DEPLOY'S VERSION.
#
# The tags are plain paths — js/app.js — and the server sends last-modified and
# an etag but no Cache-Control, so a browser is free to apply heuristic caching
# and serve yesterday's JavaScript for days without asking. That is not a
# theoretical risk: a reviewer reported that "mark as verified" did nothing,
# and the button was fine — her browser was running a copy of app.js from
# before that capability existed, so the click fell through to a branch that
# silently does nothing. Every deploy after this one busts the cache by
# changing the URL, which is the only mechanism that does not depend on the
# browser choosing to revalidate.
#
# data/*.js is stamped too: lineage.js changes with every transcription batch,
# and a stale copy of that is a family tree missing its newest relatives.
VERSION="$(date -u +%Y%m%d%H%M%S)"
perl -pi -e '
    s{(<script src="(?:js|data)/[^"]+?)(\?v=[^"]*)?"}{$1?v='"$VERSION"'"}g;
    s{(<link[^>]*href="css/[^"]+?)(\?v=[^"]*)?"}{$1?v='"$VERSION"'"}g;
' "$STAGE/index.html"
STAMPED=$(grep -c "?v=$VERSION" "$STAGE/index.html" || true)
[ "$STAMPED" -gt 0 ] || { echo "refusing: nothing was version-stamped" >&2; exit 1; }
echo "stamped $STAMPED local asset(s) with ?v=$VERSION"

# --delete would take api/, auth/ and photo.php with it: those are the backend,
# living in the same directory. Deliberately additive.
rsync -a --itemize-changes \
    --exclude '.DS_Store' \
    -e ssh "$STAGE"/ "$HOST:$DEST/"

echo "done — https://zupu.accme.my/"
