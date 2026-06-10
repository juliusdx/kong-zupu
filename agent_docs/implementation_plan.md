# Plan: Linking Contributed Pins to Persons

## Goal
Implement the roadmap feature: "linking a contributed pin to a specific person's grave/residence" from the `DEPLOY.md` document.

Currently, the map feature handles `add_place` contributions by inserting a row into the Supabase `places` table, but it fails to link that new place back to the selected `relatedTo` person's `birth_place`, `residence_place`, or `burial_place`. 

This plan fixes the `Review` approval flow in `js/app.js` so that when a place contribution is approved, the person record is also updated. Because the map's pins already display "Linked: [Person Name]" based on the person data, the newly contributed places will automatically show their associations.

## Proposed Changes

### `js/app.js`

Modify the `decide` function which handles the "Approve/Reject" flow. 

When a place is approved (action `add_place`), we will extract `payload.relatedTo`. Depending on the `placeType`, we will assign it to the appropriate field:
- `grave` / `church_grave` -> `burial_place`
- `residence` / `diaspora` -> `residence_place`
- `origin` -> `birth_place`

Since the `relatedTo` person might only exist in the static data (`data/lineage.js`) and not yet have a row in the Supabase `persons` table, we will:
1. Attempt to `update()` the existing row in `persons`.
2. If no row exists (0 rows returned), we will `insert()` a new row that copies over the essential static properties from `data/lineage.js` along with the newly assigned place ID. This prevents the `mergeRow` logic from erasing static data with nulls.

## User Review Required

> [!IMPORTANT]  
> Are there any other map features you want to include in this plan, such as modifying the migration line or changing how pins are grouped? Or should we focus solely on linking pins to persons?

## Verification Plan

### Manual Verification
1. Open the app as an admin, go to **Contribute** and submit an `add_place` action tied to a specific person (e.g. `江紹泗公`).
2. Go to the **Review (審核)** tab and **Approve** the submission.
3. Open the **Map (地圖)** tab and click the newly added pin. Verify that the "Linked: ..." text displays the person's name.
4. Open the **Tree (族譜)** tab, open the person's drawer, and verify that the grave/residence field is now a clickable link to the new map pin.
