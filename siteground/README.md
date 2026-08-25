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
    php tests/uploads.php       # 62 assertions: file types, subject gating, traversal,
                                #   staging, claiming, embedded photos, cover, delete
    php tests/members.php       # 31 assertions: roster gating, approve, promote, the locked doors
    php tests/http_photo.php    #  9 assertions: photo.php over real HTTP, incl. path traversal
    php tests/http_auth.php     # 30 assertions: the magic-link round trip over real HTTP

226 assertions, all passing. `tests/run.php` includes the ones that would have
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
   **`site_url` in config.php must be exactly the host relatives type.**
   `verify.php` redirects there after setting the session, and a redirect that
   crosses to a different spelling of the same server (`127.0.0.1` vs
   `localhost`, bare vs `www.`) leaves the cookie behind: the link appears to
   work, the page comes back signed out, and nothing logs an error.
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
  - the **`notify-contributor` edge function**, which has no equivalent — PHP
    would send that mail itself through `lib/mailer.php`.
- **Transcriptions** have no PHP endpoint, so the proofreader stays on Supabase.
- **The honest caveat about running side by side.** An unported READ still works
  on either switch, because the publishable key reaches public data. An unported
  *write* or *gated read* does not: it needs a Supabase session, and on this
  backend the session is a PHP cookie. So each capability is wholly on one side
  or the other, and the ones still listed here are Supabase-only while the
  switch says `php`.
