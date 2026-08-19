#!/usr/bin/env node
/*
 * Privacy drift check — does anyone GATED in the database appear in the PUBLIC file?
 *
 * WHY
 * The zupu holds two datasets with two different privacy models:
 *   • data/lineage.js — the historical spine from the family book. Ships to GitHub Pages
 *     from a PUBLIC repo, and has no visibility flags at all. Everything in it is public.
 *   • the `persons` table — living relatives contributed in-app, with living / is_minor /
 *     visibility, gated by RLS.
 * They are meant to be disjoint, and nothing enforced that. One record had already
 * crossed over (漢能 k_hanneng, removed 2026-08-19). A future transcription pass could
 * move more without anyone noticing, because the public file simply cannot express
 * "this person is gated".
 *
 * Exit code 0 = clean, 1 = violation or the check could not be trusted.
 *
 * USAGE
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_KEY=<service-role or an admin key> \
 *   node tools/check_privacy.js
 *
 * The key MUST be able to see gated rows. An anon key sees only public people, so the
 * check would pass while proving nothing — that case is detected and fails loudly.
 */

const fs = require("fs");
const path = require("path");

const URL_BASE = process.env.SUPABASE_URL || "https://pefnwwlbjfksyaenapgv.supabase.co";
const KEY = process.env.SUPABASE_KEY;

function die(msg) { console.error("✗ " + msg); process.exit(1); }

if (!KEY) {
  die("SUPABASE_KEY is not set.\n" +
      "  Use the service-role key (Supabase dashboard → Project Settings → API).\n" +
      "  An anon key cannot see gated people and would make this check meaningless.");
}

// ---- ids in the public file ------------------------------------------------
// Load it rather than pattern-match it: the file also contains place ids, and a regex
// would count those as people. It only assigns window.LINEAGE, so this is safe.
const file = path.join(__dirname, "..", "data", "lineage.js");
if (!fs.existsSync(file)) die("data/lineage.js not found at " + file);
global.window = {};
require(file);
const seed = global.window.LINEAGE;
if (!seed || !Array.isArray(seed.persons)) die("data/lineage.js did not define window.LINEAGE.persons");
const publicIds = new Set(seed.persons.map(p => p.id));
if (!publicIds.size) die("no people found in data/lineage.js — has the format changed?");

// ---- gated people in the database ------------------------------------------
async function get(qs) {
  const res = await fetch(`${URL_BASE}/rest/v1/persons?${qs}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) die(`Supabase returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

(async () => {
  const gated = await get("select=id,name,living,is_minor,visibility&or=(living.eq.true,is_minor.eq.true)");

  // Trust check: this database has living members. A key that sees none is under-
  // privileged, and a silent pass would be worse than no check at all.
  if (!gated.length) {
    die("this key sees zero living/minor people — it cannot read gated rows, so the\n" +
        "  check proves nothing. Use the service-role key.");
  }

  const offenders = gated.filter(p => publicIds.has(p.id));

  console.log(`checked ${publicIds.size} people in data/lineage.js against ` +
              `${gated.length} gated records`);

  if (!offenders.length) {
    console.log("✓ no gated person appears in the public file");
    process.exit(0);
  }

  console.error(`\n✗ ${offenders.length} GATED PERSON(S) ARE PUBLISHED IN data/lineage.js:\n`);
  offenders.forEach(p => {
    const why = [p.living ? "living" : null, p.is_minor ? "MINOR" : null].filter(Boolean).join(" + ");
    console.error(`   ${p.id}  ${p.name}   (${why}, visibility=${p.visibility})`);
  });
  console.error(
    "\n  Either remove them from data/lineage.js — the database keeps them for signed-in\n" +
    "  members — or, if they are in fact deceased, clear persons.living and leave the\n" +
    "  public entry. Do not publish a living relative from the book transcription.\n");
  process.exit(1);
})();
