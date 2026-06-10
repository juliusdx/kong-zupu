# Phase 2 — location mapping (coords accuracy + member pinning + place photos)

- `[x]` Resolve historical place names → modern locations; add `modern:` field in `data/lineage.js`
- `[x]` Split places into verified (`approximate:false`) vs approximate; refine coordinates
- `[x]` `supabase/migration_v3.sql`: add `place_id` to `media`, make `person_id` nullable
- `[x]` Place detail drawer (`openPlace`) sharing `#drawer`; route `data-place` links to it
- `[x]` Interactive `MapView.pickLocation` (drop/drag marker + Save/Cancel banner)
- `[x]` `suggestLocation` → submit `update_place` contribution to Review queue
- `[x]` `decide()` handles `update_place` on approve (upsert place + clear approx flag)
- `[x]` `uploadMedia({personId|placeId})` + place-photo grid/upload in place drawer
- `[x]` i18n keys (en/zh) for place drawer + pin flow; CSS for banner / pick-marker / verified badge
- `[x]` Validate (node --check, integrity, browser smoke test)

## Owner to-do
- `[ ]` Run `supabase/migration_v3.sql` in Supabase SQL editor (enables place photos)

# Phase 1 (prior) — map pins
- `[x]` Link approved `add_place` contribution to a person's birth/residence/burial
- `[x]` Fix null-GPS map crash in `js/map.js`; migrate maplibre CDN cdnjs → unpkg
