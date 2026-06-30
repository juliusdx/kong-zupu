-- ============================================================================
--  migration_v11 — simple visitor counter
-- ----------------------------------------------------------------------------
--  A tiny key/value counter table plus an atomic increment RPC, so the site can
--  show a "👁 N" visit count in the header.
--
--  • public.counters        → one row per counter (seeded: 'site_visits').
--    RLS lets ANYONE read the value (it's just a number, not sensitive) but
--    grants NO direct write — the only way to change it is the RPC below.
--  • public.bump_counter(k) → security-definer increment. Returns the new value.
--    Runs as owner so it can update past RLS; granted to anon + authenticated so
--    signed-out visitors are counted too. Only bumps keys that already exist, so
--    callers can't create arbitrary counters.
--
--  The client bumps once per browser session (sessionStorage guard) and otherwise
--  just reads the current value, so a refresh isn't a new visit. This is a
--  client-driven counter — fine for a family site, not a fraud-proof metric.
--
--  Idempotent; run once in the Supabase SQL editor.
-- ============================================================================

-- 1) the counter table
create table if not exists public.counters (
  key   text primary key,
  value bigint not null default 0
);

insert into public.counters (key, value) values ('site_visits', 0)
  on conflict (key) do nothing;

-- 2) RLS: public read, no direct write
alter table public.counters enable row level security;

drop policy if exists counters_read on public.counters;
create policy counters_read on public.counters for select using (true);

grant select on public.counters to anon, authenticated;

-- 3) atomic increment (the only write path)
create or replace function public.bump_counter(k text)
  returns bigint
  language plpgsql
  security definer
  set search_path = public
as $$
declare v bigint;
begin
  update public.counters set value = value + 1 where key = k returning value into v;
  return v;   -- null when the key doesn't exist (we only track known counters)
end; $$;

revoke all on function public.bump_counter(text) from public;
grant execute on function public.bump_counter(text) to anon, authenticated;
