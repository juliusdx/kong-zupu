# 江氏族譜 · The Kong Family Zupu

[![Deploy to GitHub Pages](https://github.com/juliusdx/kong-zupu/actions/workflows/deploy.yml/badge.svg)](https://github.com/juliusdx/kong-zupu/actions/workflows/deploy.yml)

An interactive, crowdsourced **族譜 (zupu)** for the Kong (江) family — a Hakka Christian
lineage of the **巴色會 (Basel Mission)** that migrated from Guangdong (長樂 / 今五華縣,
and 東莞 樟坑徑) to Sabah, Malaysia (古達 Kudat, 山打根 Sandakan, 吧巴 Papar).

It keeps the spirit of a traditional zupu — generational descent (世系), generational
naming characters (字輩), biographies (傳記), and the locations of ancestral halls (祠堂)
and graves — while making it **living**: family members can log in, add photos and
write-ups, pin GPS locations, and extend their own branch.

## What's in here

| View | What it does |
|------|--------------|
| **族譜 Tree** | Collapsible, generation-banded lineage. Click any person for full detail; sons, daughters and married-in spouses are colour-coded. Entries needing checking are flagged. |
| **地圖 Map** | Two layers — ancestral sites in Guangdong (origin, graves, church grounds) and the diaspora in Sabah — with a migration line between them. |
| **貢獻 Contribute** | A form to add a child/spouse, correct a record, or pin a 祠堂/grave. Reviewed before going live. |
| **關於 About** | The family story, the 字輩 characters, and the privacy model. |
| **審核 Review** *(reviewer)* | The contribution queue with a from→to diff per correction, who approved what, an Archived list to undo removals, and a privacy check that flags anyone gated in the database who appears in the public file. |

**Search** matches a name three ways: as typed, by the Mandarin reading of its characters
(so "ye" finds 業 and 业 finds 業), and across Hakka spelling variants (Fooi finds Fui,
"siu ha" finds Siew Ha) — the family's romanisations are Hakka, not pinyin.
**⤓ CSV** exports the whole tree as a spreadsheet, limited to what the viewer may see.

## Privacy model (3 tiers)

- **Public** — lineage of deceased ancestors + ancestral sites. Anyone can view.
- **Member** — photos and details of *living* members + diaspora map. Signed-in family only.
- **Private** — contact info. Self + admin only.

Minors are hidden by default; anyone can ask to be removed. These rules are enforced
**at the database level** by Row-Level Security (see `supabase/schema.sql`), not just in the UI.

Member photos live in the private `photos-private` bucket and are served as short-lived
signed URLs; nothing member-tier is reachable by URL. `data/lineage.js` is world-readable
and carries **no** privacy flags, so nobody `living` or `is_minor` may appear in it —
`tools/check_privacy.js` fails the build if one does, and the Review tab shows the same
check live.

## Run locally

A static site — no build step. Because it loads data via `<script>` (not `fetch`), you can
even open `index.html` directly, but a tiny server is cleaner:

```bash
cd kong-zupu
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy free on GitHub Pages

```bash
git init && git add . && git commit -m "Kong family zupu"
git branch -M main
git remote add origin https://github.com/<you>/kong-zupu.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch →
`main` / root**. Your site appears at `https://<you>.github.io/kong-zupu/`.
(The included `.nojekyll` file stops GitHub from mangling the folder.)

## Go from demo to live (optional, ~20 min)

The site works in **demo mode** out of the box: contributions download as JSON for the
keeper to merge. To accept live submissions, photos and logins:

1. Create a free project at [supabase.com](https://supabase.com).
2. SQL editor → paste & run **`supabase/schema.sql`** (creates tables + RLS + auth trigger).
3. Storage → create a public bucket named `photos`.
4. Make yourself admin: `update profiles set is_admin = true where id = '<your-user-id>';`
5. In `index.html`, fill in `window.APP_CONFIG`:
   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: "https://xxxx.supabase.co",
     SUPABASE_ANON_KEY: "sb_publishable_...",  // publishable key (NOT a JWT — see DEPLOY.md §3b)
     MODERATED: true
   };
   ```
6. (To read live data instead of the seed file, point the tree/map at the `persons`/`places`
   tables — the JSON shape in `data/lineage.js` matches the schema exactly.)

## Which backend

`APP_CONFIG.BACKEND` selects it: `"supabase"` (what the family uses) or `"php"` (the
SiteGround API in `siteground/`). `js/backend.js` is the adapter.

Both are live, in parallel, since 2026-08-26:

| | |
|---|---|
| https://juliusdx.github.io/kong-zupu/ | GitHub Pages + Supabase — **the family's site** |
| https://zupu.accme.my | PHP/MySQL on SiteGround — the same archive, for comparison |

Sign-in, the tree, contributions, review, members and photos all work on the PHP
side; the proofreader, Sources tab and visitor counter are still Supabase-only.
Nothing has been cut over. See `siteground/README.md` for what remains.

## Editing the family data by hand

`data/lineage.js` holds `persons`, `places`, and the `generationPoem`. Each person:

```js
{ id:"k_xxx", gen:27, name:"漢明", pinyin:"Han Ming", gender:"m",
  father:"k_qichang", ritualName:"…", birthYear:"…", birthPlace:"p_sandakan",
  bio:"…", confidence:"low" }   // confidence:"low" shows the ⚠ flag
```

Wives/married-in members use `spouseOf:"<husband id>"` instead of `father`.
Places use `approximate:true` until someone records exact GPS.

## ⚠ Data accuracy

The seed (gen 21–26) was transcribed from old handwriting and **many entries are marked
`confidence:"low"`**. Treat it as a first draft to be corrected by the family — which is
the whole point of the Contribute flow. Names are romanised in Mandarin pinyin for
searchability even though the family speaks Hakka.

## Stack

D3 v7 (tree) · MapLibre GL + OpenStreetMap (map, no API key) · vanilla JS · optional
Supabase (Postgres + Auth + Storage + RLS) · GitHub Pages hosting. All free-tier.
