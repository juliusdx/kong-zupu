-- ============================================================================
--  Kong Family Zupu — Supabase schema
--  Run in the Supabase SQL editor (Project → SQL → New query).
--  Implements the 3-tier privacy model with Row-Level Security (RLS):
--    public   → lineage of deceased ancestors, places            (anyone)
--    member   → photos / details of living members, diaspora map  (signed-in)
--    private  → contact info                                      (self + admin)
-- ============================================================================

-- ---- enums ----------------------------------------------------------------
create type visibility_tier as enum ('public','member','private');
create type place_type      as enum ('origin','grave','church_grave','diaspora','residence','hall');

-- ---- profiles (one row per signed-in family member) -----------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  is_admin    boolean not null default false,
  person_id   uuid,                         -- links account to their node
  created_at  timestamptz not null default now()
);

-- ---- places (祠堂 / graves / churches / residences) -----------------------
create table places (
  id          uuid primary key default gen_random_uuid(),
  type        place_type not null,
  name        text not null,
  name_en     text,
  lat         double precision,
  lng         double precision,
  approximate boolean not null default true,
  note        text,
  visibility  visibility_tier not null default 'public',
  created_at  timestamptz not null default now()
);

-- ---- persons --------------------------------------------------------------
create table persons (
  id           uuid primary key default gen_random_uuid(),
  gen          int,
  name         text not null,            -- 名 (Chinese)
  pinyin       text,
  ritual_name  text,                     -- 禮名 / 洗禮名
  formal_name  text,                     -- 名 (formal)
  hao          text,                     -- 號
  gender       text check (gender in ('m','f')),
  father_id    uuid references persons(id) on delete set null,
  spouse_of    uuid references persons(id) on delete set null,
  birth_year   text,
  death_year   text,
  lifespan     text,
  religion     text,
  relation     text,
  bio          text,
  photo_url    text,
  birth_place  uuid references places(id),
  residence_place uuid references places(id),
  burial_place uuid references places(id),
  living       boolean not null default false,
  is_minor     boolean not null default false,
  visibility   visibility_tier not null default 'public',
  confidence   text,                     -- 'low' | 'med' | 'high'
  created_at   timestamptz not null default now()
);

-- ---- private contact details (separate table = easy to lock down) ---------
create table contacts (
  person_id  uuid primary key references persons(id) on delete cascade,
  email      text,
  phone      text,
  address    text,
  updated_at timestamptz not null default now()
);

-- ---- moderation queue -----------------------------------------------------
create table contributions (
  id           uuid primary key default gen_random_uuid(),
  payload      jsonb not null,
  status       text not null default 'pending',   -- pending | approved | rejected
  submitted_by uuid references auth.users(id),
  reviewed_by  uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

-- ============================================================================
--  ROW-LEVEL SECURITY
-- ============================================================================
alter table profiles      enable row level security;
alter table places        enable row level security;
alter table persons       enable row level security;
alter table contacts      enable row level security;
alter table contributions enable row level security;

-- helper: is the current user an admin?
create or replace function is_admin() returns boolean language sql stable as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- profiles: a user sees/edits only their own; admins see all
create policy profiles_self on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_upd  on profiles for update using (id = auth.uid());

-- places: public ones visible to all; members see member tier; admins all
create policy places_read on places for select using (
  visibility = 'public'
  or (visibility = 'member' and auth.uid() is not null)
  or is_admin()
);
create policy places_write on places for all using (is_admin()) with check (is_admin());

-- persons: public tier to everyone; member tier to signed-in; minors hidden unless admin
create policy persons_read on persons for select using (
  (visibility = 'public' and is_minor = false)
  or (visibility = 'member' and auth.uid() is not null and is_minor = false)
  or is_admin()
);
create policy persons_write on persons for all using (is_admin()) with check (is_admin());

-- contacts: only the linked member or an admin
create policy contacts_read on contacts for select using (
  is_admin()
  or person_id = (select person_id from profiles where id = auth.uid())
);
create policy contacts_write on contacts for all using (
  is_admin()
  or person_id = (select person_id from profiles where id = auth.uid())
) with check (
  is_admin()
  or person_id = (select person_id from profiles where id = auth.uid())
);

-- contributions: anyone (even anon) may INSERT; only admins may read/triage
create policy contrib_insert on contributions for insert with check (true);
create policy contrib_admin  on contributions for select using (is_admin());
create policy contrib_update on contributions for update using (is_admin());

-- ============================================================================
--  STORAGE: public-read "photos" bucket; only signed-in members may upload.
-- ============================================================================
insert into storage.buckets (id, name, public)
  values ('photos','photos',true)
  on conflict (id) do nothing;

create policy "photos_read"  on storage.objects for select
  using (bucket_id = 'photos');
create policy "photos_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos');
create policy "photos_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and owner = auth.uid());

-- ----------------------------------------------------------------------------
--  AFTER FIRST SIGN-UP: make yourself the admin (replace the email):
--    update profiles set is_admin = true
--    where id = (select id from auth.users where email = 'YOUR_NEW_GMAIL');
-- ----------------------------------------------------------------------------

-- ---- auto-create a profile when a user signs up ---------------------------
-- NOTE: `set search_path = public` is REQUIRED. Without it the security-definer
-- function can't resolve `profiles` in the auth trigger context, which surfaces
-- to the client as "Database error saving new user" and blocks all sign-ups.
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
