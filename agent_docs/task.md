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

# Phase 3 — photos polish + tree avatars
- `[x]` Full-size photo lightbox (click any drawer thumbnail; click overlay/× to close)
- `[x]` Limit photos to 5 per person AND per place (hide add button + message at limit;
        guard in uploadMedia)
- `[x]` Tree avatars on nodes that have an approved main photo (circular, clipped)
- `[x]` Sepia for deceased / full colour for living; gold ring on living
- `[x]` 📷 camera badge on photo nodes; birth–death years on each card (4-digit year
        pulled from Chinese-era date strings)
- `[x]` Toolbar "Photos" toggle to show/hide tree avatars (slow-connection friendly)
- `[x]` app.js sets person.photo (first approved) before Tree.render

## Owner to-do
- `[ ]` Run `supabase/migration_v3.sql` in Supabase SQL editor (enables place photos)

# Phase 1 (prior) — map pins
- `[x]` Link approved `add_place` contribution to a person's birth/residence/burial
- `[x]` Fix null-GPS map crash in `js/map.js`; migrate maplibre CDN cdnjs → unpkg
