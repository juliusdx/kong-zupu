-- ============================================================================
--  migration_v12 — make LIVING members findable by name when signed out
-- ----------------------------------------------------------------------------
--  Until now, living members (visibility = 'member') were invisible to anonymous
--  visitors: the persons RLS hides member-tier rows unless you're signed in, so a
--  signed-out search/tree never included them. The family chose to let living
--  members be findable BY NAME (and tree position) without signing in.
--
--  We deliberately do NOT loosen the persons RLS — flipping the row policy would
--  also leak each living person's home LOCATION (residence_place / lat / lng),
--  birth year, bio, etc. Instead this adds a narrow, column-limited public VIEW
--  that exposes ONLY name + lineage-structure columns, and only for living ADULTS:
--
--    • included : id, gen, name + romanizations (pinyin/ritual/formal/hao/milk/aka),
--                 gender, father_id, spouse_of, living, confidence, visibility
--    • excluded : birth_year, death_year, lifespan, religion, bio, photo_url,
--                 birth_place, residence_place, burial_place, lat, lng  (location!)
--    • excluded : minors (is_minor = true stay fully hidden)
--    • excluded : everyone not living / not member-tier (public ancestors already
--                 come through the normal persons table; nothing changes for them)
--
--  The view runs with definer rights (security_invoker = false) so it can read past
--  the persons RLS, but it only ever returns the safe subset above. Photos, contacts,
--  and gated detail (person_details) remain signed-in-only and are untouched.
--
--  NOTE: Supabase's security advisor will flag this as a "security definer view"
--  exposed to anon — that is intentional here (a curated, column-limited public read).
--  It is only safe because the grants below make the view strictly READ-ONLY; see the
--  comment there before touching them. Definer rights + a writable auto-updatable view
--  would hand anonymous callers RLS-bypassing writes to persons.
--
--  Idempotent; run once in the Supabase SQL editor.
-- ============================================================================

create or replace view public.persons_public_search
  with (security_invoker = false) as
  select
    id, gen, name, pinyin, ritual_name, formal_name, hao, milk_name, aka,
    gender, father_id, spouse_of, living, confidence, visibility
  from public.persons
  where visibility = 'member'
    and living = true
    and is_minor = false;

-- READ-ONLY, and the revoke is NOT optional.
--
-- Supabase's default privileges on the public schema auto-grant ALL (insert/update/
-- delete) to anon + authenticated on newly created objects, so the view is created
-- writable and a bare "grant select" below would add nothing. That matters here far
-- more than usual: this is a simple single-table view, which Postgres makes
-- AUTO-UPDATABLE, and it runs with definer rights as the postgres owner of persons
-- (which has RLS enabled but NOT forced). Writes through the view would therefore
-- bypass RLS entirely — including the admin-only persons_write policy — letting any
-- anonymous caller edit or delete living members, or insert arbitrary persons rows
-- (there is no WITH CHECK OPTION, so inserts need not even match the view's filter).
--
-- Revoke first, then grant back only SELECT.
revoke all on public.persons_public_search from anon, authenticated;
grant select on public.persons_public_search to anon, authenticated;
