-- ============================================================================
--  migration_v11 — site-wide visitor counter
-- ----------------------------------------------------------------------------
--  A single running total of page visits, shown as a small badge on the site.
--  Counting is done server-side and atomically, so concurrent visits never
--  lose a tick (a plain client read-modify-write would race).
--
--  • site_stats(key, count) holds named counters; we use the 'visits' row.
--  • Anyone (including anonymous visitors) may READ the count.
--  • Writes happen ONLY through bump_visit(), a SECURITY DEFINER function, so
--    no direct table-write grant is needed and the value can't be set to an
--    arbitrary number by a client.
--
--  The browser calls bump_visit() once per session (a sessionStorage guard
--  prevents re-counting on reload), then reads the table to refresh the badge.
--
--  Idempotent; run once in the Supabase SQL editor.
-- ============================================================================

-- 1) the counter table -------------------------------------------------------
create table if not exists site_stats (
  key        text primary key,
  count      bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into site_stats (key, count) values ('visits', 0)
  on conflict (key) do nothing;

-- 2) RLS: the count is public to read; nobody writes directly (only via the RPC)
alter table site_stats enable row level security;

drop policy if exists site_stats_read on site_stats;
create policy site_stats_read on site_stats for select using (true);

-- 3) atomic increment, returns the new total. SECURITY DEFINER performs the
--    write while the grant below limits *who* may call it.
create or replace function public.bump_visit()
  returns bigint
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  new_count bigint;
begin
  insert into site_stats (key, count) values ('visits', 1)
    on conflict (key) do update
      set count = site_stats.count + 1, updated_at = now()
    returning count into new_count;
  return new_count;
end; $$;

grant execute on function public.bump_visit() to anon, authenticated;
