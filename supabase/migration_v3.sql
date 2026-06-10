-- ============================================================================
--  Kong Family Zupu — schema v3 migration  (run ONCE, after migration_v2.sql)
--  Enables LOCATION features:
--    • PLACE PHOTOS — the `media` table can now attach a photo to a place
--      (祠堂 / grave / church / residence), not just a person.
--    • MEMBER PIN-CORRECTIONS — members suggest an exact GPS for a place via the
--      existing `contributions` queue (payload.action = 'update_place'); an admin
--      approves and the `places` row's lat/lng is updated + approximate=false.
--      (No schema change is needed for that — it rides the contributions table.)
--
--  Run in the Supabase SQL editor (Project → SQL → New query).
-- ============================================================================

-- ---- media: allow attaching a photo to a PLACE instead of a person ---------
-- person_id was NOT NULL; relax it and add a parallel place_id. Exactly one of
-- the two should be set (enforced by the check constraint below).
alter table media alter column person_id drop not null;
alter table media add column if not exists place_id text;

-- a media row points at exactly one subject: a person OR a place
alter table media drop constraint if exists media_subject_chk;
alter table media add constraint media_subject_chk check (
  (person_id is not null and place_id is null)
  or (person_id is null and place_id is not null)
);

create index if not exists media_place_idx on media (place_id);

-- ---- RLS: existing media policies already gate by approved/visibility/owner/
--      admin and are subject-agnostic, so they cover place photos unchanged.
--      (media_read / media_insert / media_update / media_delete from v2.)
-- ----------------------------------------------------------------------------

-- ---- (reference only) how a member pin-correction flows through the system:
--   1. Member drops a pin → app inserts a `contributions` row:
--        payload = { action:'update_place', placeId:'p_dakeng', lat:.., lng:.. }
--   2. Admin opens Review → Approve → app upserts the `places` row with the new
--      lat/lng and approximate=false. If the place existed only in the static
--      seed (data/lineage.js), the app inserts it first (id + type + name…).
--   No new tables/columns are required for this; it reuses contributions+places.
-- ----------------------------------------------------------------------------
