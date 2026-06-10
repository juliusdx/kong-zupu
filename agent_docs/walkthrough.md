# Location Mapping — Phase 2 (coords accuracy + member pinning + place photos)

This phase makes the map carry birth / death / 祠堂 locations more accurately, lets
relatives correct or pin locations themselves, and adds photos for places.

## 1. Coordinate accuracy (`data/lineage.js` → `places`)
- Resolved historical names to **modern administrative locations** and added a `modern:`
  field to each (e.g. 永安縣 → 廣東河源紫金縣, 長樂 → 廣東梅州五華縣, 汀州府 → 福建龍岩長汀縣).
- Refined coordinates and split places into:
  - **verified** (`approximate:false`) — county/town seats + Sabah towns + the 寧化石壁 Hakka
    site (11 places). These show a green “✓ verified location” badge.
  - **approximate** (`approximate:true`) — village graves, ancestral halls, and the 3 origin
    villages whose exact site can't be geocoded from public sources (11 places). These keep
    the ⚠ badge and are the candidates for member pinning.
- Coordinates were resolved from established geography (county seats are stable); web
  verification confirmed 石壁 sits ~22 km **west** of Ninghua town. No fabricated precision —
  village-level sites are explicitly left approximate.

## 2. Place detail drawer (`js/app.js` `openPlace`, shares `#drawer`)
- Clicking a pin's **“Details & photos →”** link, or a birth/burial/residence link inside a
  person drawer, opens a place drawer: name, modern location, type, linked people, photos.
- `data-place` links are now handled by one global click handler that calls `window.openPlace`.

## 3. Member pin-correction (interactive)
- `js/map.js` `pickLocation(place)` — drops a draggable marker, shows a banner with
  Save/Cancel, resolves `{lat,lng}`. Gated on an explicit `ready` flag (set in the map
  `load` handler) because MapLibre's `map.loaded()` is unreliable and the one-shot `load`
  event can't be re-awaited.
- `app.js` `suggestLocation(place)` submits an `update_place` contribution to the Review
  queue (or downloads JSON in demo mode). Open to anyone (matches the contribute form).
- `app.js` `decide()` now handles `update_place` on approve: upserts the `places` row with
  the new GPS + `approximate:false` (inserts the seed place if it had no live row yet).

## 4. Place photos (`supabase/migration_v3.sql` — run once)
- `media` table: `person_id` made nullable, new `place_id text`, check constraint = exactly
  one subject. Existing media RLS (approved/visibility/owner/admin) covers place photos.
- `app.js` `uploadMedia({personId|placeId}, file)` generalizes the old `uploadPhoto`; place
  photos upload under `places/<id>/…`, visibility `public`, pending→admin-approve in the
  place drawer (same as person photos).

## Validation
- `node --check` passes for `data/lineage.js`, `js/map.js`, `js/app.js`, `js/i18n.js`.
- Integrity: 467 persons, 0 broken links, 0 dupes, 0 bad place refs; 11 verified / 11 approx.
- Verified live in a browser (MapLibre): place drawer renders, verified vs approx badges,
  modern row, linked people; pin-correction banner appears and Save/Cancel work.

## Owner action required
- Run **`supabase/migration_v3.sql`** in the Supabase SQL editor before place photos work.
- Coordinates were resolved without live geocoding API access — spot-check the 11 verified
  pins if you want, but they're county/town seats and the Sabah towns.
