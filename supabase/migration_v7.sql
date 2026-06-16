-- ============================================================================
--  migration_v7 — per-person map coordinates (diaspora dots)
-- ----------------------------------------------------------------------------
--  A person can now carry their own lat/lng so the map shows a named dot for
--  them — "where the family dispersed to". This is distinct from the formal
--  `places` table (祠堂 / graves / origins): it's the person's own location
--  (typically a living member's current city). The contribution form's map pin
--  writes these when the action is add_child / add_spouse / edit; an approved
--  add_place still creates a `places` row as before.
--
--  Visibility is governed by the existing persons RLS: a LIVING member is
--  member-tier, so their dot shows only to signed-in family, never to the
--  public — which is the right default for a living person's location.
--  Idempotent; run once in the Supabase SQL editor.
-- ============================================================================

alter table public.persons add column if not exists lat double precision;
alter table public.persons add column if not exists lng double precision;
