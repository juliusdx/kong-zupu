# Deploying the Kong (江) Family Zupu

This is a **static site** (plain HTML/JS/CSS, no build step). It runs as-is on GitHub
Pages, and works offline by just opening `index.html`. A backend (Supabase or Firebase)
is **optional** and only needed for live accounts, photo uploads, and moderated
contributions — the tree, map, and admin lineage-confirmation all work without one.

---

## 1. GitHub — already set up

> ⚠️ **Historical section.** This describes first-time setup, which was done long ago.
> **Do not run `rm -rf .git`** — the repo is live at `github.com/juliusdx/kong-zupu` with
> full history. It also named the wrong folder: the canonical working directory is
> `China Lineage Trip **copy**/kong-zupu`; the sibling without "copy" holds only the
> git-ignored scans.

Day to day it is just:

```bash
cd "/Users/julius/Projects_2026/China Lineage Trip copy/kong-zupu"
git add -A && git commit -m "..." && git push
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

> **Out of date as of 2026-08-20.** The three placeholders this section was written for are
> all resolved from the book: gen 13 is **榮川公 字以賢** (pt1 p.27), gen 16 **朝纓 字成祥**
> (pt2 p.19) and gen 17 **龍躍** (pt2 p.27). `data/overrides.js` is still empty — the
> confirmations were written straight into `data/lineage.js` instead. The mechanism below
> still works if another ⚑ candidate set ever appears.

Generations 13–18 were reconstructed from the master charts. Nodes whose individual was
uncertain showed a ⚑ flag on the tree.

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

## 3b. API keys — READ THIS BEFORE TOUCHING `APP_CONFIG` (changed 2026-08-20)

The legacy JWT `anon` / `service_role` keys are **disabled**, and the **legacy HS256 JWT
secret is revoked**. Any older key in an old note or script is dead and will return
`PGRST301 "No suitable key was found to decode the JWT"`.

- The client uses the **publishable** key `sb_publishable_2T9FR7RBLUlH43SkJrppUg_LGLiQBT-`,
  in `index.html` under `APP_CONFIG.SUPABASE_ANON_KEY` (field name unchanged, value is not
  a JWT any more). It is safe in the public repo.
- Anything server-side needs a **secret** key (`sb_secret_…`) created in
  **Project Settings → API Keys**. `tools/backup.sh` takes one; it is NOT service_role.
- **Publishable and secret keys are not JWTs — send them on the `apikey` header only.**
  On `Authorization: Bearer` the platform may try to parse them as a JWT and refuse. This
  bit `js/contribute.js` and `tools/backup.sh`, both fixed.
- Current signing key is **ECC (P-256)**.

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

- **Private photos for living members (hardening).** Run **`supabase/migration_v10.sql`** once.
  It creates a **private `photos-private` bucket** so living members' photos are served only via
  short-lived signed URLs to signed-in family — never reachable by a public URL. Public/deceased
  and place photos stay in the public `photos` bucket and are unchanged. The app routes member-tier
  person photos to the private bucket automatically; on approval, a contributed member photo is
  moved out of the public pending area into the private bucket. **No data migration of existing
  files is performed** — if you already have member photos in the public bucket from before this
  change, re-upload them (or ask and I'll provide a one-off move script).

- **Visitor counter.** Run **`supabase/migration_v11.sql`** once. It adds a `counters` table
  (publicly readable) and a security-definer `bump_counter(key)` RPC granted to anonymous +
  signed-in visitors, so the header can show a **👁 N** visit count. The client bumps once per
  browser session (a `sessionStorage` guard) and otherwise just reads the value — a refresh isn't
  a new visit. It's a client-driven count (fine for a family site, not a fraud-proof metric).
  Until the migration is run the badge simply stays hidden — nothing else is affected.

- **Living members findable by name when signed out.** Run **`supabase/migration_v12.sql`** once.
  By default living members (`member` tier) are hidden from anonymous visitors, so a signed-out
  search/tree never includes them. This migration adds a **column-limited public view**
  (`persons_public_search`) that exposes ONLY name + romanizations + tree links (gender,
  father/spouse) for **living adults** — never their birth year, bio, **home location**, photos,
  or contacts, and **never minors**. The persons RLS is left untouched (so location/detail stay
  private); only the curated view is public. Signed-out visitors can then search living relatives
  and see them on the tree as name-only skeleton nodes. ⚠️ This intentionally makes living
  relatives' **names + lineage position public on the internet** — it's the opposite of the
  member-photo hardening; remove the view (`drop view public.persons_public_search;`) to revert.
  Until the migration is run, living members stay hidden to anon exactly as before.

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

---

## 7. Contributor notifications (edge function)

When an admin approves or rejects a submission, the app calls the
`notify-contributor` Supabase edge function to email the original submitter.
The function is in `supabase/functions/notify-contributor/index.ts`.

> ⚠️ **This section describes the original Resend wiring and is stale.** §8 below states
> that `notify-contributor` sends through a **Make.com webhook** (`MAKE_WEBHOOK_URL`, held
> in Vault), and that is the live arrangement. Read the deployed function before trusting
> the Resend steps here. Kept for the deploy mechanics, which are unchanged.

### One-time setup

**Step 1 — Run the migration** (Supabase SQL Editor):
```sql
-- paste contents of supabase/migration_v9.sql
alter table public.contributions
  add column if not exists reviewed_at    timestamptz,
  add column if not exists rejection_reason text;
```

**Step 2 — Get a Resend API key**
1. Sign up at [resend.com](https://resend.com) (free).
2. Create an API key under **API Keys**.
3. *(Optional but recommended)* Add and verify your domain under **Domains** so emails
   come from e.g. `noreply@yourdomain.com` instead of `onboarding@resend.dev`.

**Step 3 — Deploy the edge function**

Install the Supabase CLI if you haven't:
```bash
brew install supabase/tap/supabase
```

Log in and link your project:
```bash
supabase login
supabase link --project-ref <your-project-ref>   # found in Supabase dashboard URL
```

Deploy:
```bash
cd "/Users/julius/Projects_2026/China Lineage Trip copy/kong-zupu"
supabase functions deploy notify-contributor
```

**Step 4 — Set environment variables** (Supabase dashboard → Edge Functions →
`notify-contributor` → Secrets):

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | your Resend API key |
| `RESEND_FROM` | `noreply@yourdomain.com` (or `onboarding@resend.dev` for testing) |
| `SITE_URL` | `https://juliusdx.github.io/kong-zupu/` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — no need
to set them.

### How it works

- When a reviewer clicks **Approve** or **Reject**, the app writes `reviewed_at` and
  (if rejecting) `rejection_reason` to the `contributions` row, then calls the function.
- The function looks up the submitter's email from their auth account (if they were
  signed in) or from the free-text `contributorContact` field (anonymous submitters).
- If no email is found, it exits silently — the review still goes through.
- The notification is **fire-and-forget**: a failure never blocks the review action,
  just logs a warning in the browser console.

---

## 8. New-sign-up alerts to the admin (migration v13)

Nothing used to tell the admin that someone had signed up — new members could sit
unapproved indefinitely. `supabase/migration_v13.sql` adds a second AFTER INSERT
trigger on `auth.users` that POSTs to the **same Make.com webhook** already used by
`notify-contributor` (same `{ to, subject, html }` payload), so the Make scenario
needs no changes.

### One-time setup

Run `supabase/migration_v13.sql` in the SQL editor (already applied to the live
project), then store the webhook URL — the same value as the `notify-contributor`
edge function's `MAKE_WEBHOOK_URL` secret:

```sql
select vault.create_secret('https://hook.eu2.make.com/xxxxxxxx',
                           'MAKE_WEBHOOK_URL', 'Make.com email relay');
```

Check the wiring without creating a throwaway user:

```sql
select public.test_admin_signup_notification();
```

It returns `queued to <email>` on success, or names the missing Vault secret.

### How it works

- Secrets live in **Vault** (`MAKE_WEBHOOK_URL`, `ADMIN_NOTIFY_EMAIL`), read at call
  time — rotating either is a Vault update, no redeploy. The webhook URL is a
  send-email-as-us capability, so it must not sit in a function body.
- `pg_net.http_post` is **async**: a slow or dead webhook cannot delay a sign-up.
- The whole body is wrapped in an exception handler and no-ops when the secrets are
  missing. A notification failure must never cost a member — which is also why this
  is a *separate* trigger from `handle_new_user()`, where a fault surfaces as
  "Database error saving new user" and blocks all sign-ups.
- The email includes the ready-to-run `update profiles set approved = true` for that
  user, since approving is the usual next action.

### Approving a member

`profiles.approved` gates `person_details` — the detail of **living** members.
Un-approved accounts can sign in and see living relatives as name-only entries.

```sql
update profiles set approved = true
where id = (select id from auth.users where email = 'them@example.com');
```
