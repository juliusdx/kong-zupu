/* Seed transcription for the page-by-page proofreader, keyed by source id then
 * page number. This is a ROUGH DRAFT from machine-vision + light review of faded
 * cursive handwriting — it is expected to be wrong in places, and the page order
 * may not line up with the scan. Family members fix it in the proofreader; an
 * approved correction is stored in the Supabase `transcriptions` table and shown
 * on top of this seed. Plain text only (one entry per scanned page). 〔 〕 marks
 * an illegible / guessed passage. */
window.TRANSCRIPTION_SEED = {
  book_transcription: {
    1: "十四世\n子愚次子 鑅之（或金之）\n生于光緒三十二年五月初五日（1906）\n歿于民國卅年〔月份模糊〕月十三日（1941）\n葬于二支塋北\n配 許氏\n生于民國八年（1919）\n\n十三世\n〔名字模糊〕\n生于民國十二年（1923）\n配〔姓氏模糊〕氏",
    2: "十四世\n鑅之\n〔字跡模糊，推測為生平紀事〕…生於中華民國…\n配 許氏\n\n十三世\n〔名字模糊〕\n生于…〔日期模糊〕\n配〔姓氏模糊〕氏",
    3: "〔第三至第七頁：字跡極度連綿且褪色，為家族各支系成員的連續記錄，主要記十三世至十四世。〕\n常見句式：\n生于民國…\n歿于…\n配…氏\n葬于…",
    4: "",
    5: "",
    6: "",
    7: "",
    8: "十二世\n〔推測為十二世某長輩〕\n長女〔名字模糊〕\n四女〔名字模糊〕\n配 許氏〔?〕\n〔其餘字跡模糊〕",
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
