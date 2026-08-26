# Kong (江) Zupu — Transcription Handoff

Purpose: let a **fresh session** (or a developer / relative) continue transcribing the
handwritten *Kong Family Book* into the family-tree app, without carrying the long
app-building history. Everything below is current as of this handoff.

---

## TL;DR

- The app is **built and deployed** (GitHub Pages + Supabase). The only file you edit to
  add people is **`data/lineage.js`** (the `persons` array on `window.LINEAGE`).
- A second copy runs in parallel on SiteGround at **https://zupu.accme.my** (PHP/MySQL)
  since 2026-08-26. It reads the same `data/lineage.js`, so transcription work needs
  nothing different — but note it holds its own copy of the live `persons` rows, so after
  a batch lands, `siteground/tools/import_from_supabase.php` should be re-run to keep the
  two in step. Nothing has been cut over; see `siteground/README.md`.
- The tree currently has **519 people** in `data/lineage.js` (direct spine + collateral cousins +
  Sabah branch + Lilang branch + 7/8/9房), plus the living members held in Supabase.
  0 broken links, 0 duplicates, 0 generation gaps. 479 are flagged `confidence:"low"` (⚠).
- Remaining work is **adding more named people from the book**, flagged low, with correct
  `father` links — then validate, then `git push` (auto-deploys).
- Relatives can also verify/add through the live app (⚠ "To verify" filter + Contribute
  form), so you do **not** have to transcribe every last cousin yourself.

---

## Files & paths

- Project root: `…/China Lineage Trip/kong-zupu/`
- **Edit this one file for names:** `data/lineage.js`
- Source scans (in the parent folder, git-ignored): `Kong_Family_book_pt1.pdf` (46pp),
  `Kong_Family_book_pt2.pdf` (84pp). Read them with the PDF reader (they're scanned
  handwriting — no extractable text; read as images).
- Backups: `…/China Lineage Trip/kong-zupu-backup-*.tar.gz`

---

## The person data model

Each entry in `window.LINEAGE.persons` is one person:

```js
{ id:"f5_tonghan",        // unique string id (see prefix scheme below)
  gen:20,                  // generation number (see numbering seam below)
  name:"通漢公",           // primary Chinese name
  pinyin:"Tonghan",        // romanization
  gender:"m",              // "m" | "f"
  father:"a18",            // id of father (omit for roots / married-in)
  spouseOf:"f5_tonghan",   // present ONLY on wives/married-in (points to the husband)
  relation:"二十世 · 長房", // free-text role label
  // ----- ALL KNOWN NAMES (capture every variant the book gives — "more is better") -----
  style:"字 …",            // 字 / 號 style name
  hao:"號 …",              // 號
  ritualName:"昌富", ritualPinyin:"Changfu",  // 禮名 / 洗禮名 (Basel-Mission baptism name)
  formalName:"有喬",       // 名 (formal/school name, incl. 國學名)
  milkName:"…",            // 乳名 (childhood/milk name)
  aka:"職員名 潤珠",        // anything else: nickname, alias, employment name, 過繼 note
  // ----- life / places -----
  birthYear:"光緒三年丁丑…", deathYear:"…", lifespan:"享壽…",
  religion:"…", bio:"…", marriedOut:"嫁…",   // marriedOut = a daughter who married out
  birthPlace:"p_changle", residencePlace:"…", burialPlace:"…",  // ids from LINEAGE.places
  confidence:"low",        // "low" (handwriting guess → shows ⚠) | "med" | "high"
  candidates:[ … ],        // optional: array of {name,pinyin,note} for unresolved placeholders
  note:"妣劉氏。…"          // anything else; put wife surnames here for collateral folks
}
```

Search matches on **all** name fields (name, pinyin, ritualName, ritualPinyin, style,
formalName, hao, milkName, aka) — so filling those in makes a person findable every way.

---

## Conventions (follow these exactly)

1. **Capture every name.** If the book gives 字, 號, 禮名/洗禮名, 名/國學名, 乳名, or any
   nickname/alias, put each in the right field (above). This is an explicit owner request.
2. **Flag handwriting reads `confidence:"low"`.** They show a ⚠ and appear in the "To
   verify" list for relatives to confirm. Use `"med"` only when clearly legible.
3. **Wives:** for collateral people, the surname can just go in `note` ("妻劉氏。"). For
   the main line, wives are full entries with `spouseOf` pointing at the husband.
4. **Daughters who married out:** add `marriedOut:"嫁…"`, keep `gender:"f"`.
5. **Father links** use the husband/father's `id` string. New people can point at existing
   seed ids (e.g. `father:"a18"`).
6. **Never invent a parent link.** If a page's house-divider (房) is unclear, add the
   person with a `note:"（房序待考）"` and the best-guess father, or hold them — do **not**
   guess a specific wrong parent. (This is why the 七房 cluster on pt2 pp.49–50 was deferred.)
7. **Validate after every batch** (commands below). Keep broken/dupes at 0.

### ID prefix scheme (keep ids unique)
- `a01`–`a20` — deep direct spine (江八郎 → 紹泗)
- `k_*` — direct Sabah branch (承續 → 大信 → 永宏 → 俊明 → 其昌 → 漢強) and their siblings
- `n9_*` — 九房 起瀨公 house (done)
- `n8_*` — 八房 起清公 house (done)
- `f5_*` — 起瀾公 五大房 = 紹泗's four brothers 通漢/通澤/紹淮/紹淡 (done)
- `mh_*` — Sabah branch imported from a relative's **MyHeritage** tree (永宏 → Yu Chong
  b.1912 → ~76 people, gens 24–28, all `confidence:"low"`). ⚠ Its 永宏 root is kept
  **unlinked** (own flagged root) — confirm with the family whether it grafts onto the
  `k_daxin`/`k_yonghong` spine before wiring a `father` (birth-years don't cleanly match 俊明).
  **PRIVACY:** only the **14 deceased anchors** (永宏, En Zhao, Yu Chong, Choon Kiaw,
  Zhun Fah + wife, the Chong in-laws, Clare, Roland, John, Daniel, 2× Unknown) live in this
  PUBLIC `lineage.js`. The **62 living `mh_*` members are NOT here** — `lineage.js` ships to
  GitHub Pages (world-readable), so living people are gated in **Supabase** instead:
  - `supabase/migration_approved_members.sql` — run ONCE: adds `profiles.approved`,
    `is_approved()`, and a `person_details` table (birth year / bio) gated to admins /
    approved members / self. Non-approved members see living people as a basic skeleton.
  - `supabase/seed_living_members.sql` — run AFTER the migration: inserts the 62 living
    members (`visibility='member'`, `is_minor=true` for 7 undated/young ones) as a
    basic `persons` row + a gated `person_details` row. **GITIGNORED** — it contains living
    relatives' PII (names + birth years), so it is kept local only and never pushed to the
    public repo. Regenerate it from source if lost.
  - `js/app.js loadLiveData()` now also fetches `person_details` (guarded) and merges it,
    so approved members see full detail; everyone else gets basic info only.
  To regenerate the SQL, the canonical living data + generator were scratch scripts; the
  authoritative copy is now the two SQL files (edit them directly, or re-import from source).
- **New branches:** pick a fresh short prefix (e.g. `n7_` for 七房, `ll_` for 李朗/Shenzhen).

### Generation-numbering seam (important)
A 1825 (道光5年) 合譜 merged an older 4-generation 新安老族譜 onto the deeper ancestry, so
the **master charts and the per-person 世 labels differ by ~1**. The app's direct line uses
**entry numbering**: 紹泗 = gen 20, 承續 = gen 21. 起瀾公 = gen 18. Note that 起瀾's sons are
labeled 十九世 in the book but are stored at **gen 20** to sit beside 紹泗 (a20). When you add
a branch, match the `gen` to its neighbours already in the file rather than the raw page
label, and add a `note` if they conflict. The tree positions by depth, so gen gaps render fine.

---

## What's already transcribed (page log)

- **pt1 pp.1–3** — master 世系 charts (authoritative topology; cross-check against these).
- **pt1 pp.4–12** — preface essays / 源流 / 祠堂對聯 (prose; few discrete entries).
- **pt1 pp.18–27** — deep ancestry gens 1–12 (the direct chain + a few siblings).
- **pt2 pp.48–58** — 七房, 八房, 九房 (n7_*, n8_*, n9_*) houses are done.
- **pt2 pp.60–69** — 起瀾公 五大房 (通漢/通澤/紹淮/紹淡 + 紹泗 direct) → `f5_*`; confirmed the
  Sabah generations (永/俊/耀/其/漢, the `k_*` ids) are already richly captured.
- **pt2 pp.70–84** — Sabah generations swept for missing descendants and missing siblings.
- **Shenzhen / Lilang Branch** — (ll_*) fully mapped from 朝陽.
- **pt1 pp.17–19** — gens 1–4 done 2026-08-20. 始祖 江八郎, the two granduncles, and the five gen-3
  brothers with their wives. Three corrections to data that was already live (see below).
- **pt1 pp.26–29** — gens 12–15 done 2026-08-20. `a13` resolved, the four 川 brothers, 華川's line, and
  the 日標 reconnection (below).
- **Sabah Branch Deep Connection** — Master tree Gen 14-18: `a15` 日輝, `a16` **朝纓 字成祥** (pt2 p.19),
  `a17` **龍躍** (pt2 p.27, the 庠生 who taught at 李朗), with `a17b` **龍見** beside him as the collateral
  叔祖 (pt2 p.20). 龍躍's ten recorded sons include 起瀾公 (the direct line) and the numbered 七/八/九房 —
  see the ⚠ on `a17`, which is one more than the「生下九大房」the book states.
  ⚠ **CORRECTED 2026-08-20:** 朝纓's father is **日標** (`c_5c193f48`), NOT 日輝. pt1 p.29 gives 日輝's four
  sons as 潮源/潮海/潮浩/潮湖 — the **潮** generation, water radical — and p.30 follows that line through
  文和 to 世和/世錦/世宏, a Guangzhou branch that is not ours. The earlier claim that the chart's 朝滔 was
  the same man as 朝纓 in another hand is **withdrawn**: they are separate brothers, both 日標's sons.
  Confirmed by Julius, whose own 2026-08-16 work in the app had already recorded 日標 in Supabase.
- **Generation numbering** — renumbered 2026-08-11 to the book's own 世 labels, which run gapless
  16 朝纓 → 17 龍躍 → 18 起瀾 → 19 紹泗 → 20 承續 → 21 大信 → 22 永 → 23 俊 → 24 其/有 → 25 漢.
  The old "1825 合譜 ±1 seam" was a misreading of p.66 and no longer exists.

## Corrections applied 2026-08-20 (data that was already live and wrong)

Read the scans, not `data/transcription.js` — its OCR garbles 世 numbers and radicals. Render from the
source PDFs with PyMuPDF and crop/magnify; every finding below came from doing that.

1. **`a03` was 念三郎; it is 十八郎** (personal name 鎬 per the p.1 chart). Three sources agree and none
   dissent: the chart drops the descent line from 十八郎 to 百八郎/百三郎/四六郎; p.19 reads
   「世祖十八郎。妣邱氏十六娘。所生三子」and names those same three; p.18 heads the five gen-3 brothers
   with 八郎妣邱氏. 念三郎 is the **三叔祖** and is restored as `a03e`. Confirmed by the family first.
   The father-links did not move — 十八郎 really is those three sons' father.
2. **`a02b` 萬里 and `a02c` 萬載 had each other's lives.** 萬里 = 諡文忠 · 名臨 · 號古心 (the Song
   chancellor, 追封益國公); 萬載 = 諡武肅侯 · 名億 · 號古山. Also 萬**載**, never 萬戴, and his second son
   is 鈕 not 鉦. p.17 and the p.1 chart agree, and so does the historical record.
3. **`a13` is no longer a placeholder.** p.27 states 「十三世祖榮川公字以賢」outright. He is 元珠公's third
   son; p.26 lists all four (繼川/懷川/榮川/華川) and p.27 gives each his 字. All four are now in the file,
   using the **live contribution ids** where a row already existed, so nobody renders twice.

⚠ **`lineage.js` and Supabase had drifted.** 44 live `persons` rows override seed people by id, including
Julius's 2026-08-16 work adding 日標 and nine 朝-generation sons. The seed file knew nothing about it. It
now matches. **Check the live table before transcribing anything in gens 13–16.**

## What remains (priority order)

1. **Deep-ancestry siblings, the pt1 pages not yet read: pp.13–16, 20–25, 30–46.** pp.17–19 and 26–29
   are done. Still to add from pages already read: 濯新's five sons (p.18 gives 長孟德/次迪德/三季德/
   四明德/五德, p.16 gives a conflicting 孟德/秀德/迪德/明德 — the book itself flags the two accounts as
   contradictory), 千二郎's son 成山公 (p.21), 東山公's wife 巫氏大娘 (p.22), 元珠公's wife 曾氏二娘
   (p.25), 懷韻公 and his four 道-generation sons (pp.24–25), 道周公 (p.28), and 日輝's four 潮-generation
   sons (p.29).
2. **Unread pt2 pages 1–47** — sweep for any remaining named houses, isolated branches, or stray cousins.

## Open questions for the family (not for code)

- **`a12c` vs `a12`.** The live rows hang all four 川 brothers off `a12c` (元玉公). The book puts them
  under 元珠公 (`a12`) — p.23 lists 積富公's four sons, p.25 marks 元珠 as 世祖 with 妣曾氏二娘, p.26 gives
  him the four 川 sons. `lineage.js` says `a12`; the live row wins, so the site currently runs the direct
  spine through 元玉公. One row per brother to fix, if Julius agrees.
- **`c_fe5f3b91` 朝宗 is flagged `living: true`** at gen 16 — an 18th-century ancestor recorded as a living
  member. Not a leak (it over-hides), but he shows up in the living-adults view.
- **日明 (`a15_riming`) may not exist.** p.29's nine are 日輝、日煌、日焕、日燿、日煒、日炫、日標、日亮、日開
  — no 日明. His only recorded role, fathering 朝陽, is now 日標's. Flagged in the file, not deleted.

---

## Validate (run after each batch)

```bash
cd "…/China Lineage Trip/kong-zupu"
node --check data/lineage.js          # syntax

node -e '
global.window={}; require("./data/lineage.js"); const L=window.LINEAGE;
const byId=Object.fromEntries(L.persons.map(p=>[p.id,p]));
let broken=0,dupes=0; const seen=new Set();
for(const p of L.persons){
  if(seen.has(p.id)){console.log("DUP",p.id);dupes++;} seen.add(p.id);
  if(p.father&&!byId[p.father]){console.log("BROKEN father",p.id,"->",p.father);broken++;}
  if(p.spouseOf&&!byId[p.spouseOf]){console.log("BROKEN spouseOf",p.id);broken++;}
}
console.log("total:",L.persons.length,"| broken:",broken,"| dupes:",dupes,
            "| ⚠low:",L.persons.filter(p=>p.confidence==="low").length);
'
```
Keep **broken = 0** and **dupes = 0**.

### Privacy check — run this too, before any push that touches `data/lineage.js`

`data/lineage.js` ships to a **public** repo and has no privacy flags: everything in it is
world-readable. Living relatives and minors belong in the `persons` table instead, where
they are gated. Nothing structurally keeps the two apart, and one record (漢能 `k_hanneng`)
had already crossed over — a transcription pass can easily move more.

```bash
SUPABASE_KEY=<service-role key> node tools/check_privacy.js
```

Exit 0 = clean. Exit 1 = someone gated is published, **or** the key given cannot see gated
rows (an anon key can't, and the script refuses to pass rather than pretend it checked).

The same check runs automatically in the app for a signed-in admin, at the bottom of the
**審核 Review** tab under "Privacy check".

## Deploy (owner runs in their own Terminal)

```bash
cd "…/China Lineage Trip/kong-zupu"
git add -A && git commit -m "More names from the book" && git push
```
GitHub Actions auto-publishes to `https://juliusdx.github.io/kong-zupu/`.

---

## Page transcriptions & English reading aid (regenerating after corrections)

Separate from the `lineage.js` person data, the **full page-by-page transcription** of the
two books lives here and feeds the museum "Sources" tab + the in-app proofreader:

- **`data/transcription.js`** — `window.TRANSCRIPTION_SEED`, keyed by source id then page
  number: `book_story` (16 pp), `book_pt1` (46 pp), `book_pt2` (84 pp). This is the Chinese
  transcription the **proofreader** seeds from. `〔?〕` marks illegible spots.
- **`data/transcription_en.json`** — the **English reading aid**, keyed `"pt1_07"` → `{type, en}`
  where `type` is `prose` (full translation) | `register` (1–2 line summary) | `faded`.
- **`data/scans/<tag>/pNN.webp`** — rendered page images (`tag` = `story` | `pt1` | `pt2`),
  shown on the **left** of each page in the public pages. These are the family scans made
  **public** by owner decision (re-rendered from the PDFs at ~1300px). To regenerate them,
  re-run the render step (PyMuPDF → Pillow WebP) over the source PDFs.
- **`data/Kong_Family_Book_Transcription.html`** (Story) + **`data/Kong_Family_book_pt{1,2}_Transcription.html`**
  — the **public bilingual pages**, each page laid out as **original scan (left) | transcription + English (right)**
  (linked from `sources.js` as `localUrl`; readable without sign-in). **Generated — do not
  hand-edit.** Built from the sources above by:

  ```bash
  node tools/build_transcription_html.js      # rebuilds all three HTML from committed sources
  ```

  These HTML files match the gitignore rule `Kong_Family_book*` (private scans) but are
  re-included by a `!…_Transcription.html` negation, so they DO commit. The `.md` records
  (`data/Kong_Family_book_pt{1,2}_Transcription.md`) are gitignored scratch copies — the
  app does not use them.

**Regen-on-correction (owner request):** the transcription is a machine best-effort. When a
relative corrects a page in the proofreader, the approved text is stored in the Supabase
`transcriptions` table (`doc_id`, `page`, `text`) and shown on top of the seed. To fold a
correction back into the public pages **and refresh its English**:

1. Update that page's Chinese in `data/transcription.js` (the matching `book_pt1`/`book_pt2` key).
2. Regenerate **only that page's** English — prose → full translation, register → 1–2 line
   summary, keeping `〔?〕`/`[unclear]` honesty — and replace its entry in
   `data/transcription_en.json` (the LLM step; ask Claude to do the page, or re-run the
   per-page translation). Keep the `type` accurate.
3. `node tools/build_transcription_html.js` to rebuild the HTML, then commit + push.

Until a page is corrected, its English reflects the original machine transcription (the
editor's note on each HTML page says so).

---

## Copy-paste kickoff prompt for a fresh session

> I'm continuing transcription of a handwritten Chinese family book into an existing app.
> Read `kong-zupu/HANDOFF.md` first — it has the data model, conventions, id scheme, the
> generation-numbering seam, and what's left. The only file to edit is
> `kong-zupu/data/lineage.js` (the `persons` array). Source scans are
> `Kong_Family_book_pt1.pdf` and `Kong_Family_book_pt2.pdf` in the parent folder.
> Start with task #1 in HANDOFF.md (Deep-ancestry siblings, gens 1-12): cross-check pt1 pp.13-46 against the master charts on pt1 pp.1-3 and add the brothers/wives/children the direct chain skipped. Add the people with correct `father` links, every name
> variant captured, all `confidence:"low"`. Validate with the integrity script in
> HANDOFF.md (broken=0, dupes=0) before moving on. Work one branch at a time and tell me
> the count after each.
```
```
