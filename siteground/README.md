# SiteGround backend

A PHP/MySQL replacement for the Supabase backend, keeping the same privacy model
and the same promise: **photos and sensitive information are not viewable without
signing in.**

**THE FAMILY'S SITE, at https://zupu.accme.my since 2026-08-30** (deployed and run
in parallel from 2026-08-26).
Relatives use this. The old GitHub Pages address now explains the move and
redirects here, so there is exactly one writable copy of the archive — see step 7.
The Supabase project still holds everything and must not be paused or deleted
until this has been dull for a while.

## Why move at all

The model on Supabase is sound and was working. What failed was consistency:
row-level security hid a photo's database row while the file itself sat in a
public storage bucket, so two member-only photos were fetchable by anyone with
the link. The gate and the artifact were two systems, and two systems drift.

Here they are one. Files live outside the web root, and `public/photo.php` checks
the session and the photo's visibility before it reads a single byte. **There is
no URL that bypasses the check**, because the URL *is* the check.

## Layout

    lib/visibility.php   the privacy model — the only definition of who sees what
    lib/repo.php         every read of a gated table; nothing else may SELECT
    lib/contributions.php every write the tree receives; submit and decide
    lib/uploads.php      receiving a photo; the counterpart to photo.php
    lib/auth.php         magic-link sign-in
    lib/notify.php       telling a contributor what happened to their submission
    lib/bootstrap.php    config, hardened session, viewer identity
    lib/db.php           PDO, real prepared statements
    public/photo.php     the gate and the file, one code path
    public/api/tree.php  the tree, filtered to the caller
    public/api/contribute.php  submit a contribution (open, signed out)
    public/api/review.php      the queue, and approve/reject (admins)
    public/api/upload.php      receive a photo, and approve or refuse one
    public/auth/*.php    request / verify / logout / me
    sql/schema.mysql.sql the target schema
    sql/schema.sqlite.sql the same schema for tests
    tools/import_from_supabase.php  idempotent migration, re-runnable
    tests/                what proves the above

## Tests

    php tests/run.php           # 54 assertions: visibility, detail, contacts, photos, tokens
    php tests/contributions.php # 44 assertions: submit, approve, reject, re-parent
    php tests/uploads.php       # 62 assertions: file types, subject gating, traversal,
                                #   staging, claiming, embedded photos, cover, delete
    php tests/members.php       # 31 assertions: roster gating, approve, promote, the locked doors
    php tests/http_photo.php    #  9 assertions: photo.php over real HTTP, incl. path traversal
    php tests/http_auth.php     # 30 assertions: the magic-link round trip over real HTTP
    php tests/notify.php        # 28 assertions: who the contributor note reaches, what it
                                #   says, and that a submission cannot inject html into it

258 assertions, all passing. `tests/run.php` includes the ones that would have
caught the original leak — a signed-out visitor must not be served a member
photo, and a minor's photo is admin-only whatever the media row says.
`http_auth.php` covers what a function call cannot: that the session survives as
a cookie, that `me.php` answers with the identity the sign-in button renders, and
that signing out ends it on the server rather than only in the page.

To drive it in a browser — the front-end and this API on ONE origin, which is
what the session cookie requires:

    php tools/serve_local.php --init                    # throwaway db + config
    php -S localhost:8910 -t .. tools/serve_local.php   # from siteground/
    php tools/serve_local.php --link keeper@localhost   # prints a sign-in link

It rewrites `BACKEND:"php"` into index.html as it serves, so the committed file
still says `supabase` and no local experiment can be pushed by accident. Add
`?backend=supabase` to check the other path on the same running server.

## The privacy model

| tier | who |
|---|---|
| `public` | anyone |
| `member` | any signed-in user |
| `admin` | admins |
| `is_minor` | admins only, whatever the tier says |

Detail (birth year, bio) and contacts are a *second* decision on top: an approved
member, or the person themselves. That two-step is deliberate — a relative who
signs up sees who their family are immediately, and the private detail only once
someone has vouched for them.

## Sign-in

Magic link, no passwords — the family is largely elderly relatives and a password
is one more thing to lose. The link necessarily carries a token, so: 32 random
bytes, only the SHA-256 hash stored, single use, 15 minutes, `hash_equals`, and
consumed-then-redirected so it leaves the address bar. Rate limited per address
and per IP.

Google OAuth is not carried over. It can be added, but magic link alone is the
simpler thing to get right, and it is the option that suits the relatives least
comfortable with accounts.

## Deploy day

`config.php` ships with `enforce_approval => false`. In that mode a signed-in but
not-yet-approved member still sees detail, and every such case is written to
`access_log` as `would_refuse`. Approve everyone the log turns up, then set it to
`true`.

**Done — the deployed config has been `true` since 2026-08-27.** The grace was
never load-bearing: `would_refuse` fired exactly twice, from one account (the
rehearsal one), and all 9 users were already `approved = 1` by the time it was
flipped, so the switch restricted nobody who existed. What it closes is the
*next* signup — `auth_login` still creates an account for anyone who completes a
link, and that account now lands unapproved and sees no living relative's detail
until someone approves it. Verified after the flip: a signed-out stranger gets
256 people, none carrying a detail field, no minors.

What that switch does **not** do: it never lets a signed-out visitor see member
content, and never reveals a minor. Those are absolute in both modes. It only
softens the approval step — the one that would otherwise lock relatives out on
day one.

## Order of operations

Steps 1–6 are **done** (2026-08-26); step 7 is the remaining decision.

1. ~~`tools/backup.sh` — full backup first, always.~~
2. ~~Create the MySQL database, run `sql/schema.mysql.sql`.~~ `tools/run_schema.php`
   does it and prints a row count per table; 11 tables.
3. ~~`tools/import_from_supabase.php`~~ — now takes **`--fetch-photos`**, which
   reads each object from the bucket it actually lives in rather than from a
   local backup that is only as fresh as the last one. Re-runnable, so rehearse
   it as often as you like while the live site keeps serving.
4. ~~Compare the counts it prints against Supabase.~~ Done and matched — see
   **Migration rehearsal** below. A migration that quietly drops the gating is
   the worst outcome, so this is checked rather than assumed.
5. ~~Point the front-end at `/api/tree.php` (one request replaces three).~~
   `tools/deploy_frontend.sh` puts the static site in the document root and
   rewrites `BACKEND` to `"php"` as it copies, so `index.html` in git keeps
   saying `"supabase"` for GitHub Pages.
   **`site_url` in config.php must be exactly the host relatives type.**
   `verify.php` redirects there after setting the session, and a redirect that
   crosses to a different spelling of the same server (`127.0.0.1` vs
   `localhost`, bare vs `www.`) leaves the cookie behind: the link appears to
   work, the page comes back signed out, and nothing logs an error.
6. ~~Run in parallel: both backends live, new one on a subdomain, until it's dull.~~ Done.

   **It did not stay dull, and the copies have diverged.** As of 2026-08-28
   Supabase holds **279 persons / 505 contributions**; MySQL still holds the
   import snapshot, **275 / 494**. Relatives added 4 people and 11 contributions
   on the 26th. Every one of those writes went to Supabase — **nothing has ever
   been written to MySQL** — which is the only reason this is recoverable.

   That is the rule this arrangement lives or dies by: **exactly one writable
   backend at a time.** `import_from_supabase.php` runs one way and uses
   `REPLACE INTO`, so it overwrites MySQL rows by primary key and carries
   nothing back. Rows created only on the MySQL side are not deleted by a
   re-import, but they never reach Supabase either, and no merge tool exists.
   A contribution submitted on `zupu.accme.my` while the family is still using
   the Pages site is therefore stranded. **Do not give relatives this URL
   until the cutover**, and re-run the import before any cutover so the
   snapshot is current.
7. ~~Cut over.~~ **Done 2026-08-30.** No DNS change was needed — `zupu.accme.my`
   already resolved to SiteGround and the deployed front-end already said
   `BACKEND: "php"`. What "cutover" actually meant here was stopping the OLD
   address serving a second writable copy: the Pages workflow now publishes
   `pages-moved.html` in place of `index.html`, so github.io explains the move
   and redirects. `index.html` stays the app in git because
   `deploy_frontend.sh` copies that same file; deleting the workflow step puts
   the old site back exactly.

   Order mattered: **writes were stopped first, then the import checked** — the
   other way round strands anything submitted in between. As it happened the
   two sides were already identical (322 / 522, nothing since 2026-08-29 12:17
   UTC), so no final import was needed. `enforce_approval` was already `true`
   from 2026-08-27.

   **Still to do:** re-run `--prune` in a day or two to catch anything sent
   from a browser tab still holding the old app, then pause (never delete) the
   Supabase project once this has been dull for a while.

   **When you do decide: pause it, do not delete it.** Paused projects do not
   count toward the free-tier cap — `DEPLOY.md` §3 says so, and the other
   account demonstrates it, running 3 projects on a plan that allows 2 active
   because one is paused. Pausing frees the slot, keeps the data, and stays
   reversible. Note also that the slot it frees is on
   **the zupu account's org**, which is *not* the account that holds
   `compliance-app` — see "The slot this does not free" below.

## What was blocked, and how it resolved

- ~~**SSH or FTP details**~~ — SSH, port 18765. The key is `~/.ssh/siteground_zupu`
  (created 2026-08-26; the older `siteground_key` has a forgotten passphrase and
  is dead). `~/.ssh/config` has a `Host zupu` entry, so it is just `ssh zupu`.
- ~~**PHP and MySQL versions**~~ — PHP 8.2.33 + pdo_mysql, MySQL 8.4.6.
- ~~**Where the home directory is**~~ — `media_root` is
  `/home/customer/www/zupu.accme.my/media`, a sibling of `public_html`. Verified
  unreachable: every direct path, `..` traversal and directory listing returns
  404 while `photo.php` serves the same bytes correctly.
- ~~**Is SMTP enabled** for the domain~~ — **answered 2026-08-22.** Mailbox
  `zupu@accme.my` exists; SPF/DKIM/DMARC all pass; authenticated SMTP works.
  Deliverability: Gmail inboxes us on first contact, Outlook/Live junks us
  despite perfect authentication (cold-sender reputation). Mitigated by the
  "check your spam folder" line in the sign-in response; relatives mark
  Not-Junk once and Microsoft remembers per-recipient. A transactional relay
  stays in reserve if anyone gets locked out. Retest any time:
  `php tests/mail_smtp.php <address> [label]` from `~/zupu-mailtest/`.
- **Where the home directory is**, so `media_root` can be set somewhere that is
  definitely not under `public_html`.

## Migration rehearsal (2026-08-26)

Every table matched Supabase, read back from MySQL rather than trusted from the
importer's own output:

| | Supabase | MySQL |
|---|---|---|
| persons | 275 | 275 |
| contributions | 494 | 494 |
| person_details | 48 | 48 |
| users | 9 | 9 (2 admins) |
| media | 6 | 6 |
| contacts / places / transcriptions | 2 / 1 / 0 | 2 / 1 / 0 |

132 living, 7 minors, 132 member-tier — the privacy flags survived — and 246
Han-character names came through utf8mb4 clean.

**The promise, verified against the live site as a stranger:** 0 minors, 0
detail on living people (no birth years, bios, places or coordinates), 0 of the
5 member photos served, no contacts in the payload. 122 living adults appear by
name and tree position only, which is the exception the family chose. Signed in,
the 3 approved member photos become fetchable (`private, no-store`) and the
unapproved one still 404s.

**Sign-in works end to end**, including mail: Julius requested a link through the
live form from his own IP and used it 12 seconds later, with no `mail_failed`
entries. The session layer was tested separately on a disposable `@zupu.invalid`
account (a reserved TLD that cannot route mail), which was then deleted.

Three bugs a cutover would otherwise have shipped silently, all found here:

1. **No accounts imported.** The importer read them from `members_admin`, a view
   gated `where public.is_admin()` — which resolves against a signed-in user's
   token, so a secret key gets zero rows however valid it is. The run *reported
   success*: 275 people, 494 contributions to review, and nobody able to sign in
   to review them. It now reads `profiles` + the Auth admin API, and refuses
   rather than reporting a cheerful zero.
2. **Ancestors' photos vanished.** `repo_media` LEFT JOINs the subject and gates
   on it, but a photo of a deceased ancestor points at an id only the 519-person
   seed in `data/lineage.js` knows — so every comparison was NULL and the row
   fell out for everyone but an admin, while `photo.php` served the same file
   happily to anyone with the id. Found by comparing against what the live
   Supabase site actually does, not by reading the code.
3. **A rejected key crashed instead of complaining.** `ignore_errors` made a 401
   arrive as content, and a PostgREST error object decodes to an array just like
   a row list does, so the error was merged in as data and died several frames
   later on `Column 'id' cannot be null`.

## Local harness

`tools/serve_local.php` runs the front-end and this API on **one origin**, which
the session cookie requires — serving them on different ports makes every request
look signed out and the bug you then chase is not in the code.

    php tools/serve_local.php --init                    # throwaway db + config
    php -S localhost:8910 -t .. tools/serve_local.php   # from siteground/
    php tools/serve_local.php --link keeper@localhost   # prints a sign-in link

Add `?backend=supabase` to check the other path on the same running server. Its
throwaway data lives in the system temp dir — an earlier version kept it under
`tools/`, inside the directory the server hands out, so a staged photo was
fetchable at its own URL and the harness demonstrated the opposite of the
property it exists to demonstrate. It also refuses `/siteground/` outright, since
serving the repo root would otherwise hand out `config.php`.

## Ported to the adapter so far

Sign-in, the review queue, and the members panel now go through `js/backend.js`
and work end to end on this backend — verified in a browser against a local PHP
server, not only in tests.

- **Auth.** `js/auth.js` has two drivers behind one `window.Auth`. The PHP one
  builds its state from `/auth/me.php`, which now also returns the email, name
  and user id that the sign-in button and write-attribution need. Google is
  Supabase-only, so the UI asks `Auth.googleAvailable()` and hides the button
  rather than offering something that cannot work. `verify.php` redirects back
  with `?signin=ok|expired`; the page reads that marker at load, strips it from
  the URL, and explains an expired link instead of failing silently.
- **Review.** `review.php` now names the reviewer on each row, so the decision
  history reads "Julius Kong" without a members lookup. The adapter translates
  its camelCase into the shape the existing card renderer expects, and passes
  `target` / `renameWarning` / `unprefilled` straight through — those are the
  mistargeting guard and are not the adapter's to tidy away.
- **Members.** New: `lib/members.php`, `public/api/members.php`,
  `tests/members.php`. Two refusals live here rather than in the UI — no
  self-demotion, and **no removing the last reviewer**, which the Supabase
  version could not express (two admins demoting each other reach the same
  locked door by a longer route).
- **Photos.** Upload, approve, refuse, choose the tree avatar, delete — and both
  ways a contribution can carry a photo. This is where the two designs differ
  most, and where the migration actually pays:

  | | Supabase | here |
  |---|---|---|
  | where the tier lives | which bucket the bytes are in | a column `photo.php` reads per request |
  | changing the tier | copy between buckets, delete the old copy | `UPDATE media SET visibility` |
  | a pending photo | sat in the **public** bucket, fetchable by link | `approved = 0`, which already means admin-only |
  | serving one | mint a signed URL, hope nothing caches it | one URL, checked when the bytes are asked for |

  So `attachContribPhoto`'s copy-between-buckets dance — the code that put a
  member photo in the public bucket in the first place — has no counterpart
  here. Approving a staged photo moves no bytes at all.

  Two new shapes on the server. A **staged** upload (`staged=1`) has no subject
  yet: it is the contribution form's case, where the person does not exist until
  a reviewer approves them. `upload_attach()` claims it and takes the tier from
  the real subject, not from the guess made at staging — and refuses a minor
  *again* at that point, because the person may have been created as one, and
  refusing means deleting the bytes. A **data: URL** in the payload is how a
  signed-out relative sends a photo, since an anonymous endpoint that writes
  files to our disk is a risk we declined; `upload_from_data_url()` turns it
  into a real file at approval, validating the bytes with `getimagesize` rather
  than believing the `data:image/png` header.

  Note what the client no longer sends: **the tier**. The server reads it off
  the subject, so a client asking for "public" on a living relative cannot have
  it.

## Still to build

- **The rest of the front-end swap.** 58 Supabase call sites remain outside the
  adapter, down from 77 — but most are no longer *unported*. They are the
  Supabase half of a capability that now has both halves, sitting behind an
  `if (Backend.isPhp())` branch, which is precisely what lets the two run side
  by side. What is genuinely still Supabase-only:
  - **the proofreader** (`transcriptions`) and **the Sources tab** (the
    `documents` bucket, 4 storage calls) — no PHP endpoint at all;
  - **the visitor counter** (`counters` + the `bump_counter` rpc);
  - **archiving and restoring people**, and the admin **privacy check**, which
    compares gated rows against the public `lineage.js`;
  - ~~the **`notify-contributor` edge function**~~ — **ported 2026-08-29.**
    `lib/notify.php` composes the same bilingual note and `public/api/review.php`
    sends it through `lib/mailer.php`, so it goes out from zupu@accme.my over
    the same authenticated SMTP as the sign-in links, with no Make webhook and
    no third party in the path. The build is separated from the send so the
    message is testable without a mail server, which is the split
    `public/auth/request.php` already used. Two deliberate differences from the
    edge function: the submitter's *name* now comes from their account even
    when they typed an address in the form (it previously greeted a signed-in
    relative as "Family member"), and a failed send is logged as
    `notify_failed` rather than surfaced, because a reviewer who approved
    something correctly must not be told it failed.
- **Transcriptions** have no PHP endpoint, so the proofreader stays on Supabase.
- ~~**`enforce_approval` is `false`**~~ — **flipped to `true` 2026-08-27**, see
  "Deploy day" above. `auth_login` still creates an account for anyone who
  completes a link; that account is now unapproved and sees no living relative's
  detail until approved, which is what makes the open sign-up survivable.
- **Cutover itself**: DNS, the final import re-run, and what happens to the
  Supabase project. Note `DEPLOY.md` §3 records the cap as **2 active projects
  per account across all organisations**, so a second free org does *not* buy a
  slot; pausing a project, or a different Google account, is what does. Verify
  against Supabase's current terms before relying on either.

  **The slot this does not free.** Retiring the zupu was described here as
  freeing "the free-tier slot that started this". That is wrong, and it was
  wrong in a way worth spelling out, because it made a risky migration look
  urgent. Checked 2026-08-27:

  | account | org | projects |
  |---|---|---|
  | the zupu account | `xerzbrhyjiewlosyctoy` (free) | **kong-family-zupu**, Gemuk attendance — 2 active, at cap |
  | the other login | PKA Org (free) | **compliance-app (paused)**, kira, pka-timesheet-sin1 — 2 active, at cap |

  They are **two different Supabase accounts**, each listing only its own org.
  So retiring the zupu drops the zupu account to one active project and
  frees a slot *there*. `compliance-app` is on the other account and stays
  paused regardless. Making that slot reach it needs a cross-account project
  transfer (both accounts joined to one org first). The direct lever is instead
  to free a slot inside PKA Org — and `pka-timesheet-sin1` is live and
  **non-negotiable**, so `kira` is the only candidate there.

  The practical consequence: **the slot is not a reason to rush the cutover.**
  The reason to cut over is that `github.io` is blocked in mainland China and
  relatives there cannot reach the family's site at all.
- **The honest caveat about running side by side.** An unported READ still works
  on either switch, because the publishable key reaches public data. An unported
  *write* or *gated read* does not: it needs a Supabase session, and on this
  backend the session is a PHP cookie. So each capability is wholly on one side
  or the other, and the ones still listed here are Supabase-only while the
  switch says `php`.
