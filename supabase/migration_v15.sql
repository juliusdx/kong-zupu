-- ============================================================================
--  Kong Zupu — migration v15: archive a person (soft delete)
--
--  WHY not a hard delete: people arrive from three places — the static seed in
--  data/lineage.js, the living-member seed, and approved contributions — and a
--  wrong one usually has children hanging off it by the time anyone notices.
--  Archiving hides the person everywhere but keeps the row, so a mistake costs
--  one click to undo instead of a hand-written INSERT.
--
--  Archiving a SEED person works because live `persons` rows override
--  data/lineage.js by id: an archived row masks the seed entry, and js/app.js
--  drops it from the tree on load.
--
--  RUN ORDER: after migration_v14.sql. Safe to re-run.
-- ============================================================================

alter table persons
  add column if not exists archived         boolean not null default false,
  add column if not exists archived_at      timestamptz,
  add column if not exists archived_by      uuid references auth.users(id),
  add column if not exists archived_reason  text;

comment on column persons.archived is
  'Soft delete. Hidden from every reader except admins, who see it in the Archived list and can restore it.';

-- Read policy: same visibility tiers as before, but archived rows are invisible
-- to everyone except admins — they need to see them in order to restore them.
drop policy if exists persons_read on persons;
create policy persons_read on persons for select using (
  is_admin()
  or (
    archived = false
    and (
      (visibility = 'public'::visibility_tier and is_minor = false)
      or (visibility = 'member'::visibility_tier and auth.uid() is not null and is_minor = false)
    )
  )
);

-- The anon-facing search view must not leak archived people either.
create or replace view persons_public_search as
  select id, gen, name, pinyin, ritual_name, formal_name, hao, milk_name, aka,
         gender, father_id, spouse_of, living, confidence, visibility
  from persons
  where visibility = 'member'::visibility_tier
    and living = true
    and is_minor = false
    and archived = false;

-- A new public object is auto-granted CRUD to anon, so strip everything back to
-- read-only — otherwise anon inherits RLS-bypassing writes through the view.
revoke all on persons_public_search from anon, authenticated;
grant select on persons_public_search to anon, authenticated;

-- Index: the tree filters on this on every load.
create index if not exists persons_archived_idx on persons (archived) where archived = true;
