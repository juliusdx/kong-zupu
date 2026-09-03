const OpenCC = require("opencc-js");
const s2t = OpenCC.Converter({ from: "cn", to: "t" });
const t2s = OpenCC.Converter({ from: "t",  to: "cn" });

// Characters whose SIMPLIFIED form is also a legitimate traditional character,
// or which map to several traditional forms depending on meaning. A converter
// cannot choose between them from a name alone, and guessing corrupts records:
// 江萬里 is the recorded name of a Song chancellor, and every OpenCC profile
// rewrites it to 江萬裏/裡 because 里 is ALSO the simplification of 裏.
const AMBIGUOUS = [
  "里","后","发","干","只","台","面","松","谷","系","丑","板","表","冲","范","曲","别","卜",
  "斗","几","姜","尽","历","卷","累","蒙","朴","仆","苹","舍","胜","术","咸","纤","须","佣",
  "涌","郁","御","云","折","征","症","制","致","钟","周","朱","家","划","回","汇","伙","借",
  "克","困","帘","了","弥","千","秋","沈","什","适","向","幸","于","余","直","志","种","众",
  "筑","准","辟","布","才","彩","虫","出","淀","冬","恶","番","刮","柜","胡","获","饥","奸",
  "据","夸","腊","蜡","联","霉","宁","排","蓬","凭","签","确","洒","伞","丧","扫","涩","晒",
  "湿","实","叹","体","涂","洼","万","网","为","苇","象","着","黄","凌","温","闫","阎","仑",
];
const block = new Set(AMBIGUOUS);

const map = {};
for (let cp = 0x4E00; cp <= 0x9FFF; cp++) {
  const c = String.fromCodePoint(cp);
  if (block.has(c)) continue;
  const t = s2t(c);
  if (t === c || [...t].length !== 1) continue;   // unchanged, or not 1:1
  if (t2s(t) !== c) continue;                     // must round-trip cleanly
  map[c] = t;
}

const entries = Object.entries(map);
let php = `<?php
/**
 * Simplified characters, and the traditional form this archive uses.
 *
 * GENERATED — do not hand-edit. Regenerate with siteground/tools/gen_script_map.js
 * (needs opencc-js; it is not a project dependency, install it in a scratch dir).
 *
 * WHY THIS EXISTS. The book is a traditional-character document and the tree is
 * meant to match it, but relatives contribute from phones with simplified input
 * and nobody notices until much later: 31 people had drifted before anyone
 * looked. This is what lets the review screen say so BEFORE a contribution is
 * approved, rather than a survey finding it weeks afterwards.
 *
 * WHY IT IS ONLY A FLAG. A general converter is not safe on names. Every OpenCC
 * profile turns 江萬里 into 江萬裏 — 里 is a valid traditional character AND the
 * simplification of 裏, and only meaning tells them apart. So the ${block.size}
 * characters listed in AMBIGUOUS below are excluded outright: the reviewer is
 * never shown a suggestion we cannot stand behind. Everything here round-trips
 * 1:1 and has no standing traditional use of its own.
 *
 * LIVING RELATIVES ARE NOT ERRORS. Malaysia writes simplified officially, so a
 * living member's own name may legitimately be simplified. The review screen
 * says so where it can; nothing here converts anything automatically.
 */
declare(strict_types=1);

/** Simplified => traditional. ${entries.length} entries, all unambiguous. */
const SCRIPT_S2T = [
`;
for (let i = 0; i < entries.length; i += 8) {
  php += "    " + entries.slice(i, i + 8).map(([s, t]) => `'${s}'=>'${t}',`).join("") + "\n";
}
php += `];

/** Deliberately NOT converted — see the note above. */
const SCRIPT_AMBIGUOUS = [` + AMBIGUOUS.map(c => `'${c}'`).join(",") + `];
`;
require("fs").writeFileSync("/tmp/script_map.php", php);
console.log("entries:", entries.length, "| ambiguous excluded:", block.size);
console.log("bytes:", php.length);
// sanity
for (const probe of ["里","黄","凌","荣","华","潜","汉","张"])
  console.log("  " + probe + " -> " + (map[probe] ?? "(excluded)"));
