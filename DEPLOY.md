# Deploying the Kong (江) Family Zupu

This is a **static site** (plain HTML/JS/CSS, no build step). It runs as-is on GitHub
Pages, and works offline by just opening `index.html`. A backend (Supabase or Firebase)
is **optional** and only needed for live accounts, photo uploads, and moderated
contributions — the tree, map, and admin lineage-confirmation all work without one.

---

## 1. Put it on GitHub (run these in your own macOS Terminal)

> ⚠️ Git must be run from **your Terminal**, not from inside the assistant's sandbox.
> The assistant created a partial `.git` folder that its sandbox can't clean up, so
> start by removing it and re-initialising cleanly:

```bash
cd "/Users/julius/Projects_2026/China Lineage Trip/kong-zupu"

# 1. clean any half-made repo from the sandbox
rm -rf .git

# 2. fresh repo
git init -b main
git add -A
git commit -m "Kong family zupu: tree, map, contribute, admin lineage confirmation"
```

Then create an **empty** repo on github.com (e.g. `kong-zupu`, no README), and:

```bash
git remote add origin https://github.com/<your-username>/kong-zupu.git
git push -u origin main
```

### Enable GitHub Pages (auto-deploy via Actions)
The repo includes `.github/workflows/deploy.yml`, which publishes the site automatically
on every push to `main`. To switch it on once:

On github.com → your repo → **Settings → Pages** → **Source: GitHub Actions**.

That's it. From now on, every `git push` triggers a deploy (watch progress under the
repo's **Actions** tab). After the first run the site is live at
`https://<your-username>.github.io/kong-zupu/`.

> Use **GitHub Actions** as the source, *not* "Deploy from a branch" — the workflow
> handles deployment. `.nojekyll` is included so files are served untouched, and the
> original book scans (`*.pdf`) are git-ignored and will **not** be published.

To deploy manually any time: repo **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**.

---

## 2. Admin: confirming the uncertain ancestors

Generations 13–18 were reconstructed from the master charts. A few nodes
(gen 13 川, 16 朝, 17 龍) are still **placeholders** — the generation is certain but the
exact individual isn't. They show a ⚑ flag on the tree.

To confirm one:
1. Open the site with `?admin=1`, e.g.
   `https://<you>.github.io/kong-zupu/?admin=1`
2. Click a ⚑ ancestor → the drawer lists **candidate ancestors**.
3. Click **“Set as correct”** on the right person.
4. A bar appears at the bottom → **“Download overrides.js”**.
5. Replace `data/overrides.js` with the downloaded file, commit, and push:
   ```bash
   git add data/overrides.js && git commit -m "Confirm gen-13 ancestor" && git push
   ```

Why this design: the base transcription (`data/lineage.js`) is never altered, so every
confirmed decision is a clean, reversible, version-controlled diff. When a real backend
is connected later, the same click can write to the database instead of a file.

> The `?admin=1` gate is a convenience only — it is **not** real security (anyone could
> type it). It's fine for a static site because the only thing it unlocks is generating
> a file *you still have to commit*. Real, enforced admin rights come with the backend
> in step 3. You can add a soft passphrase now by setting `ADMIN_PASS` in
> `window.APP_CONFIG` inside `index.html`.

---

## 3. Backend: Supabase vs Firebase

You hit Supabase's free-tier cap. Important correction: that cap is **2 active projects
per account, counted across *all* your organisations** — so making a *new org* on the
same Google login does **not** give you more. Your real options:

**To keep using Supabase (recommended — the schema is already written):**
- **Pause** one of your two existing projects (paused projects don't count toward the
  limit), *or*
- Create the family-tree project under a **different Google account** (a fresh free tier).

Then paste the project URL + anon key into `window.APP_CONFIG` in `index.html` and run
`supabase/schema.sql`. Done — accounts, uploads, the 3-tier privacy (public lineage /
members-only living info / private contacts) and minors-hidden are all enforced by the
Postgres Row-Level Security already in that file.

### Is Firebase a good alternative?
Yes — it's a solid, genuinely-free option (Spark plan, no credit card). For this app the
trade-off is:

| | **Supabase** (what we built) | **Firebase** (Spark) |
|---|---|---|
| Data model | Postgres / **relational** — fits parent↔child lineage & joins naturally | Firestore / **NoSQL** — you'd denormalise the tree |
| Privacy tiers | **Row-Level Security** — already written in `schema.sql` | Re-express as Firestore **security rules** (fiddlier for row-level/minor rules) |
| Auth | Email + social, RLS-aware | Email + social, **up to 50k MAU** (very generous) |
| Storage (photos) | 1 GB free | 5 GB free |
| Hosting | use GitHub Pages | Firebase Hosting (could replace GitHub Pages) |
| Work to switch | none (built) | **rewrite the data layer + rules** |

**Recommendation:** stay on **Supabase** and just free up a slot (pause a project, or use
a second Google account). It's zero extra work and relational storage is the right shape
for a genealogy. Choose **Firebase** only if you'd rather not touch your Supabase account
at all and don't mind re-modelling the data as Firestore documents — in which case
Firebase's all-in-one auth + storage + hosting is a clean, free home.

A third option if you ever outgrow both: a free Postgres host (e.g. Neon) reusing the
same `schema.sql`, paired with any auth provider.

---

## 4. Turn on sign-in (Supabase dashboard)

The app supports **email magic-link** and **Google**. Configure both in your project:

### 4a. URL configuration (required for any redirect to work)
**Authentication → URL Configuration:**
- **Site URL:** `https://<your-username>.github.io/kong-zupu/`
- **Redirect URLs:** add that same URL. (OAuth/magic-link won't redirect back to a
  `file://` page, so test on the deployed site, not by double-clicking index.html.)

### 4b. Email magic-link
Enabled by default — nothing to do. Note the free tier uses Supabase's shared email
sender and is rate-limited (a few per hour) and can land in spam; fine for a family.
For higher volume, add custom SMTP under **Authentication → Emails** later.

### 4c. Google
1. In **Google Cloud Console** → APIs & Services → Credentials → Create **OAuth client ID**
   (type: Web application).
2. Add this **Authorized redirect URI:**
   `https://pefnwwlbjfksyaenapgv.supabase.co/auth/v1/callback`
3. Copy the **Client ID** and **Client secret**.
4. In Supabase → **Authentication → Providers → Google** → enable, paste both → save.

### 4d. Make yourself admin
After you sign in once (so your account exists), run in the SQL editor:
```sql
update profiles set is_admin = true
where id = (select id from auth.users where email = 'YOUR_NEW_GMAIL');
```
Reload the site — you'll see a **★** by your name and a new **審核 Review** tab to
approve/reject contributions.

### What sign-in unlocks now
- **★ Review tab** (admins only): triage the `contributions` queue — Approve / Reject.
- Header shows your name + sign-out; the sign-in modal offers magic-link and Google.

---

## 5. Live tree + photo uploads (schema v2)

Run **`supabase/migration_v2.sql`** once (SQL Editor → paste → Run). It's safe because
the data tables are still empty — it recreates `persons`/`places` with **text slug ids**
(so a live row can point at a seed ancestor, e.g. a new child's `father_id = "k_hanqiang"`)
and adds a **`media`** table for photos.

How it works after that:

- **Hybrid data model.** The historical spine stays in `data/lineage.js` (version-controlled,
  precious). The app loads it, then **merges any database rows on top** — additions and
  edits live in Supabase, the transcription stays in git. Best of both.
- **Approve → appears on the tree.** In the ★ Review tab, approving an *add child* / *add
  spouse* contribution inserts a `persons` row linked to the chosen relative; the tree
  refreshes and the new person shows up. (Reject just marks it rejected.)
- **Photos.** Any signed-in member opens a person → **＋ Add a photo** → it uploads to the
  `photos` Storage bucket and creates a `media` row. New photos are **pending** (visible
  only to the uploader and admins) until an admin clicks **Approve** on the photo in the
  drawer. Photos of living members sit in the member tier (signed-in only); minors stay
  hidden by the same RLS as everywhere else.

- **Contributed map pins.** Approving an *add a location* contribution inserts a `places`
  row (with the submitter's place type, name, and GPS) and the map redraws to show the new
  pin immediately. The Contribute form now has a **Place type** + **Place name** field for this.

- **Place detail drawer + member pin-correction.** Clicking any pin (or a birth/burial/
  residence link in a person drawer) opens a **place drawer** showing the type, modern
  location, linked people and photos. Anyone can hit **📍 Pin the exact location**, drop/drag
  a marker on the map, and submit it — this lands in the Review queue as an `update_place`
  contribution; approving it writes the new GPS to the `places` row and clears the *approx.*
  flag. Coordinates in `data/lineage.js` are now split into **verified** (county/town seats,
  Sabah towns, the 寧化石壁 Hakka site — `approximate:false`) vs **approximate** (village
  graves/halls/origins — left for relatives to pin precisely). Each carries a `modern:` field
  mapping the historical name to today's administrative location.

- **Location photos.** Signed-in members can attach photos to a place (graves, 祠堂, churches)
  from the place drawer — same pending→admin-approve moderation as person photos. **Requires
  running `supabase/migration_v3.sql` once** (adds `place_id` to `media`).

Still on the roadmap (say the word): member self-service contact info, and richer per-photo
captions / cover-photo selection.

---

## 6. Bilingual UI + mainland China access

- **中文 / English.** The interface auto-detects the visitor's browser language (Chinese →
  中文, otherwise English) and a **中文 / EN** button in the header lets anyone switch; the
  choice is remembered. Genealogical content (names, biographies) stays in the original
  Chinese; only the interface chrome is translated. Strings live in `js/i18n.js`.
- **Reading needs no login**, so mainland relatives can browse the whole public tree and map.
- **Mainland-friendly assets.** Fonts use only system CJK fonts (Songti/SimSun/Han Serif) —
  no Google Fonts (which is blocked in China). `supabase-js` loads from unpkg (Cloudflare-
  backed, more reliable there than jsdelivr); d3 + MapLibre load from cdnjs (Cloudflare).
- **Known China caveats:**
  - **Google sign-in won't work in mainland China** (Google is blocked) — magic-link email is
    the fallback, if the reader's email is reachable. Reading doesn't require sign-in at all.
  - **GitHub Pages and the OpenStreetMap tiles can be slow** behind the Great Firewall. If
    access becomes a real problem, the next step is mirroring the site to a China-reachable
    host and switching map tiles — ask and I'll set it up.
  - For maximum resilience you can **self-host** d3/MapLibre/supabase-js in a `vendor/` folder
    instead of CDNs (removes all third-party dependencies); ask if you want that.
