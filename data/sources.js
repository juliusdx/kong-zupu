/* Source documents shown on the 文獻 Sources tab — presented museum-style:
 * the artifact (plate) on the left, a curatorial label + translation on the right.
 *
 * Scans (kind:"pdf", `key`) are FAMILY-ONLY: stored in the PRIVATE Supabase
 * "documents" bucket (see supabase/migration_v4.sql) and served via short-lived
 * signed URLs to signed-in family. Local docs (kind:"html", `localUrl`) live in
 * the repo and are public. The curatorial narrative is public for everyone; only
 * viewing the original scan requires sign-in.
 *
 * Museum fields per exhibit:
 *   medium / mediumEn — what the artifact is (一句話)
 *   era               — short era caption for the plate
 *   glyph             — single character shown on the plate
 *   narrative / narrativeEn — the wall-text (follows the language toggle)
 *   excerpts: [{zh,en}]     — original lines + translation, shown side by side
 *   note / noteEn           — a highlighted curator's/editor's note callout
 */
window.SOURCES = [
  {
    id: "book_pt1",
    key: "kong-family-book-pt1.pdf",
    kind: "pdf",
    pages: 46,
    glyph: "卷",
    title: "江氏族譜 — 手抄本 上冊",
    titleEn: "Kong Family Book — Original Manuscript, Part 1",
    medium: "手抄本", mediumEn: "Handwritten manuscript",
    era: "清 · 開基世系",
    eraEn: "Qing dynasty · founding line",
    desc: "手抄本《江氏族譜》上冊（約46頁）。由始祖江八郎（字文明）起的直系世系，含遷徙與堂號濟陽源流。本站種子資料即轉錄自此。",
    descEn: "Part 1 (≈46 pp) of the handwritten Kong/江 zupu — the direct line from the founder 江八郎, with migration notes and the 濟陽 hall origin. This app's seed data was transcribed from it.",
    narrative: "族譜的開卷，記世系之主幹。始祖江八郎（字文明）相傳自福建寧化石壁——客家播遷的傳說起點——遷居上杭三坪鄉，開基立業。以堂號濟陽為記，載三大房之分衍，及其後歷四百年南遷入粵的漫長脈絡。",
    narrativeEn: "The opening volume traces the trunk of the lineage. It begins with the first ancestor, 江八郎 (style name 文明), who — by the book's account — left 寧化石壁 in Fujian, the legendary gathering-point of the Hakka people, to settle at 三坪鄉 in 上杭 and found the family estate. Recorded under the hall name 濟陽, it sets down the three great branches and the long southward migration that carried the family across four centuries toward Guangdong."
  },
  {
    id: "book_pt2",
    key: "kong-family-book-pt2.pdf",
    kind: "pdf",
    pages: 84,
    glyph: "卷",
    title: "江氏族譜 — 手抄本 下冊",
    titleEn: "Kong Family Book — Original Manuscript, Part 2",
    medium: "手抄本", mediumEn: "Handwritten manuscript",
    era: "清—民國 · 入近代",
    eraEn: "Qing–Republican era",
    desc: "手抄本《江氏族譜》下冊（約84頁），接續上冊，記後世各房及沙巴一支。",
    descEn: "Part 2 (≈84 pp) of the handwritten zupu — continues Part 1 through the later branches, including the line that emigrated to Sabah.",
    narrative: "下冊接續後世各代。自長樂（今五華）、新安李朗（今深圳一帶）以至近代——族中多人皈依巴色會（Basel Mission）的基督信仰，其中一支更遠渡南海，移居英屬北婆羅洲，即今沙巴的古達、山打根與吧巴。",
    narrativeEn: "The second volume carries the line down through the later generations. It follows the family from 長樂 (today 五華) and 新安 李朗 — now part of Shenzhen — into the modern era, when many of its sons embraced the Christian faith of the 巴色會 (Basel Mission), and one branch crossed the South China Sea to British North Borneo: Kudat, Sandakan and Papar, in today's Sabah."
  },
  {
    id: "book_2nd",
    key: "kong-family-book-2nd-ed.pdf",
    kind: "pdf",
    pages: 14,
    glyph: "譜",
    title: "江氏族譜 第二版（沙巴支系摘錄）",
    titleEn: "Kong Family Book — 2nd Edition (Sabah branch)",
    medium: "第二版摘錄", mediumEn: "Second-edition excerpt",
    era: "民國 · 沙巴一支",
    eraEn: "Republican era · the Sabah branch",
    desc: "第二版摘錄，聚焦沙巴（古達、山打根、吧巴）一支的近代世系。",
    descEn: "An excerpt from the 2nd edition focused on the modern Sabah branch (Kudat, Sandakan, Papar).",
    narrative: "第二版十四頁摘錄，專記沙巴一支。所載為十一至十五世之簡略條目——名諱、以舊曆紀年之生卒、配偶與葬地——家族藉以存續記憶的簡練格式。後人並以西曆年份（1915、1928、1942）以鉛筆旁註其側。",
    narrativeEn: "A fourteen-page excerpt from the second edition, devoted to the modern Sabah branch. Its pages record the eleventh through fifteenth generations in spare genealogical entries — a name, birth and death by the old reign-era calendar, a spouse, a place of burial — the lean formulas by which a family kept its memory. Later hands have pencilled Western years (1915, 1928, 1942) into the margins.",
    excerpts: [
      { zh: "子愚次子 鑅之，生于光緒三十二年五月初五日。",
        en: "Ziyu's second son, Hengzhi — born on the fifth day of the fifth month, Guangxu 32 (1906)." },
      { zh: "歿于民國卅年〔月份模糊〕月十三日，葬于二支塋北。",
        en: "Died on the 13th, Republic 30 (1941); buried north of the second-branch graveyard." },
      { zh: "配 許氏，生于民國八年。",
        en: "Married Lady Xu, born Republic 8 (1919)." }
    ]
  },
  {
    id: "book_story",
    key: "kong-family-book-story.pdf",
    kind: "pdf",
    pages: null,
    glyph: "記",
    title: "族譜故事（增訂版）",
    titleEn: "Family Book — The Story (enhanced edition)",
    medium: "敘事增訂", mediumEn: "Narrative edition",
    era: "增訂 · 家族自述",
    eraEn: "Enhanced edition · the family's own telling",
    desc: "以敘事方式整理的家族故事增訂版，補充世系背後的人物與遷徙脈絡。",
    descEn: "A narrative retelling of the family's history that adds context to the people and migrations behind the lineage.",
    narrative: "此非世系冊，而是敘事。增訂版《故事》以行文重述家族，還原一行行姓名背後的人物與旅程——家族自述其源流，及如何成為今日的模樣。",
    narrativeEn: "Not a register but a retelling. The enhanced “Story” edition gathers the lineage into narrative, restoring the people and journeys behind the columns of names — the family's own account of where it came from and how it became what it is."
  },
  {
    id: "book_transcription",
    localUrl: "data/Kong_Family_Book_Transcription.html",
    kind: "html",
    pages: null,
    glyph: "釋",
    title: "江氏族譜 第二版 釋文",
    titleEn: "Kong Family Book — 2nd Edition, Transcription",
    medium: "數位釋文", mediumEn: "Digital transcription",
    era: "今 · 機器視覺＋人工校讀",
    eraEn: "Present day · machine vision + human review",
    desc: "基於機器視覺與人工校對的族譜釋文。由於原稿年代久遠且字跡模糊，部分內容為推測。",
    descEn: "Transcription of the 2nd edition based on machine vision and human review. Due to age and cursive handwriting, some parts are inferred.",
    narrative: "本釋文以機器視覺結合人工逐字校讀，重構第二版內容。凡行草褪墨、難以確證之處，皆以中括號標記，存疑而不掩。是脆弱原件與今日讀者之間的一道橋樑。",
    narrativeEn: "This transcription reconstructs the second edition character by character, pairing machine vision with patient human review. Where cursive brushwork and faded ink defeat certainty, the reading is set in brackets and left honest. It is the bridge between the brittle original and a reader today.",
    note: "由於原稿為行草手寫且年代久遠，墨跡多有褪色。中括號〔 〕內為字跡模糊處的推測或缺失標記。",
    noteEn: "Because the original is cursive and old, with much-faded ink, this reading reconstructs only what is legible. Bracketed 〔 〕 text marks passages that are inferred or illegible."
  }
];
