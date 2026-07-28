-- ============================================================================
--  migration_v13 — email the admin when someone new signs up
-- ----------------------------------------------------------------------------
--  Until now nothing anywhere told the admin about a new account: the only
--  trigger on auth.users was handle_new_user() (inserts a profiles row), and the
--  only edge function is notify-contributor (emails the CONTRIBUTOR after a
--  review). New members could sign up unnoticed and sit unapproved forever.
--
--  This adds a second AFTER INSERT trigger on auth.users that POSTs the same
--  { to, subject, html } shape the Make.com scenario already accepts for
--  notify-contributor — so no Make changes are needed, it just receives a new
--  kind of message.
--
--  Design notes:
--    • pg_net's http_post is ASYNC (it queues the request and returns), so a slow
--      or dead webhook can never delay a sign-up.
--    • The whole body is wrapped in an exception handler as a second belt: if the
--      webhook URL is missing, Vault is unreadable, or pg_net errors, the sign-up
--      still succeeds and we only RAISE WARNING. A failed notification must never
--      cost us a member. (This is why we do NOT reuse handle_new_user() — a fault
--      there surfaces as "Database error saving new user" and blocks all sign-ups.)
--    • Secrets live in Vault, not in the function body: pg_proc is readable by any
--      role that can reach the DB, and the webhook URL is a send-email-as-us
--      capability. Vault keeps it encrypted and out of pg_dump output.
--    • Reads MAKE_WEBHOOK_URL / ADMIN_NOTIFY_EMAIL at call time, so rotating either
--      one is a Vault update — no redeploy, no migration.
--
--  Idempotent; safe to re-run.
-- ============================================================================

-- 1) pg_net — the DB's async HTTP client (Supabase installs it into `extensions`)
create extension if not exists pg_net with schema extensions;

-- 2) Secrets. ADMIN_NOTIFY_EMAIL is seeded; MAKE_WEBHOOK_URL must be set once by
--    hand (see the bottom of this file) — it is the same URL already stored as the
--    notify-contributor edge function's MAKE_WEBHOOK_URL secret.
select vault.create_secret('juliusykong@gmail.com', 'ADMIN_NOTIFY_EMAIL',
                           'Where new-sign-up alerts are sent')
  where not exists (select 1 from vault.secrets where name = 'ADMIN_NOTIFY_EMAIL');

-- 3) the notifier
create or replace function public.notify_admin_new_signup()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
declare
  hook_url  text;
  admin_to  text;
  who       text;
  signed_up text;
  subject   text;
  html      text;
begin
  begin
    select decrypted_secret into hook_url
      from vault.decrypted_secrets where name = 'MAKE_WEBHOOK_URL';
    select decrypted_secret into admin_to
      from vault.decrypted_secrets where name = 'ADMIN_NOTIFY_EMAIL';

    -- Not configured yet → stay silent. Sign-up still succeeds.
    if hook_url is null or admin_to is null then
      return new;
    end if;

    who       := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), '(no name given)');
    signed_up := to_char(new.created_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon YYYY, HH24:MI');

    subject := '新家人註冊 · New sign-up: ' || coalesce(new.email, '(no email)') || ' — 江氏族譜';

    html :=
      '<div style="font-family:Georgia,''Songti SC'',''STSong'',serif;max-width:520px;color:#2b2117">' ||
        '<p>有新家人註冊了族譜帳號 · Someone new signed up for a Zupu account.</p>' ||
        '<table style="border-collapse:collapse;margin:.6rem 0;font-size:.95rem">' ||
          '<tr><td style="padding:.3rem .8rem .3rem 0;color:#9a8a6e">電郵 / Email</td><td><strong>' ||
            coalesce(new.email, '—') || '</strong></td></tr>' ||
          '<tr><td style="padding:.3rem .8rem .3rem 0;color:#9a8a6e">姓名 / Name</td><td>' || who || '</td></tr>' ||
          '<tr><td style="padding:.3rem .8rem .3rem 0;color:#9a8a6e">時間 / When</td><td>' ||
            signed_up || ' (MYT)</td></tr>' ||
        '</table>' ||
        '<p style="margin:.8rem 0;padding:.7rem 1rem;background:#fdf6e3;border-left:3px solid #c47a2c;font-size:.92rem">' ||
          '此帳號尚未核准，暫時看不到在世家人的詳細資料。<br>' ||
          'This account is <strong>not approved</strong> yet, so living members still appear as name-only.<br>' ||
          '請在族譜網站的「成員」分頁核准 · Approve them in the ' ||
          '<a href="https://juliusdx.github.io/kong-zupu/" style="color:#a3411f">成員 Members</a> tab.</p>' ||
        '<p style="font-size:.8rem;color:#9a8a6e;margin-top:2rem;border-top:1px solid #e3d9c2;padding-top:.8rem">' ||
          '江氏族譜 · Kong Family Zupu</p>' ||
      '</div>';

    perform net.http_post(
      url     := hook_url,
      body    := jsonb_build_object('to', admin_to, 'subject', subject, 'html', html),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  exception when others then
    -- Never block a sign-up over a notification.
    raise warning 'notify_admin_new_signup failed: %', sqlerrm;
  end;

  return new;
end; $$;

revoke all on function public.notify_admin_new_signup() from public, anon, authenticated;

-- 4) the trigger (separate from on_auth_user_created on purpose — see notes above)
drop trigger if exists on_auth_user_created_notify on auth.users;
create trigger on_auth_user_created_notify after insert on auth.users
  for each row execute function public.notify_admin_new_signup();

-- 5) admin-only smoke test: sends one test email through the same path, so the
--    wiring can be checked without creating (and then having to delete) a user.
create or replace function public.test_admin_signup_notification()
  returns text
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
declare hook_url text; admin_to text;
begin
  select decrypted_secret into hook_url from vault.decrypted_secrets where name = 'MAKE_WEBHOOK_URL';
  select decrypted_secret into admin_to from vault.decrypted_secrets where name = 'ADMIN_NOTIFY_EMAIL';
  if hook_url is null then return 'MAKE_WEBHOOK_URL not set in Vault'; end if;
  if admin_to is null then return 'ADMIN_NOTIFY_EMAIL not set in Vault'; end if;

  perform net.http_post(
    url     := hook_url,
    body    := jsonb_build_object(
                 'to', admin_to,
                 'subject', '測試 · Test: Zupu sign-up alerts are working',
                 'html', '<p>This is a test of the new-sign-up notification path. '
                      || 'If you are reading it, the trigger, pg_net and the Make scenario all work.</p>'),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return 'queued to ' || admin_to;
end; $$;

revoke all on function public.test_admin_signup_notification() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
--  ONE MANUAL STEP — store the Make.com webhook URL (same value as the
--  notify-contributor edge function's MAKE_WEBHOOK_URL secret):
--
--    select vault.create_secret('https://hook.eu2.make.com/xxxxxxxx',
--                               'MAKE_WEBHOOK_URL', 'Make.com email relay');
--
--  To rotate it later:
--    select vault.update_secret(
--      (select id from vault.secrets where name = 'MAKE_WEBHOOK_URL'),
--      'https://hook.eu2.make.com/NEW');
--
--  Test without creating a real user:
--    select public.test_admin_signup_notification();
-- ----------------------------------------------------------------------------
