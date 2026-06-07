-- ============================================================================
--  Kong Family Zupu — schema v2 migration  (run ONCE, after schema.sql)
--  Enables the LIVE TREE + PHOTO UPLOADS:
--    • persons / places use TEXT slug ids so live DB rows can reference the
--      static seed in data/lineage.js (e.g. a new child's father_id = "k_hanqiang")
--    • new `media` table holds photos attached to any person (seed or live)
--  The data tables are empty at this point, so we drop & recreate them.
-- ============================================================================

drop table if exists contacts cascade;
drop table if exists media    cascade;
drop table if exists persons  cascade;
drop table if exists places   cascade;

-- link a member account to a person by slug
alter table profiles alter column person_id type text using person_id::text;

-- ---- places (text slug id) ------------------------------------------------
create table places (
  id          text primary key,            -- e.g. 'p_kudat'
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

-- ---- persons (text slug id; soft refs, no hard FK to allow seed links) -----
create table persons (
  id              text primary key,         -- e.g. 'c_3f9a2b'
  gen             int,
  name            text not null,
  pinyin          text,
  ritual_name     text,
  formal_name     text,
  hao             text,
  gender          text check (gender in ('m','f')),
  father_id       text,                     -- parent slug (seed OR live)
  spouse_of       text,                     -- spouse slug (seed OR live)
  birth_year      text,
  death_year      text,
  lifespan        text,
  religion        text,
  relation        text,
  bio             text,
  birth_place     text,
  residence_place text,
  burial_place    text,
  living          boolean not null default false,
  is_minor        boolean not null default false,
  visibility      visibility_tier not null default 'public',
  confidence      text,
  source          text default 'contribution',
  created_at      timestamptz not null default now()
);

-- ---- contacts (private; text slug) ----------------------------------------
create table contacts (
  person_id  text primary key,
  email      text, phone text, address text,
  updated_at timestamptz not null default now()
);

-- ---- media (photos for any person) ----------------------------------------
create table media (
  id          uuid primary key default gen_random_uuid(),
  person_id   text not null,               -- person slug (seed or live)
  url         text not null,
  caption     text,
  visibility  visibility_tier not null default 'member',
  uploaded_by uuid references auth.users(id),
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table places   enable row level security;
alter table persons  enable row level security;
alter table contacts enable row level security;
alter table media    enable row level security;

-- places: public to all; member tier to signed-in; admin all
create policy places_read  on places for select using (
  visibility='public' or (visibility='member' and auth.uid() is not null) or is_admin());
create policy places_write on places for all using (is_admin()) with check (is_admin());

-- persons: public (non-minor) to all; member to signed-in; admin all
create policy persons_read  on persons for select using (
  (visibility='public' and is_minor=false)
  or (visibility='member' and auth.uid() is not null and is_minor=false)
  or is_admin());
create policy persons_write on persons for all using (is_admin()) with check (is_admin());

-- contacts: linked member or admin only
create policy contacts_read  on contacts for select using (
  is_admin() or person_id = (select person_id from profiles where id=auth.uid()));
create policy contacts_write on contacts for all using (
  is_admin() or person_id = (select person_id from profiles where id=auth.uid()))
  with check (is_admin() or person_id = (select person_id from profiles where id=auth.uid()));

-- media: approved photos by tier; uploader sees own (pending); admin all
create policy media_read   on media for select using (
  (approved and visibility='public')
  or (approved and visibility='member' and auth.uid() is not null)
  or uploaded_by = auth.uid()
  or is_admin());
create policy media_insert on media for insert to authenticated with check (uploaded_by = auth.uid());
create policy media_update on media for update using (is_admin());
create policy media_delete on media for delete using (uploaded_by = auth.uid() or is_admin());
