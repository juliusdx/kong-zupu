/* ──────────────────────────────────────────────────────────────────────────
 * ADMIN-CONFIRMED CORRECTIONS  (data/overrides.js)
 *
 * This file holds lineage corrections an administrator has confirmed by clicking
 * "Set as correct" in the app's admin mode. It is merged on top of data/lineage.js
 * at load time, so the base transcription stays untouched and every confirmed
 * decision is an auditable, version-controlled diff.
 *
 * HOW IT WORKS
 *   • Open the site with ?admin=1  (e.g. .../index.html?admin=1)
 *   • Click an ancestor that still has candidate names (the ⚑ marker).
 *   • Pick the correct individual → "Download overrides.js".
 *   • Commit the downloaded file here and push. GitHub Pages updates the tree.
 *
 * Each entry is keyed by person id; its fields override that person's fields.
 * Example:
 *   "a13": { name: "懷川公", pinyin: "Huaichuan", confidence: "med",
 *            note: "Confirmed by <name>, <date>: matches chart annotation." }
 * ────────────────────────────────────────────────────────────────────────── */
window.LINEAGE_OVERRIDES = {
  // (empty — no confirmations yet)
};
