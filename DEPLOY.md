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

### Enable GitHub Pages
On github.com → your repo → **Settings → Pages**:
- **Source:** Deploy from a branch
- **Branch:** `main`  /  **Folder:** `/ (root)`
- Save. After ~1 min the site is live at
  `https://<your-username>.github.io/kong-zupu/`

`.nojekyll` is already included so GitHub serves the files untouched.
The original book scans (`*.pdf`) are git-ignored and will **not** be published.

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

> Still static-tree by design: approving a contribution marks it `approved` in the
> database; it doesn't yet auto-appear on the tree (the tree renders from
> `data/lineage.js`). Promoting approved entries onto the live tree is the next
> milestone — wiring the tree to read from the `persons` table.
