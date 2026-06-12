/* Source documents shown on the 文獻 Sources tab.
 * These are FAMILY-ONLY scans of the original handwritten 族譜, stored in the
 * PRIVATE Supabase "documents" bucket (see supabase/migration_v4.sql). `key` is
 * the storage object key — upload each PDF under exactly that name. The app mints
 * a short-lived signed URL per view; there is no public link. */
window.SOURCES = [
  {
    id: "book_pt1",
    key: "Kong_Family_book_pt1.pdf",
    kind: "pdf",
    pages: 46,
    title: "江氏族譜 — 手抄本 上冊",
    titleEn: "Kong Family Book — Original Manuscript, Part 1",
    desc: "手抄本《江氏族譜》上冊（約46頁）。由始祖江八郎（字文明）起的直系世系，含遷徙與堂號濟陽源流。本站種子資料即轉錄自此。",
    descEn: "Part 1 (≈46 pp) of the handwritten Kong/江 zupu — the direct line from the founder 江八郎, with migration notes and the 濟陽 hall origin. This app's seed data was transcribed from it."
  },
  {
    id: "book_pt2",
    key: "Kong_Family_book_pt2.pdf",
    kind: "pdf",
    pages: 84,
    title: "江氏族譜 — 手抄本 下冊",
    titleEn: "Kong Family Book — Original Manuscript, Part 2",
    desc: "手抄本《江氏族譜》下冊（約84頁），接續上冊，記後世各房及沙巴一支。",
    descEn: "Part 2 (≈84 pp) of the handwritten zupu — continues Part 1 through the later branches, including the line that emigrated to Sabah."
  },
  {
    id: "book_2nd",
    key: "Kong Family Book 2nd Ed.pdf",
    kind: "pdf",
    pages: 14,
    title: "江氏族譜 第二版（沙巴支系摘錄）",
    titleEn: "Kong Family Book — 2nd Edition (Sabah branch excerpt)",
    desc: "第二版摘錄，聚焦沙巴（古達、山打根、吧巴）一支的近代世系。",
    descEn: "An excerpt from the 2nd edition focused on the modern Sabah branch (Kudat, Sandakan, Papar)."
  },
  {
    id: "book_story",
    key: "Kong Family Book Story 2nd Ed(enhanced).pdf",
    kind: "pdf",
    pages: null,
    title: "族譜故事（增訂版）",
    titleEn: "Family Book — The Story (enhanced edition)",
    desc: "以敘事方式整理的家族故事增訂版，補充世系背後的人物與遷徙脈絡。",
    descEn: "A narrative retelling of the family's history that adds context to the people and migrations behind the lineage."
  }
];
