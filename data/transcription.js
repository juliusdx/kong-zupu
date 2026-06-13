/* Seed transcription for the page-by-page proofreader, keyed by source id then
 * page number (the 16-page enhanced scan of "The Story / 增訂版").
 *
 * THIS IS A MACHINE-VISION BEST-EFFORT DRAFT, cross-checked against the vetted
 * pt1/pt2 data in data/lineage.js — it WILL be wrong in places. The hand is
 * cursive 行草 and several pages are badly faded, so:
 *   〔 〕  = illegible / inferred / uncertain reading (verify against the scan)
 *   Place names carry an English gloss the first time, e.g. 山打根 (Sandakan).
 * Family members fix this in the proofreader; an approved correction is stored
 * in the Supabase `transcriptions` table and shown on top of this seed.
 *
 * Page legibility (for reference): clear → 8,11,12,13,15,16; partial → 2,6;
 * badly faded → 3,4,5,7,14; cover/near-blank → 1. */
window.TRANSCRIPTION_SEED = {
  book_story: {
    1: "〔封底／殘葉，墨色極淡且斑駁；僅右下一小塊文字隱約可見〕\n廿三世〔…〕\n〔生卒、配偶等大半不可辨，待校讀〕",
    2: "〔字跡尚可，惟多處模糊〕\n廿三世〔成／威？〕…\n〔名〕有安　有章　〔「有」字疑為廿五世形名；族譜載 其昌字有喬、其芳字有梓，此處或為同輩兄弟〕\n娶陳氏〔？〕\n〔乙亥年…民國四年…十二月十三日…光緒…〕\n〔餘待校〕",
    3: "〔第三頁：字跡嚴重褪色、斑駁，難以辨識，整頁待校讀〕",
    4: "〔第四頁：字跡褪色嚴重，難以辨識，整頁待校讀〕",
    5: "〔第五頁：字跡褪色嚴重，難以辨識，整頁待校讀〕",
    6: "〔字跡中等〕\n〔連續為生卒、配偶條目〕\n生於民國〔…〕年\n後人以西曆旁註：1915　1928\n〔名諱待校〕",
    7: "〔第七頁：字密且褪色，難辨，整頁待校讀〕",
    8: "〔字跡清晰；自右至左之連續世系條目〕\n四子〔…〕　生於〔…〕　卒於〔…〕\n三子〔…〕字〔…〕\n卒於北〔婆羅洲？〕…\n配〔…〕氏　葬於〔…〕\n長女〔…〕　生於民國〔…〕年\n〔名諱多待校；參族譜廿三—廿五世沙巴一支〕",
    9: "〔字跡尚可〕\n〔…〕公〔…〕先生在〔…〕\n舊曆三月廿三日陰曆〔…〕時生\n字〔…〕乳名〔…〕\n五子〔…〕　葬於〔…〕\n〔名諱待校〕",
    10: "〔字跡偏淡、斑駁〕\n〔生卒、配偶條目〕\n西1907年〔五月？〕…民國〔…〕\n〔名諱多不可辨，待校〕",
    11: "〔字跡尚可〕\n〔…甲申…六月…〕\n四〔房？〕…\n八子漢〔？〕　卒於民國〔…〕\n二女〔…〕\n回曆戊寅年〔…〕…西1908…\n〔名諱待校〕",
    12: "〔字跡清晰；多為沙巴近代記事〕\n三子漢〔？〕　卒於吧巴埠 (Papar)\n四〔房〕…回曆…西1907年五月廿一日…\n長女〔素？〕…回曆…\n證婚人領事〔吳勤訓？〕先生\n西1935…中華民國…在山打根 (Sandakan)…結婚\n乳名其〔永？〕\n〔名諱待校〕",
    13: "〔字跡尚可〕\n〔…甲申…六月…〕\n四〔…〕廣肇〔？〕…西1908…\n〔…〕吧巴埠 (Papar)…\n長子漢〔…〕妻〔…〕\n〔名諱待校〕",
    14: "〔第十四頁：字跡幾乎全為噪點，極難辨識，整頁待校讀〕",
    15: "〔字跡清晰，內容豐富〕\n彭慰照先生〔為養媳？〕… 親生於山打根埠 (Sandakan)　西1946… 週歲過繼\n女慶珠… 舊曆〔甲辰？〕年九月初六…\n〔…〕吧巴埠山邑 (Papar)\n天未明二點一刻屬癸丑時生　舊曆十月十五号　西1936年十二月\n三子漢〔？〕… 卒於民國〔…〕年\n二女素枚〔柏？〕\n長女素芬\n長子漢康　妻蘇瑞蘭\n其〔永？〕\n其安　生於中華民國八年陰曆九月…\n西1935　中華民國廿四年舊曆十月廿日　在山打根領事府結婚\n證婚人領事吳勤訓先生\n〔乳名其永？字林？〕妻劉〔氏？〕\n〔名諱待校〕",
    16: "〔字跡尚可，分上下兩欄〕\n上欄：〔…〕雨時親生於〔亞庇？ Kota Kinabalu〕… 八女慶珠… 民國八年… 慶珠誕生後彌月就過繼…\n長女素芬　次女素枚柏　其永　三子漢〔？〕\n下欄：女晴珠… 容立庭〔？〕… 長子漢威公　西1940　民國卅九年… 乳名其永字林…\n〔名諱待校〕"
  }
};
