/* Rebuilds the public bilingual transcription pages with side-by-side scans:
 *   data/Kong_Family_Book_Transcription.html       (The Story, 16 pp)
 *   data/Kong_Family_book_pt1_Transcription.html   (46 pp)
 *   data/Kong_Family_book_pt2_Transcription.html   (84 pp)
 *
 * Each page is shown as: ORIGINAL SCAN (left) | transcription + English (right).
 *
 * Sources (all committed — no gitignored files needed):
 *   data/transcription.js      — Chinese transcription seed (window.TRANSCRIPTION_SEED)
 *   data/transcription_en.json — English reading aid, keyed "pt1_07" → {type, en}
 *   data/scans/<tag>/pNN.webp  — rendered page images (tag = story | pt1 | pt2)
 *
 * Run after correcting a page so the public HTML matches:
 *   node tools/build_transcription_html.js
 *
 * REGEN-ON-CORRECTION: when family proofread a page, update its Chinese in
 * data/transcription.js, regenerate ITS English into data/transcription_en.json
 * (prose → translation, register → summary), then run this script.
 * See HANDOFF.md → "Page transcriptions & English reading aid".
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

global.window = {};
require(path.join(ROOT, "data", "transcription.js"));
const SEED = window.TRANSCRIPTION_SEED;
const EN = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "transcription_en.json"), "utf8"));

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pad = n => String(n).padStart(2, "0");
const TAG = { prose: "English translation", register: "English summary", faded: "Note" };

const STYLE = `  body { font-family: "PingFang SC", "Heiti SC", sans-serif; line-height: 1.8; padding: 20px; background: #fff; color: #333; max-width: 1080px; margin: 0 auto; }
  h1 { text-align: center; color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; }
  h2 { color: #d35400; margin: 34px 0 6px; border-left: 4px solid #d35400; padding-left: 10px; }
  .note { background: #fdf2e9; padding: 15px; border-radius: 5px; font-size: 0.9em; margin-bottom: 20px; border: 1px solid #fae5d3; }
  .cols { display: grid; grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr); gap: 22px; align-items: start; }
  .scan-col { position: sticky; top: 12px; }
  .scan-col img { width: 100%; height: auto; border: 1px solid #ddd; border-radius: 5px; background: #faf8f4; display: block; }
  .scan-col .hint { font-size: 0.72em; color: #aaa; text-align: center; margin-top: 4px; }
  ul { list-style-type: square; padding-left: 20px; margin: 0 0 10px; }
  li { margin-bottom: 8px; white-space: pre-wrap; }
  .en { background: #f4f7fa; border-left: 3px solid #6b8cae; padding: 10px 14px; margin: 6px 0 4px; border-radius: 4px; font-size: 0.95em; color: #34495e; }
  .en-tag { display: inline-block; font-size: 0.72em; letter-spacing: .04em; text-transform: uppercase; color: #6b8cae; font-weight: 600; margin-right: 8px; }
  .en.faded { color: #999; font-style: italic; }
  @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } .scan-col { position: static; } }`;

const NOTE =
  '<strong>編者註 (Editor’s Note):</strong><br>' +
  '每頁左為原稿掃描，右為逐頁釋文與英文。釋文由機器視覺結合人工校讀而成；原稿為行草手寫、年代久遠，' +
  '部分頁面褪色嚴重，括號 <code>〔 〕</code> 內為字跡難辨之推測或缺失標記。<br>' +
  '英文為輔助閱讀之詮釋，非權威翻譯：散文頁（序文、源流、遷徙記）為全文翻譯，' +
  '名錄頁僅附簡短摘要。家人於校讀器更正某頁中文後，該頁英文亦應隨之重新生成；' +
  '在此之前，英文係依原始機器釋文，可能與已更正之內容不符。歡迎家人對照原稿協助校正。<br>' +
  '<em>Each page shows the original scan on the left and the page-by-page transcription + English on the right. ' +
  'English is an interpretive reading aid, not an authoritative translation — prose pages are translated in full; ' +
  'register / name-list pages carry a short summary only. ' +
  'When a page’s Chinese is corrected in the proofreader, its English should be regenerated.</em>';

const FOOT =
  '<em>(以上釋文與英文詮釋基於原稿掃描，以人工智慧輔以校讀。因屬行草手寫，' +
  '部份人名、地名與年代仍需家族長輩進一步校對。)</em>';

function build(bookKey, tag, title, outFile) {
  const seed = SEED[bookKey] || {};
  const nums = Object.keys(seed).map(Number).sort((a, b) => a - b);
  const rows = nums.map(n => {
    const lines = String(seed[n]).split("\n").filter(l => l.trim());
    const items = lines.map(l => `      <li>${esc(l)}</li>`).join("\n");
    const e = EN[`${tag}_${pad(n)}`] || {};
    const eTxt = esc(e.en || "").replace(/\n/g, "<br>");
    const cls = e.type === "faded" ? "en faded" : "en";
    const eBlock = `<div class="${cls}"><span class="en-tag">${TAG[e.type] || "English"}</span>${eTxt}</div>`;
    const img = `scans/${tag}/p${pad(n)}.webp`;
    return `<section class="page">
  <h2>第${n}頁 (Page ${n})</h2>
  <div class="cols">
    <div class="scan-col">
      <a href="${img}" target="_blank" rel="noopener"><img loading="lazy" src="${img}" alt="原稿 第${n}頁 scan"></a>
      <div class="hint">原稿掃描 · click to enlarge</div>
    </div>
    <div class="text-col">
      <ul>
${items}
      </ul>
      ${eBlock}
    </div>
  </div>
</section>`;
  }).join("\n\n");

  const doc = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${STYLE}
</style>
</head>
<body>

<h1>${title}</h1>

<div class="note">
  ${NOTE}
</div>

${rows}

<p style="margin-top: 40px; color: #7f8c8d; font-size: 0.9em; text-align: center;">
  ${FOOT}
</p>

</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, outFile), doc);
  return nums.length;
}

const a = build("book_story", "story", "族譜故事（增訂版）釋文 — The Story", "data/Kong_Family_Book_Transcription.html");
const b = build("book_pt1", "pt1", "江氏族譜 — 手抄本 上冊 釋文 (Part 1)", "data/Kong_Family_book_pt1_Transcription.html");
const c = build("book_pt2", "pt2", "江氏族譜 — 手抄本 下冊 釋文 (Part 2)", "data/Kong_Family_book_pt2_Transcription.html");
console.log(`built story (${a} pp) + pt1 (${b} pp) + pt2 (${c} pp) with side-by-side scans`);
