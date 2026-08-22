# SiteGround backend

A PHP/MySQL replacement for the Supabase backend, keeping the same privacy model
and the same promise: **photos and sensitive information are not viewable without
signing in.**

Nothing here is deployed. It runs and is tested locally; the steps that need
SiteGround access are listed at the bottom.

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

    php tests/run.php           # 50 assertions: visibility, detail, contacts, photos, tokens
    php tests/contributions.php # 44 assertions: submit, approve, reject, re-parent
    php tests/uploads.php       # 28 assertions: file types, subject gating, traversal
    php tests/http_photo.php    # photo.php over real HTTP, including path traversal

Both pass. `tests/run.php` includes the assertions that would have caught the
original leak — a signed-out visitor must not be served a member photo, and a
minor's photo is admin-only whatever the media row says.

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

What that switch does **not** do: it never lets a signed-out visitor see member
content, and never reveals a minor. Those are absolute in both modes. It only
softens the approval step — the one that would otherwise lock relatives out on
day one.

## Order of operations

1. `tools/backup.sh` — full backup first, always.
2. Create the MySQL database, run `sql/schema.mysql.sql`.
3. `tools/import_from_supabase.php --photos <backup>/storage` — re-runnable, so
   rehearse it as often as you like while the live site keeps running.
4. Compare the counts it prints against Supabase. A migration that quietly drops
   the gating is the worst outcome, so this is checked rather than assumed.
5. Point the front-end at `/api/tree.php` (one request replaces three).
6. Run in parallel: both backends live, new one on a subdomain, until it's dull.
7. Cut over DNS. Re-run the import once more on the day.

## What I still need from you

- **SSH or FTP details** — I cannot deploy or test on the real host without them.
- **PHP and MySQL versions** on the plan. Written for PHP 8.1+; tested on 8.5.
- **Is SSH available**, or FTP only? It changes how the import is run.
## What I still need from you

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

## Still to build

- The admin panel's members and review screens.
- The rest of the front-end swap. `js/backend.js` is the adapter and
  `APP_CONFIG.BACKEND` the switch; the tree read and the contribution submit
  go through it today. **There are 77 Supabase call sites in `js/`, not the 14
  an earlier note estimated** — 68 `.from()`, 20 storage, 3 rpc, 6 auth — so
  this is the largest remaining piece by some distance. Anything not yet ported
  keeps using Supabase whichever way the switch is set, which is what lets both
  backends run side by side.
- Members and transcriptions have no PHP endpoint yet, so they stay on Supabase.
