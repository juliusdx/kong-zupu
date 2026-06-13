/* Seed transcription for the page-by-page proofreader, keyed by source id then
 * page number. This is a ROUGH DRAFT from machine-vision + light review of faded
 * cursive handwriting — it is expected to be wrong in places, and the page order
 * may not line up with the scan. Family members fix it in the proofreader; an
 * approved correction is stored in the Supabase `transcriptions` table and shown
 * on top of this seed. Plain text only (one entry per scanned page). 〔 〕 marks
 * an illegible / guessed passage. */
window.TRANSCRIPTION_SEED = {
  book_story: {
    1: "廿三世子 道珍，给晋顺人女子生一女一男，妻早死。\n三月初五日\n妣王氏，冠县人，生于〔民国?〕二年，殁于〔?〕年\n廿三世公 乐江，城内生于〔?〕年，殁于〔?〕年\n廿二世公 永宏，〔?〕县人，生于〔?〕年，殁于〔?〕年",
    2: "二月初十日去世\n〔?〕年三月三日〔?〕\n廿四世 芳〔?〕 学超\n廿三世〔?〕\n妻 宋氏，中华民国〔?〕年\n廿四世 咸〔?〕，有安，有章\n妻 陳氏，外家深圳罗芳\n生于民国〔?〕年〔?〕月十三日，殁于民国四〔?〕年\n廿三世祖 〔?〕，生于光绪〔?〕年",
    3: "〔本頁為連續的世系與生卒年記錄，字跡極度連筆。〕\n...不免令人下泪...\n民国〔?〕年...\n子 有愿，有全\n妻 黄氏\n廿三世故祖 〔?〕，生于光绪十六年十一月...",
    4: "光绪廿六年〔?〕\n...生于民国三年...\n...殁于民国廿三年...",
    5: "...生于光绪七年...\n...生于〔?〕年...\n廿〔?〕世...",
    6: "1928 (旁註阿拉伯數字)\n1915 (旁註阿拉伯數字)\n1912 (旁註阿拉伯數字)\n生于民国四年...",
    7: "1940 (旁註阿拉伯數字)\n1945 (旁註阿拉伯數字)\n1946 (旁註阿拉伯數字)\n1935 (旁註阿拉伯數字)\n...世界第二次大战...\n停止工作...\n生于民国廿四年（1935年）十二月...",
    8: "1902 (旁註阿拉伯數字)\n〔?〕年四月...",
    9: "十一世至十二世\n〔部分名字可辨〕\n生于民國…\n後人附加阿拉伯數字旁註：1915、1928、1934",
    10: "",
    11: "〔第十一至第十三頁：世系繁衍與子嗣記錄，列出多位「子」與「女」。〕\n生于…年…月…日",
    12: "",
    13: "",
    14: "十四世\n長女〔名字模糊〕\n生于民國二十四年（1935）\n後人旁註：1935\n配〔?〕氏",
    15: "",
    16: "十五世\n〔名字模糊〕\n生于民國三十一年（1942）\n後人旁註：1942\n〔字跡模糊，推測為民國三十七年（1948）相關記錄〕"
  }
};
