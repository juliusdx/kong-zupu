/*
 * Kong / 江 (Jiang) Family Zupu — seed data  (v2, expanded from the full book)
 * ============================================================================
 * Surname 江 (romanized "Kong" in Hakka; Mandarin "Jiang"). Hall name 濟陽 (Jiyang).
 * A Hakka Christian lineage of the 巴色會 (Basel Mission).
 *
 * SOURCES transcribed:
 *   - "Kong_Family_book" pt1 (46 pp) + pt2 (84 pp), the full handwritten 族譜.
 *   - "Kong Family Book 2nd Ed." (14 pp) — an excerpt of the Sabah branch.
 *
 * WHAT THE BOOK ESTABLISHES
 *   • 始祖 (Gen 1): 江八郎 字文明, who moved from 寧化石壁 (Ninghua Shibi, Fujian —
 *     the legendary Hakka dispersal point) to 上杭三坪鄉 and founded the estate.
 *     His 3 sons (三大房): 萬里 / 萬戴(萬載) / 萬頃. The book claims descent from the
 *     Song-dynasty brothers 江萬里 / 江萬載 (益國公, 號古心) — treat as the book's claim.
 *   • Migration: 江左 → 淮陽 → Jiangxi 饒州 → Fujian 汀州府永定縣 烏坭坪 桂花樹下
 *     → (Ming 隆慶3年 ≈ 1569) 廣東惠州府長樂縣 → 永安縣 → (early Qing, 朝鴻/朝湧)
 *     新安縣 鹽田 → 李朗 (Lilang, today Shenzhen). A separate line went 長樂 →
 *     North Borneo (古達 Kudat / 山打根 Sandakan / 吧巴 Papar, Sabah) via the Basel Mission.
 *
 * CONFIDENCE
 *   high  — printed/clear and internally consistent
 *   med   — legible handwriting, minor uncertainty
 *   low   — best-effort reading; verify via Contribute
 *   The middle generations (13–18) of the Sabah line are now reconstructed from
 *   the master charts (pt1 pp.1–3) and the 起瀾公 entry (pt2): 元珠→川→道→日→朝→龍→起瀾→紹泗.
 *   The generation CHARACTERS are firm; some individual gen-13/16/17 names are still
 *   placeholders (each generation had many brothers) and carry confidence:"low".
 *
 * Data shape matches /supabase/schema.sql so this can be swapped for a live DB.
 */
window.LINEAGE = {

  generationPoem: {
    surname: "江",
    surnamePinyin: "Kong",   // 江 = "Kong" in Hakka; "Jiang" in Mandarin
    hallName: "濟陽",
    hallNamePinyin: "Jiyang",
    note: "No single formal 字輩 poem is printed; the characters below are those actually used, generation by generation, along the direct line in the book. A family elder may know the full poem.",
    characters: [
      { gen: 1,  char: "八郎",  pinyin: "Baliang",  note: "始祖 字文明" },
      { gen: 2,  char: "萬",    pinyin: "Wan",      note: "萬里 / 萬戴 / 萬頃" },
      { gen: 5,  char: "貴",    pinyin: "Gui",      note: "六九郎 諱貴七" },
      { gen: 6,  char: "文/通", pinyin: "Wen/Tong", note: "千一郎 文通" },
      { gen: 12, char: "元",    pinyin: "Yuan",     note: "元珊/元玉/元珍/元珠" },
      { gen: 13, char: "川",    pinyin: "Chuan",    note: "組川/懷川/蔡川/釋川" },
      { gen: 14, char: "道",    pinyin: "Dao",      note: "道同/道通" },
      { gen: 15, char: "日",    pinyin: "Ri",       note: "日標 字建章" },
      { gen: 16, char: "朝",    pinyin: "Chao",     note: "朝湧/朝鴻 → 李朗(Shenzhen) branch" },
      { gen: 17, char: "龍",    pinyin: "Long",     note: "龍見 …" },
      { gen: 18, char: "起",    pinyin: "Qi",       note: "起瀾公 庠名東洋 (五大房)" },
      { gen: 20, char: "紹",    pinyin: "Shao",     note: "紹泗 / 紹淮 / 紹淡 …" },
      { gen: 21, char: "承",    pinyin: "Cheng",    note: "承續 / 承緒 / 承業" },
      { gen: 22, char: "大",    pinyin: "Da",       note: "大信 / 大忠" },
      { gen: 23, char: "永",    pinyin: "Yong",     note: "永宏 / 永仁 / 永崇" },
      { gen: 24, char: "俊 / 耀", pinyin: "Jun / Yao", note: "milk-name 俊 pairs with formal 集" },
      { gen: 25, char: "其 / 道", pinyin: "Qi / Dao",  note: "milk-name 其 pairs with formal 有" },
      { gen: 26, char: "漢",    pinyin: "Han" }
    ]
  },

  // --- PLACES ---------------------------------------------------------------
  places: [
    // origins & ancestral seats
    { id: "p_ninghua",   type: "origin", name: "寧化石壁",            nameEn: "Ninghua Shibi, Fujian — Hakka dispersal point", lat: 26.253, lng: 116.766, approximate: true,  note: "始祖 八郎 migrated FROM here to 上杭." },
    { id: "p_shanghang", type: "origin", name: "上杭 三坪鄉",          nameEn: "Sanping, Shanghang, Fujian", lat: 25.050, lng: 116.420, approximate: true,  note: "始祖 八郎 opened the estate (開基). Gen 1–3 buried here." },
    { id: "p_yongding",  type: "origin", name: "永定 溪南里 烏坭坪",    nameEn: "Wunipping, Xinan, Yongding, Fujian", lat: 24.720, lng: 116.730, approximate: true,  note: "'桂花樹下' — gens 4–5+ born/buried; 賴氏(貴七公妻) buried here." },
    { id: "p_zhangzhou", type: "residence", name: "汀州府",            nameEn: "Tingzhou (Changting), Fujian", lat: 25.842, lng: 116.360, approximate: true,  note: "原居 汀州府 before移 to Guangdong." },
    // Guangdong stops
    { id: "p_yongan",    type: "residence", name: "惠州府 永安縣",      nameEn: "Yong'an (today Zijin), Heyuan, Guangdong", lat: 23.635, lng: 115.183, approximate: true,  note: "下義約; gens 8–10 born/buried (蛋家田, 羊屎坑)." },
    { id: "p_haifeng",   type: "grave",   name: "海豐縣",              nameEn: "Haifeng, Shanwei, Guangdong", lat: 22.967, lng: 115.330, approximate: true,  note: "Gen 9 六郎公 & others buried here (海陽/海豐)." },
    { id: "p_changle",   type: "origin",  name: "長樂 (今五華縣)",      nameEn: "Changle (now Wuhua), Meizhou, Guangdong", lat: 23.924, lng: 115.778, approximate: true,  note: "彰村 / 元坑 / 雙頭. Sabah branch's home county." },
    { id: "p_zhangkeng", type: "residence", name: "東莞 樟坑徑",        nameEn: "Zhangkengjing (Dongguan/Shenzhen border)", lat: 22.690, lng: 114.030, approximate: true,  note: "Some gen-24 births '在東莞樟坑徑 / 長山口'." },
    { id: "p_lilang",    type: "residence", name: "新安 李朗",          nameEn: "Lilang, today Shenzhen", lat: 22.650, lng: 114.120, approximate: true,  note: "朝鴻/朝湧 settled here early Qing (鹽田→李朗). 李朗 branch home; 江氏書室." },
    { id: "p_zengcheng", type: "residence", name: "增城 / 廣府",        nameEn: "Zengcheng / Guangzhou prefecture", lat: 23.290, lng: 113.810, approximate: true,  note: "元珊/元珠 descendants moved here; met at 廣府 ancestral-rites gatherings." },
    // graves of the direct upper line
    { id: "p_lilan",     type: "grave",   name: "浬蘭 石角 / 李蘭 花瓶嘴", nameEn: "Lilan Shijiao / Huapingzui (burial)", lat: 23.90, lng: 115.80, approximate: true,  note: "紹泗公 (gen 20) buried 石角; wife 鄭氏 & 承緒 buried 花瓶嘴. Near 長樂 — verify.", confidence: "low" },
    { id: "p_dahu",      type: "grave",   name: "大湖公嶺 聖會墳場",     nameEn: "Dahu Gongling — Basel Mission cemetery", lat: 23.90, lng: 115.80, approximate: true,  note: "承續公 & 梁氏(望福), buried at the 陰城 church ground. Exact plot to verify.", confidence: "low" },
    { id: "p_shuangtou", type: "church_grave", name: "雙頭聖教堂 / 大徑陰城", nameEn: "Shuangtou Holy Church / Dajing", lat: 23.91, lng: 115.82, approximate: true, note: "永宏 first buried here, later moved.", confidence: "low" },
    { id: "p_yincheng",  type: "church_grave", name: "陰城 教會墳場 (彰村)", nameEn: "Yincheng church cemetery, Changcun", lat: 23.92, lng: 115.79, approximate: true, note: "Several gen-23/24 members: '教會陰城立有石灰坟石碑記'.", confidence: "low" },
    // ancestral halls (祠堂)
    { id: "p_hall_prov", type: "hall",    name: "省城 江氏書室 (長興里)", nameEn: "Jiang clan hall/study, Guangzhou (Changxingli)", lat: 23.117, lng: 113.259, approximate: true, note: "'在省城長興里江氏書室有正碑位'. Couplets recorded in the book.", confidence: "low" },
    { id: "p_hall_yd",   type: "hall",    name: "永定 祖堂",            nameEn: "Yongding ancestral hall", lat: 24.720, lng: 116.730, approximate: true, note: "'永定祖堂對聯' recorded in the book.", confidence: "low" },
    // diaspora — Sabah
    { id: "p_kudat",     type: "diaspora", name: "古達",               nameEn: "Kudat, Sabah, Malaysia", lat: 6.883, lng: 116.848, approximate: false, note: "'古達聖會義學堂' — Basel Mission Hakka settlement." },
    { id: "p_sandakan",  type: "diaspora", name: "山打根",             nameEn: "Sandakan, Sabah, Malaysia", lat: 5.840, lng: 118.118, approximate: false, note: "Gen-24/25 births & church." },
    { id: "p_papar",     type: "diaspora", name: "吧巴 / 巴色堆山邑",    nameEn: "Papar, Sabah, Malaysia", lat: 5.733, lng: 115.933, approximate: true,  note: "Later-generation births.", confidence: "low" },
    { id: "p_lianzhou",  type: "residence", name: "連州",              nameEn: "Lianzhou, Guangdong", lat: 24.783, lng: 112.383, approximate: true, note: "原籍連州 recorded for 有喬 (其昌)." }
  ],

  // --- PERSONS --------------------------------------------------------------
  persons: [

    // ===== DEEP ANCESTRY (Gen 1–12) — pt1 pp.18–27 =====
    { id: "a01",  gen: 1, name: "江八郎", pinyin: "Baliang", style: "字文明", gender: "m", relation: "始祖 Founding ancestor", residencePlace: "p_shanghang", bio: "由寧化石壁移來上杭三坪鄉開基五業。所生三大房：長萬里、次萬戴、三萬頃。", confidence: "med" },
    { id: "a01w", gen: 1, name: "張一娘", pinyin: "Madam Zhang", gender: "f", spouseOf: "a01", burialPlace: "p_shanghang", note: "合塋福建上杭三坪鄉.", confidence: "med" },

    { id: "a02b", gen: 2, father: "a01", name: "江萬里", pinyin: "Wanli", style: "諱億 號古山", gender: "m", relation: "伯祖 (granduncle)", bio: "官授錦衣衛指揮使，亦授禮部尚書。(book links the line to the Song 江萬里 lineage)", confidence: "low" },
    { id: "a02c", gen: 2, father: "a01", name: "江萬戴", pinyin: "Wandai", style: "諱臨 號古心 益國公", gender: "m", relation: "伯祖 (granduncle)", bio: "登咸淳進士，端宗朝尚書、丞相，追封大傅益國公。(= the historical 江萬里 / 江萬載, claimed ancestor)", confidence: "low" },
    { id: "a02",  gen: 2, father: "a01", name: "江萬頃", pinyin: "Wanqing", style: "十二郎 名伯古崖", gender: "m", relation: "二世祖 (direct line)", spousePlace: "p_shanghang", bio: "宋朝明經鄉舉，授翰林院中書、戶部左侍郎、知南劍州。", confidence: "med" },
    { id: "a02w", gen: 2, name: "錢氏九娘", pinyin: "Madam Qian", gender: "f", spouseOf: "a02", burialPlace: "p_shanghang", note: "合塋上杭三坪鄉.", confidence: "low" },

    { id: "a04",  gen: 4, father: "a02", name: "百三郎", pinyin: "Baisanlang", gender: "m", relation: "四世祖 (direct line)", burialPlace: "p_yongding", bio: "雙塋于永定縣溪南里。所生二子：長六九郎(貴七)、次六三郎(貴六)。", note: "Gen-3 link is via the 'five great branches' split (三世分為五大支) — the individual gen-3 ancestor is not separately identified.", confidence: "low" },
    { id: "a04w", gen: 4, name: "徐氏妙祥", pinyin: "Madam Xu", gender: "f", spouseOf: "a04", burialPlace: "p_yongding", confidence: "low" },

    { id: "a05",  gen: 5, father: "a04", name: "六九郎", pinyin: "Liujiulang", style: "諱貴七公", gender: "m", relation: "五世祖", burialPlace: "p_yongding", bio: "塋在福建汀州府永定縣烏坭坪溪南里。所生二子：長千一郎(文通)、次千二郎(斌通)。", note: "新安老族譜舊以賴氏/貴七為始祖；道光五年(1825)合譜接上更早之祖.", confidence: "med" },
    { id: "a05w", gen: 5, name: "賴氏", pinyin: "Madam Lai", gender: "f", spouseOf: "a05", burialPlace: "p_yongding", confidence: "med" },

    { id: "a06",  gen: 6, father: "a05", name: "千一郎", pinyin: "Qianyilang", style: "諱文通", gender: "m", relation: "六世祖", burialPlace: "p_yongding", bio: "葬于永定縣溪南。一房住長樂縣五名赤瀝。", confidence: "med" },
    { id: "a06w", gen: 6, name: "瑪氏", pinyin: "Madam Ma", gender: "f", spouseOf: "a06", confidence: "low" },

    { id: "a07",  gen: 7, father: "a06", name: "東山公", pinyin: "Dongshan", gender: "m", relation: "七世祖", burialPlace: "p_haifeng", bio: "塋于惠州海豐縣。生子 受寧四郎。", confidence: "low" },

    { id: "a08",  gen: 8, father: "a07", name: "四郎", pinyin: "Siliang", style: "諱受寧", gender: "m", relation: "八世祖", burialPlace: "p_yongan", bio: "塋於永安下義。生子 六郎公。", confidence: "low" },
    { id: "a08w", gen: 8, name: "黃氏", pinyin: "Madam Huang", gender: "f", spouseOf: "a08", confidence: "low" },

    { id: "a09",  gen: 9, father: "a08", name: "六郎公", pinyin: "Liuliang", gender: "m", relation: "九世祖", burialPlace: "p_haifeng", bio: "塋于海豐縣。生子 志清公。", confidence: "low" },
    { id: "a09w", gen: 9, name: "刁陳氏", pinyin: "Madam Diao-Chen", gender: "f", spouseOf: "a09", confidence: "low" },

    { id: "a10",  gen: 10, father: "a09", name: "志清公", pinyin: "Zhiqing", gender: "m", relation: "十世祖", burialPlace: "p_yongan", bio: "塋于永安山子下，土名蛋家田。生子 積富公。", confidence: "low" },
    { id: "a10w", gen: 10, name: "吳氏", pinyin: "Madam Wu", gender: "f", spouseOf: "a10", confidence: "low" },

    { id: "a11",  gen: 11, father: "a10", name: "積富公", pinyin: "Jifu", gender: "m", relation: "十一世祖", bio: "生下四大房：長元珊、次元玉、三元珍、四元珠。", confidence: "low" },
    { id: "a11w", gen: 11, name: "鄭氏大娘", pinyin: "Madam Zheng", gender: "f", spouseOf: "a11", confidence: "low" },

    { id: "a12",  gen: 12, father: "a11", name: "元珠公", pinyin: "Yuanzhu", gender: "m", relation: "十二世 (direct line)", note: "Brothers 元珊/元玉/元珍. 元珊/元珠 descendants moved to 增城/廣府.", confidence: "low" },

    // ===== RECONSTRUCTED MID-LINE: Gen 13–18 (from master charts pt1 pp.1–3 + 起瀾公 entry pt2) =====
    // Topology now traced: 元珠 → 川 → 道 → 日 → 朝 → 龍 → 起瀾公 → 紹泗.
    // Generation CHARACTERS are firm (per the charts); the specific INDIVIDUAL on the
    // direct Sabah line for gens 13–17 is not yet pinned (each generation had many brothers),
    // so those nodes carry the generation character + the candidate names from the chart.
    // 起瀾公 (gen 18) is named & well-attested: his entry lists the 五大房 incl. 紹泗.
    { id: "a13", gen: 13, father: "a12", name: "（十三世 · 川字輩）", pinyin: "Chuan generation", gender: "m", relation: "十三世 (direct line — individual unconfirmed)", confidence: "low",
      note: "Chart lists the 川-generation brothers 組川 / 懷川 / 蔡川 / 釋川. Which one continues the Sabah line is not yet pinned — only the generation is certain.",
      candidates: [
        { name: "組川公", pinyin: "Zuchuan" },
        { name: "懷川公", pinyin: "Huaichuan", note: "懷川公子孫居廣寧古英龍 (per chart annotation)." },
        { name: "蔡川公", pinyin: "Caichuan" },
        { name: "釋川公", pinyin: "Shichuan", note: "妻郭氏 (per chart)." }
      ] },
    { id: "a14", gen: 14, father: "a13", name: "道通公", pinyin: "Daotong", gender: "m", relation: "十四世 (道字輩)", confidence: "low",
      note: "道-generation; chart shows 道同 / 道通. 道通 carries the line down to the 日 generation." },
    { id: "a15", gen: 15, father: "a14", name: "日標公", pinyin: "Ribiao", style: "字建章", gender: "m", relation: "十五世 (日字輩)", confidence: "low",
      note: "日-generation; chart shows 日韓 / 日煌 / 日炟 / 日標 / 日嘉 …; 日標公 (字建章) is shown fathering the 朝 generation." },
    { id: "a16", gen: 16, father: "a15", name: "（十六世 · 朝字輩）", pinyin: "Chao generation", gender: "m", relation: "十六世 (朝字輩 — individual unconfirmed)", confidence: "low",
      note: "朝-generation brothers incl. 朝淵 / 朝洪 / 朝湧 / 朝鴻 (朝湧·朝鴻 settled 新安李朗 / today Shenzhen — a sibling branch). The Sabah line continues via a different 朝 brother who stayed near 長樂.",
      candidates: [
        { name: "朝淵公", pinyin: "Chaoyuan" },
        { name: "朝洪公", pinyin: "Chaohong", note: "生一房，永安 (per chart)." },
        { name: "朝淨公", pinyin: "Chaojing" },
        { name: "朝泳公", pinyin: "Chaoyong", note: "生三房，永安 (per chart)." },
        { name: "朝陽公", pinyin: "Chaoyang" },
        { name: "朝湧公", pinyin: "Chaoyong", note: "⚠ settled 李朗 (Shenzhen) — the OTHER branch, likely NOT the Sabah line." },
        { name: "朝鴻公", pinyin: "Chaohong", note: "⚠ settled 李朗 (Shenzhen) — the OTHER branch, likely NOT the Sabah line." }
      ] },
    { id: "a17", gen: 17, father: "a16", name: "（十七世 · 龍字輩）", pinyin: "Long generation", gender: "m", relation: "十七世 (龍字輩 — individual unconfirmed)", confidence: "low",
      note: "龍-generation (chart shows 龍見 etc.); father of 起瀾公.",
      candidates: [
        { name: "龍見公", pinyin: "Longjian", note: "shown on chart; other 龍-generation brothers not yet transcribed." }
      ] },
    { id: "a18", gen: 18, father: "a17", name: "江起瀾公", pinyin: "Qilan", style: "庠名 東洋", gender: "m", relation: "十八世祖 (direct line)", bio: "公平日博覽群書、廣栽桃李。生於甲辰年五月廿九寅時，卒於乾隆甲午年(1774)。葬大坑圍背黃泥夾。所生五大房：長通漢、次通澤、三紹淮、四紹泗、五紹淡。", confidence: "med",
      note: "Named, well-attested ancestor — his entry (pt2) lists the 五大房, of which 紹泗公 is the direct Sabah-line father. This is the anchor that closes the 13–19 gap." },
    { id: "a18w", gen: 18, name: "涂氏", pinyin: "Madam Tu", gender: "f", spouseOf: "a18", confidence: "low", note: "元配; 續妣 何氏." },

    // ===== Gen 20 — 紹泗 (pt2 p.66; son of 起瀾公) =====
    // NOTE: chart numbering would make 紹泗 gen 19 (起瀾18→紹泗19), but the per-person entries
    // label 承續 as 二十一世祖, which puts 紹泗 at gen 20. This ±1 seam comes from the 1825 (道光5年)
    // 合譜 that spliced the older 4-generation 新安老族譜 onto the deeper ancestry. Entry numbering kept.
    { id: "a20",  gen: 20, father: "a18", name: "江紹泗公", pinyin: "Shaosi", gender: "m", relation: "考祖 (direct father of 承續)", burialPlace: "p_lilan", bio: "起瀾公第四房。生 承續、承緒、承業。墓在浬蘭石角。", confidence: "med", note: "起瀾18→紹泗20 spans the 1825 合譜 numbering seam (see note above) — one intermediate generation is absorbed in the merge." },
    { id: "a20w", gen: 20, name: "鄭氏", pinyin: "Madam Zheng", gender: "f", spouseOf: "a20", burialPlace: "p_lilan", note: "墓在李蘭花瓶嘴.", confidence: "med" },

    // ===== Gen 21 — 承 generation (pt2 pp.66–67) =====
    { id: "k_chengxu",   gen: 21, father: "a20", name: "承緒",  pinyin: "Cheng Xu",  gender: "m", relation: "叔祖 (uncle of the line)", burialPlace: "p_lilan", note: "塋在土名 李蘭花瓶嘴.", confidence: "med" },
    { id: "k_chengye",   gen: 21, father: "a20", name: "承業",  pinyin: "Cheng Ye",  gender: "m", relation: "叔祖", note: "塋在土名 大隆.", confidence: "med" },
    { id: "k_chengxu2",  gen: 21, father: "a20", name: "承續",  pinyin: "Cheng Xu",  gender: "m", relation: "二十一世祖 (direct line)", burialPlace: "p_dahu", confidence: "med" },
    { id: "k_liangshi",  gen: 21, name: "梁氏",  pinyin: "Madam Liang", ritualName: "望福", ritualPinyin: "Wangfu", gender: "f", spouseOf: "k_chengxu2", religion: "進巴色耶穌教 (Basel Mission)", birthYear: "壬寅年四月初八", deathYear: "甲子年", lifespan: "享壽八十三歲 (aged 83)", burialPlace: "p_dahu", confidence: "med" },

    // ===== Gen 22 — 大 generation =====
    { id: "k_dazhong",   gen: 22, father: "k_chengxu2", name: "大忠",  pinyin: "Da Zhong", gender: "m", relation: "祖伯", note: "早喪 (died young).", confidence: "med" },
    { id: "k_daxin",     gen: 22, father: "k_chengxu2", name: "大信",  pinyin: "Da Xin",  ritualName: "樂", gender: "m", relation: "二十二世祖 (direct line)", religion: "進巴色耶穌教 禮名 樂", bio: "公生平雜務農業亦精商務，孝奉祖母，柔得宜和，鄰睦族忠，直待人。", lifespan: "享壽五旬有四歲 (aged 54)", confidence: "med" },
    { id: "k_zhangshi",  gen: 22, name: "張氏",  pinyin: "Madam Zhang", ritualName: "来安", ritualPinyin: "Lai'an", gender: "f", spouseOf: "k_daxin", religion: "禮號 来安", bio: "勤儉維家，教子有方，鄰里諸事盡勞而不怨。", lifespan: "享壽七旬八歲 (aged 78)", confidence: "med" },

    // ===== Gen 23 — 永 generation =====
    { id: "k_yazhao",    gen: 23, father: "k_daxin", name: "亞招",  pinyin: "Ya Zhao",  gender: "f", marriedOut: "嫁黃沙坑凌屋", confidence: "low" },
    { id: "k_yonghong",  gen: 23, father: "k_daxin", name: "永宏",  pinyin: "Yong Hong", ritualName: "昌富", hao: "毅涵", gender: "m", relation: "二十三世 (direct line)", religion: "洗禮名 昌富 號 毅涵", birthYear: "乙巳年二月廿五日", bio: "公平生愛人，教子有方，心為天道流行；在長樂居處二十二年。後缺在雙頭聖教堂葬，大徑陰城有坟碑。", burialPlace: "p_shuangtou", confidence: "med" },
    { id: "k_yongren",   gen: 23, father: "k_daxin", name: "永仁",  pinyin: "Yong Ren", ritualName: "昌貴", hao: "任堂", gender: "m", relation: "二十三世叔", religion: "廣東巴色會長樂封為帮教書記職", confidence: "med" },
    { id: "k_yongchong", gen: 23, father: "k_daxin", name: "永崇",  pinyin: "Yong Chong", ritualName: "昌發", hao: "欽道", gender: "m", relation: "二十三世", religion: "洗禮名 昌發 號 欽道", note: "妣洪氏，以耀華為子 (adopted 耀華).", confidence: "med" },
    { id: "k_changxing", gen: 23, father: "k_daxin", name: "昌興",  pinyin: "Chang Xing", gender: "m", note: "早喪.", confidence: "low" },
    { id: "k_xinjiao",   gen: 23, father: "k_daxin", name: "新嬌",  pinyin: "Xin Jiao", gender: "f", confidence: "low" },
    { id: "k_lishi",     gen: 23, name: "黎氏",  pinyin: "Madam Li", ritualName: "恩照", ritualPinyin: "Enzhao", gender: "f", spouseOf: "k_yonghong", religion: "禮名 恩照", note: "生下四子四女.", confidence: "med" },
    { id: "k_luoshi",    gen: 23, name: "羅氏",  pinyin: "Madam Luo", ritualName: "輝光", ritualPinyin: "Huiguang", gender: "f", spouseOf: "k_yongren", confidence: "med" },
    { id: "k_hongshi",   gen: 23, name: "洪氏",  pinyin: "Madam Hong", gender: "f", spouseOf: "k_yongchong", confidence: "low" },

    // ===== Gen 24 — children of 永宏 (俊/集) =====
    { id: "k_junen",     gen: 24, father: "k_yonghong", name: "俊恩",  pinyin: "Jun En",  formalName: "集如", gender: "m", relation: "長子", birthYear: "癸酉年十二月初七", religion: "集如 乳名 俊恩", confidence: "med" },
    { id: "k_junhua",    gen: 24, father: "k_yonghong", name: "俊華",  pinyin: "Jun Hua", gender: "m", relation: "二子", birthYear: "光緒元年乙亥十一月十三日", birthPlace: "p_changle", confidence: "med" },
    { id: "k_junming",   gen: 24, father: "k_yonghong", name: "俊明",  pinyin: "Jun Ming", formalName: "集恩", gender: "m", relation: "三子 (direct line)", birthYear: "光緒三年丁丑十月初十日", religion: "集恩 乳名 俊明", birthPlace: "p_changle", confidence: "med" },
    { id: "k_jungong",   gen: 24, father: "k_yonghong", name: "俊恭",  pinyin: "Jun Gong", gender: "m", relation: "四子", birthYear: "光緒十六年庚寅十二月初九日", birthPlace: "p_changle", confidence: "med" },
    { id: "k_wangshi",   gen: 24, name: "王氏",  pinyin: "Madam Wang", ritualName: "寵恩", ritualPinyin: "Chong'en", gender: "f", spouseOf: "k_junen", confidence: "low" },
    { id: "k_chenshi",   gen: 24, name: "陳氏",  pinyin: "Madam Chen", ritualName: "永貞", ritualPinyin: "Yongzhen", gender: "f", spouseOf: "k_junming", confidence: "med" },

    // ===== Gen 24 — children of 永仁 (耀) =====
    { id: "k_qiongying", gen: 24, father: "k_yongren", name: "瓊英",  pinyin: "Qiong Ying", gender: "f", relation: "長女", birthYear: "同治十年辛未十二月十五日", marriedOut: "出嫁于樟坑徑陳必達", confidence: "low" },
    { id: "k_guien",     gen: 24, father: "k_yongren", name: "癸恩",  pinyin: "Gui En", gender: "m", relation: "次子", birthYear: "同治十二年癸酉十一月廿五日", confidence: "low" },
    { id: "k_yaoci",     gen: 24, father: "k_yongren", name: "耀慈",  pinyin: "Yao Ci",  gender: "m", relation: "三子", birthYear: "光緒二年丙子二月廿一日", birthPlace: "p_changle", confidence: "low" },
    { id: "k_yaoxiang",  gen: 24, father: "k_yongren", name: "耀祥",  pinyin: "Yao Xiang", gender: "m", relation: "五子", birthYear: "光緒六年庚辰五月十六日", birthPlace: "p_changle", confidence: "low" },
    { id: "k_yunying",   gen: 24, father: "k_yongren", name: "雲英",  pinyin: "Yun Ying", gender: "f", relation: "四女", birthYear: "光緒四年戊寅二月初九日", confidence: "low" },
    { id: "k_yaohua",    gen: 24, father: "k_yongren", name: "耀華",  pinyin: "Yao Hua", gender: "m", relation: "六子", note: "過繼永崇 (adopted to 永崇's line).", confidence: "low" },
    { id: "k_fuying",    gen: 24, father: "k_yongren", name: "福英",  pinyin: "Fu Ying", gender: "f", relation: "七女", birthYear: "光緒十年甲申十二月十七日", birthPlace: "p_changle", confidence: "low" },
    { id: "k_yaoan",     gen: 24, father: "k_yongren", name: "耀安",  pinyin: "Yao An",  gender: "m", relation: "八子", birthYear: "光緒十三年丁亥四月十二日", birthPlace: "p_changle", confidence: "low" },
    { id: "k_qingying",  gen: 24, father: "k_yongren", name: "慶英",  pinyin: "Qing Ying", gender: "f", relation: "九女", birthYear: "光緒十五年己丑七月十二日", birthPlace: "p_changle", confidence: "low" },
    { id: "k_yaozhen",   gen: 24, father: "k_yongren", name: "耀珍",  pinyin: "Yao Zhen", gender: "m", relation: "十子", birthYear: "光緒十九年癸巳六月二十日", birthPlace: "p_papar", confidence: "low" },

    // ===== Gen 25 — children of 俊明 (其/有) =====
    { id: "k_luoying",   gen: 25, father: "k_junming", name: "珞英",  pinyin: "Luo Ying", gender: "f", relation: "長女", birthYear: "光緒二十五年己亥", birthPlace: "p_kudat", note: "生于永安駱坑教堂.", confidence: "low" },
    { id: "k_qizhen",    gen: 25, father: "k_junming", name: "其禎",  pinyin: "Qi Zhen", gender: "m", relation: "次子", birthYear: "光緒二十八年壬寅", birthPlace: "p_sandakan", confidence: "low" },
    { id: "k_qixiang",   gen: 25, father: "k_junming", name: "其祥",  pinyin: "Qi Xiang", gender: "m", relation: "三子", birthYear: "民國十年辛酉 (1921)", confidence: "low" },
    { id: "k_qichang",   gen: 25, father: "k_junming", name: "其昌",  pinyin: "Qi Chang", formalName: "有喬", gender: "m", relation: "四子 (direct line)", birthYear: "民國二年 (1913)", religion: "有喬 乳名 其昌", residencePlace: "p_lianzhou", note: "原籍連州.", confidence: "med" },
    { id: "k_qifang",    gen: 25, father: "k_junming", name: "其芳",  pinyin: "Qi Fang", formalName: "有梓", gender: "m", relation: "五子", religion: "有梓 乳名 其芳", confidence: "med" },
    { id: "k_qiqing",    gen: 25, father: "k_junming", name: "其清",  pinyin: "Qi Qing", gender: "m", relation: "六子", birthYear: "宣統元年己酉 (1909)", birthPlace: "p_sandakan", confidence: "low" },
    { id: "k_qiyong",    gen: 25, father: "k_junming", name: "其永",  pinyin: "Qi Yong", gender: "m", relation: "七子", confidence: "low" },
    { id: "k_daoxi",     gen: 25, father: "k_junen", name: "道希",  pinyin: "Dao Xi",  gender: "m", relation: "長子", note: "早喪, 古達.", confidence: "low" },
    { id: "k_daozhen",   gen: 25, father: "k_junen", name: "道珍",  pinyin: "Dao Zhen", gender: "m", relation: "三子", birthYear: "光緒廿九年癸卯", birthPlace: "p_kudat", confidence: "low" },
    { id: "k_xuaizhen",  gen: 25, name: "徐愛貞",  pinyin: "Xu Aizhen", gender: "f", spouseOf: "k_qichang", note: "民國八年 (1919) 結婚.", confidence: "low" },
    { id: "k_huangciying", gen: 25, name: "黃慈英", pinyin: "Huang Ciying", gender: "f", spouseOf: "k_qifang", confidence: "low" },

    // ===== Gen 26 — 漢 generation =====
    { id: "k_hanqiang",  gen: 26, father: "k_qichang", name: "漢強",  pinyin: "Han Qiang", gender: "m", relation: "長子", birthYear: "民國十三年 / 1924", confidence: "low" },
    { id: "k_hanxing",   gen: 26, father: "k_qichang", name: "漢興",  pinyin: "Han Xing", gender: "m", relation: "次子", birthYear: "民國十五年 / 1926", confidence: "low" },
    { id: "k_hanying",   gen: 26, father: "k_qichang", name: "漢英",  pinyin: "Han Ying", gender: "f", relation: "三女", birthYear: "民國十八年 / 1929", confidence: "low" },
    { id: "k_hanxian",   gen: 26, father: "k_qichang", name: "漢賢",  pinyin: "Han Xian", gender: "m", relation: "四子", birthYear: "民國廿三年 / 1934", confidence: "low" },
    { id: "k_ruizhu",    gen: 26, father: "k_qichang", name: "瑞珠",  pinyin: "Rui Zhu", gender: "f", relation: "五女", birthYear: "民國廿二年", confidence: "low" },
    { id: "k_hanneng",   gen: 26, father: "k_qifang", name: "漢能",  pinyin: "Han Neng", gender: "m", relation: "子", birthYear: "民國廿一年 / 1932", confidence: "low" },
    { id: "k_runzhu",    gen: 26, father: "k_qifang", name: "潤珠",  pinyin: "Run Zhu", gender: "f", relation: "女", birthYear: "民國廿三年 / 1934", confidence: "low" },

    // ===== COLLATERAL — 九房 起瀨公 house (pt2 pp.53–58) =====
    // Brother of 起瀾公; all confidence low (cursive handwriting). 起瀨/起清/起瀾
    // are sons of the gen-17 龍-generation ancestor (a17). Verify against the book.
    { id: "n9_qilai",  gen: 18, father: "a17", name: "起瀨公", pinyin: "Qilai", gender: "m", relation: "十八世 · 九房 (行居十二，喚細晚)", confidence: "low", note: "起瀾公之兄弟。妣鄭氏。生紹洋、紹湘、紹瀨、紹汜。" },
    { id: "n9_qilai_w", gen: 18, name: "鄭氏", pinyin: "Madam Zheng", gender: "f", spouseOf: "n9_qilai", confidence: "low" },

    { id: "n9_shaoyang", gen: 19, father: "n9_qilai", name: "紹洋公", pinyin: "Shaoyang", gender: "m", relation: "十九世", confidence: "low", note: "妣曾氏。生承楫、承就、承鐵。" },
    { id: "n9_shaoxiang", gen: 19, father: "n9_qilai", name: "紹湘公", pinyin: "Shaoxiang", gender: "m", relation: "十九世", confidence: "low", note: "妻邱氏。生承開、承提。" },
    { id: "n9_shaolai",  gen: 19, father: "n9_qilai", name: "紹瀨公", pinyin: "Shaolai", gender: "m", relation: "十九世", confidence: "low", note: "妻謝氏。生承秀、承住、承彩、承溏。" },
    { id: "n9_shaosi",   gen: 19, father: "n9_qilai", name: "紹汜公", pinyin: "Shaosi", gender: "m", relation: "十九世", confidence: "low", note: "妻李氏。生承晃、承敬。" },

    // 紹洋 line
    { id: "n9_chengji",  gen: 20, father: "n9_shaoyang", name: "承楫", pinyin: "Cheng Ji", gender: "m", relation: "二十世", confidence: "low", note: "妻袁氏。" },
    { id: "n9_chengjiu", gen: 20, father: "n9_shaoyang", name: "承就", pinyin: "Cheng Jiu", gender: "m", relation: "二十世", confidence: "low" },
    { id: "n9_chengtie", gen: 20, father: "n9_shaoyang", name: "承鐵", pinyin: "Cheng Tie", gender: "m", relation: "二十世", confidence: "low", note: "妻卓氏。" },
    { id: "n9_dahong",   gen: 21, father: "n9_chengji", name: "大鴻", pinyin: "Da Hong", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n9_daju",     gen: 21, father: "n9_chengji", name: "大巨", pinyin: "Da Ju", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n9_ya4",      gen: 21, father: "n9_chengji", name: "亞四", pinyin: "Ya Si", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n9_ya5",      gen: 21, father: "n9_chengji", name: "亞五", pinyin: "Ya Wu", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n9_dasheng",  gen: 21, father: "n9_chengji", name: "大升", pinyin: "Da Sheng", gender: "m", relation: "二十一世", confidence: "low", note: "妻羅氏。（房序待考）" },
    { id: "n9_dahai",    gen: 21, father: "n9_chengji", name: "大海", pinyin: "Da Hai", gender: "m", relation: "二十一世", confidence: "low", note: "妻羅氏。（房序待考）" },
    { id: "n9_shifu",    gen: 22, father: "n9_dahong", name: "士福", pinyin: "Shi Fu", gender: "m", relation: "二十二世", confidence: "low" },
    { id: "n9_dahongB",  gen: 21, father: "n9_chengjiu", name: "大宏", pinyin: "Da Hong", gender: "m", relation: "二十一世", confidence: "low", note: "妻劉氏。" },
    { id: "n9_dajin",    gen: 21, father: "n9_chengjiu", name: "大晉", pinyin: "Da Jin", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n9_xiangjiao", gen: 22, father: "n9_dahongB", name: "祥嬌", pinyin: "Xiang Jiao", gender: "f", relation: "二十二世", confidence: "low" },
    { id: "n9_dafu",     gen: 21, father: "n9_chengtie", name: "大馥", pinyin: "Da Fu", gender: "m", relation: "二十一世", confidence: "low", note: "妻李氏。" },

    // 紹湘 line
    { id: "n9_chengkai", gen: 20, father: "n9_shaoxiang", name: "承開", pinyin: "Cheng Kai", gender: "m", relation: "二十世", confidence: "low" },
    { id: "n9_chengti",  gen: 20, father: "n9_shaoxiang", name: "承提", pinyin: "Cheng Ti", gender: "m", relation: "二十世", confidence: "low", note: "妻鄧氏。" },
    { id: "n9_dachi",    gen: 21, father: "n9_chengkai", name: "大池", pinyin: "Da Chi", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n9_yafa",     gen: 22, father: "n9_dachi", name: "亞發", pinyin: "Ya Fa", gender: "m", relation: "二十二世", confidence: "low" },
    { id: "n9_yangjie",  gen: 21, father: "n9_chengti", name: "楊姐", pinyin: "Yang Jie", gender: "f", relation: "二十一世", confidence: "low" },

    // 紹瀨 line
    { id: "n9_chengxiu", gen: 20, father: "n9_shaolai", name: "承秀", pinyin: "Cheng Xiu", gender: "m", relation: "二十世", confidence: "low" },
    { id: "n9_chengzhu", gen: 20, father: "n9_shaolai", name: "承住", pinyin: "Cheng Zhu", gender: "m", relation: "二十世", confidence: "low", note: "妻何氏。" },
    { id: "n9_chengcai", gen: 20, father: "n9_shaolai", name: "承彩", pinyin: "Cheng Cai", gender: "m", relation: "二十世", confidence: "low", note: "妻戴氏。" },
    { id: "n9_chengtang", gen: 20, father: "n9_shaolai", name: "承溏", pinyin: "Cheng Tang", gender: "m", relation: "二十世", confidence: "low", note: "妻鄒氏。" },
    { id: "n9_zhaoshou", gen: 21, father: "n9_chengxiu", name: "照壽", pinyin: "Zhao Shou", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n9_dashou",   gen: 21, father: "n9_chengxiu", name: "大壽", pinyin: "Da Shou", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n9_daguan",   gen: 21, father: "n9_chengxiu", name: "大官", pinyin: "Da Guan", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n9_daji",     gen: 21, father: "n9_chengxiu", name: "大集", pinyin: "Da Ji", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n9_dadan",    gen: 21, father: "n9_chengzhu", name: "大旦", pinyin: "Da Dan", gender: "m", relation: "二十一世", confidence: "low", note: "或作大昌，待考。" },
    { id: "n9_guanfu",   gen: 21, father: "n9_chengcai", name: "官福", pinyin: "Guan Fu", gender: "m", relation: "二十一世", confidence: "low", note: "妻曾氏。" },
    { id: "n9_dayou",    gen: 21, father: "n9_chengtang", name: "大猷", pinyin: "Da You", gender: "m", relation: "二十一世", confidence: "low", note: "妻李氏。" },
    { id: "n9_yunxiu",   gen: 21, father: "n9_chengtang", name: "運秀", pinyin: "Yun Xiu", gender: "m", relation: "二十一世", confidence: "low" },

    // 紹汜 line
    { id: "n9_chenghuang", gen: 20, father: "n9_shaosi", name: "承晃", pinyin: "Cheng Huang", gender: "m", relation: "二十世", confidence: "low" },
    { id: "n9_chengjing",  gen: 20, father: "n9_shaosi", name: "承敬", pinyin: "Cheng Jing", gender: "m", relation: "二十世", confidence: "low" },
    { id: "n9_daxiang",  gen: 21, father: "n9_chenghuang", name: "大香", pinyin: "Da Xiang", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n9_yasan",    gen: 21, father: "n9_chenghuang", name: "亞三", pinyin: "Ya San", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n9_daheng",   gen: 21, father: "n9_chenghuang", name: "大亨", pinyin: "Da Heng", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n9_dagui",    gen: 21, father: "n9_chengjing", name: "大貴", pinyin: "Da Gui", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n9_dagen",    gen: 21, father: "n9_chengjing", name: "大根", pinyin: "Da Gen", gender: "m", relation: "二十一世", confidence: "low" }
  ],

  // --- ERAS / SWIM LANES ----------------------------------------------------
  // Each band groups consecutive generations by WHERE they lived and WHEN.
  // Dates are approximate (the deep generations are undated); edit freely.
  eras: [
    { fromGen: 1,  toGen: 3,  place: "上杭 三坪鄉（福建汀州）", placeEn: "Shanghang, Fujian",
      era: "宋末–元（約1200s–1300s）", eraEn: "Song–Yuan (c. 1200s–1300s)", color: "#b0883322",
      note: "始祖 江八郎 由寧化石壁遷此開基。" },
    { fromGen: 4,  toGen: 6,  place: "永定 烏坭坪（溪南里）", placeEn: "Yongding, Fujian",
      era: "元–明（約1300s–1500s）", eraEn: "Yuan–Ming (c. 1300s–1500s)", color: "#2d6b4f1c",
      note: "桂花樹下；六九郎(貴七)一系。" },
    { fromGen: 7,  toGen: 10, place: "惠州 永安・海豐", placeEn: "Yong'an & Haifeng, Huizhou",
      era: "明（約1500s–1600s）", eraEn: "Ming (c. 1500s–1600s)", color: "#3d6b8e1c",
      note: "下義約、蛋家田、羊屎坑等。" },
    { fromGen: 11, toGen: 19, place: "永安 → 長樂 遷徙（李朗支於此分出）", placeEn: "Yong'an → Changle (Lilang branch diverged)",
      era: "明末–清（約1600s–1700s）", eraEn: "late Ming–Qing (c. 1600s–1700s)", color: "#7a4fa31c",
      note: "約1569年遷長樂；朝湧／朝鴻一支遷新安李朗（今深圳）—— 旁支。" },
    { fromGen: 20, toGen: 22, place: "長樂 彰村・元坑（今五華）", placeEn: "Changle: Changcun (now Wuhua)",
      era: "清（約1700s–1800s）", eraEn: "Qing (c. 1700s–1800s)", color: "#9e2b251c",
      note: "紹泗 → 承續 → 大信；巴色會入信。" },
    { fromGen: 23, toGen: 26, place: "長樂 → 沙巴（古達・山打根・吧巴）", placeEn: "Changle → Sabah (Kudat · Sandakan · Papar)",
      era: "清末–民國（約1860s–1940s）", eraEn: "late Qing–Republic (c. 1860s–1940s)", color: "#2d6b4f26",
      note: "巴色會客家信徒移民英屬北婆羅洲。" }
  ]
};
