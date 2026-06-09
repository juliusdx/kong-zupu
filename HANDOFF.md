# Kong (江) Zupu — Transcription Handoff

Purpose: let a **fresh session** (or a developer / relative) continue transcribing the
handwritten *Kong Family Book* into the family-tree app, without carrying the long
app-building history. Everything below is current as of this handoff.

---

## TL;DR

- The app is **built and deployed** (GitHub Pages + Supabase). The only file you edit to
  add people is **`data/lineage.js`** (the `persons` array on `window.LINEAGE`).
- The tree currently has **177 people** (direct spine gens 1–26 + collateral cousins).
  0 broken links, 0 duplicates. ~149 are flagged `confidence:"low"` (⚠) for verification.
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
- **pt2 pp.48–58** — 八房 起清公 + 九房 起瀨公 houses → `n8_*`, `n9_*`.
- **pt2 pp.60–69** — 起瀾公 五大房 (通漢/通澤/紹淮/紹淡 + 紹泗 direct) → `f5_*`; confirmed the
  Sabah generations (永/俊/耀/其/漢, the `k_*` ids) are already richly captured.

## What remains (priority order)

1. **七房 cluster — pt2 pp.49–50.** Re-read pt2 **pp.44–50** to find the house-divider that
   owns 承夏 / 承周 / 紹潇 / 承富 / 大成 / 大全 / 承貴 / 大參 / 大旭 (and their wives/children),
   then attach them. Deferred to avoid a wrong parent.
2. **Deep-ancestry siblings, gens 1–12 — pt1 pp.13–46.** Add the brothers/wives/children
   the direct chain skipped (e.g. 百八郎/百六郎, 六三郎=貴六, 千二郎=斌通, the 念X郎 gen-3 set,
   the 元-generation brothers 元珊/元玉/元珍, etc.). Cross-check the pt1 charts.
3. **李朗 / Shenzhen branch.** The sibling line that split at the 朝 generation:
   朝湧/朝鴻 → 龍 → 起 → 紹 → 承 → 士 → 國. Find its pages (scan pt1 & pt2 for the 李朗 section)
   and add under a new `ll_*` prefix. NB: this is the OTHER branch, not the Sabah line.
4. **Unread pt2 pages 1–47 and 70–84** — sweep for any remaining named houses; pp.70–84
   continue the Sabah generations and may add more siblings to the `k_*` people.

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

## Deploy (owner runs in their own Terminal)

```bash
cd "…/China Lineage Trip/kong-zupu"
git add -A && git commit -m "More names from the book" && git push
```
GitHub Actions auto-publishes to `https://juliusdx.github.io/kong-zupu/`.

---

## Copy-paste kickoff prompt for a fresh session

> I'm continuing transcription of a handwritten Chinese family book into an existing app.
> Read `kong-zupu/HANDOFF.md` first — it has the data model, conventions, id scheme, the
> generation-numbering seam, and what's left. The only file to edit is
> `kong-zupu/data/lineage.js` (the `persons` array). Source scans are
> `Kong_Family_book_pt1.pdf` and `Kong_Family_book_pt2.pdf` in the parent folder.
> Start with task #1 in HANDOFF.md (the 七房 cluster, pt2 pp.44–50): read those pages,
> find the house-divider, and add the people with correct `father` links, every name
> variant captured, all `confidence:"low"`. Validate with the integrity script in
> HANDOFF.md (broken=0, dupes=0) before moving on. Work one branch at a time and tell me
> the count after each.
```
```
