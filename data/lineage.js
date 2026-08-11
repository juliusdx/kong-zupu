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
 *   The generation CHARACTERS are firm; some individual gen-13 names are still
 *   placeholders (each generation had many brothers) and carry confidence:"low".
 *
 * GENERATION NUMBERING (corrected 2026-08, from the pt2 scans themselves)
 *   The book labels its own 世 on the biographical pages, and they run continuously:
 *     16 朝纓(字成祥, p19) → 17 龍躍 / 龍見(p20, p27) → 18 起瀾(p59) → 19 紹泗 (起瀾之四房, p59)
 *     → 20 承續(p66) → 21 大信 → 22 永宏/永仁/永宗 → 23 俊 → 24 其/有 → 25 漢
 *   This matches the pt1 master chart columns (十八世 通…, 十九世 紹…, 廿世 承…, 廿一世 大信,
 *   廿二世 永…, 廿三世 俊…) exactly. An earlier reading of p66 as "二十一世祖承續公" (it is
 *   二十世祖) created a phantom ±1 "1825 合譜 seam" at 起瀾→紹泗; that seam did not exist and
 *   the whole direct line from 紹泗 down has been shifted one generation up to close it.
 *
 * Data shape matches /supabase/schema.sql so this can be swapped for a live DB.
 */

// ==========================================
// 李朗 (Shenzhen Lilang) Branch
// Branch tracing from Gen 16: 朝陽 (Chao Yang)
// ==========================================
const ll_chaoyang = [
  { id: "ll_a16", gen: 16, father: "a15_riming", name: "朝陽", pinyin: "Chaoyang", gender: "m", birthPlace: "p_yongan", residencePlace: "p_lilang", note: "叔九公. 生于惠州永安下義龍舟寨 自康熙年間 始來新安李朗. 偕祖妣文太李氏開基五業. Often misread as 朝鴻 or 朝湧.", confidence: "med" },
  { id: "ll_a16_w1", gen: 16, name: "溫氏", pinyin: "Madam Wen", gender: "f", spouseOf: "ll_a16", note: "壬戌生", confidence: "low" },
  
  // Gen 17
  { id: "ll_17_1", gen: 17, father: "ll_a16", name: "龍球", pinyin: "Longqiu", gender: "m", relation: "長房", confidence: "low" },
  { id: "ll_17_1w", gen: 17, name: "袁氏", pinyin: "Madam Yuan", gender: "f", spouseOf: "ll_17_1", confidence: "low" },
  { id: "ll_17_2", gen: 17, father: "ll_a16", name: "龍雲", pinyin: "Longyun", gender: "m", relation: "二房", confidence: "low" },
  { id: "ll_17_2w", gen: 17, name: "張氏", pinyin: "Madam Zhang", gender: "f", spouseOf: "ll_17_2", confidence: "low" },
  { id: "ll_17_3", gen: 17, father: "ll_a16", name: "龍振", pinyin: "Longzhen", gender: "m", relation: "三房", confidence: "low" },
  { id: "ll_17_4", gen: 17, father: "ll_a16", name: "龍彩", pinyin: "Longcai", gender: "m", relation: "四房", confidence: "low" },
  { id: "ll_17_4w", gen: 17, name: "張氏", pinyin: "Madam Zhang", gender: "f", spouseOf: "ll_17_4", confidence: "low" },

  // Gen 18 (龍球's sons)
  { id: "ll_18_q1", gen: 18, father: "ll_17_1", name: "起漢", pinyin: "Qihan", gender: "m", confidence: "low" },
  { id: "ll_18_q1w", gen: 18, name: "邱氏", pinyin: "Madam Qiu", gender: "f", spouseOf: "ll_18_q1", confidence: "low" },
  { id: "ll_18_q2", gen: 18, father: "ll_17_1", name: "起清", pinyin: "Qiqing", gender: "m", confidence: "low" },

  // Gen 18 (龍雲's sons)
  { id: "ll_18_y1", gen: 18, father: "ll_17_2", name: "起滄", pinyin: "Qicang", gender: "m", confidence: "low" },
  { id: "ll_18_y1w", gen: 18, name: "凌氏", pinyin: "Madam Ling", gender: "f", spouseOf: "ll_18_y1", confidence: "low" },
  { id: "ll_18_y2", gen: 18, father: "ll_17_2", name: "起泮", pinyin: "Qipan", gender: "m", confidence: "low" },
  { id: "ll_18_y2w", gen: 18, name: "陳氏", pinyin: "Madam Chen", gender: "f", spouseOf: "ll_18_y2", confidence: "low" },

  // Gen 18 (龍彩's sons)
  { id: "ll_18_c1", gen: 18, father: "ll_17_4", name: "起煥", pinyin: "Qihuan", gender: "m", confidence: "low" },
  { id: "ll_18_c2", gen: 18, father: "ll_17_4", name: "起通", pinyin: "Qitong", gender: "m", confidence: "low" },
  { id: "ll_18_c2w", gen: 18, name: "陳氏", pinyin: "Madam Chen", gender: "f", spouseOf: "ll_18_c2", confidence: "low" },

  // Gen 19 (起漢's sons)
  { id: "ll_19_qh1", gen: 19, father: "ll_18_q1", name: "紹富", pinyin: "Shaofu", gender: "m", confidence: "low" },
  { id: "ll_19_qh1w", gen: 19, name: "張氏", pinyin: "Madam Zhang", gender: "f", spouseOf: "ll_19_qh1", confidence: "low" },
  { id: "ll_19_qh2", gen: 19, father: "ll_18_q1", name: "紹貴", pinyin: "Shaogui", gender: "m", confidence: "low" },
  { id: "ll_19_qh3", gen: 19, father: "ll_18_q1", name: "紹廷", pinyin: "Shaoting", gender: "m", confidence: "low" },
  { id: "ll_19_qh3w", gen: 19, name: "陳氏", pinyin: "Madam Chen", gender: "f", spouseOf: "ll_19_qh3", confidence: "low" },

  // Gen 19 (起滄's sons)
  { id: "ll_19_yc1", gen: 19, father: "ll_18_y1", name: "紹基", pinyin: "Shaoji", gender: "m", confidence: "low" },
  { id: "ll_19_yc1w", gen: 19, name: "宋氏", pinyin: "Madam Song", gender: "f", spouseOf: "ll_19_yc1", confidence: "low" },
  { id: "ll_19_yc2", gen: 19, father: "ll_18_y1", name: "紹寬", pinyin: "Shaokuan", gender: "m", confidence: "low" },
  { id: "ll_19_yc2w", gen: 19, name: "張氏", pinyin: "Madam Zhang", gender: "f", spouseOf: "ll_19_yc2", confidence: "low" },

  // Gen 19 (起泮's sons)
  { id: "ll_19_yp1", gen: 19, father: "ll_18_y2", name: "紹禮", pinyin: "Shaoli", gender: "m", confidence: "low" },
  { id: "ll_19_yp1w", gen: 19, name: "古氏", pinyin: "Madam Gu", gender: "f", spouseOf: "ll_19_yp1", confidence: "low" },
  { id: "ll_19_yp2", gen: 19, father: "ll_18_y2", name: "紹智", pinyin: "Shaozhi", gender: "m", confidence: "low" },
  { id: "ll_19_yp3", gen: 19, father: "ll_18_y2", name: "紹信", pinyin: "Shaoxin", gender: "m", confidence: "low" },

  // Gen 19 (起通's sons)
  { id: "ll_19_ct1", gen: 19, father: "ll_18_c2", name: "紹現", pinyin: "Shaoxian", gender: "m", confidence: "low" },
  { id: "ll_19_ct2", gen: 19, father: "ll_18_c2", name: "紹珍", pinyin: "Shaozhen", gender: "m", confidence: "low" },
  { id: "ll_19_ct2w", gen: 19, name: "溫氏", pinyin: "Madam Wen", gender: "f", spouseOf: "ll_19_ct2", confidence: "low" },
  { id: "ll_19_ct3", gen: 19, father: "ll_18_c2", name: "紹璔", pinyin: "Shaozeng", gender: "m", note: "國學名耀宗號榮祖. 此公子孫有奉耶穌教者 (Descendants include Christians).", confidence: "low" },
  { id: "ll_19_ct3w1", gen: 19, name: "鄭氏", pinyin: "Madam Zheng", gender: "f", spouseOf: "ll_19_ct3", confidence: "low" },

  // Gen 20 (紹富's sons)
  { id: "ll_20_sf1", gen: 20, father: "ll_19_qh1", name: "承文", pinyin: "Chengwen", gender: "m", confidence: "low" },
  { id: "ll_20_sf1w", gen: 20, name: "陳氏", pinyin: "Madam Chen", gender: "f", spouseOf: "ll_20_sf1", confidence: "low" },
  { id: "ll_20_sf2", gen: 20, father: "ll_19_qh1", name: "承行", pinyin: "Chengxing", gender: "m", confidence: "low" },
  { id: "ll_20_sf3", gen: 20, father: "ll_19_qh1", name: "承忠", pinyin: "Chengzhong", gender: "m", confidence: "low" },
  { id: "ll_20_sf4", gen: 20, father: "ll_19_qh1", name: "承信", pinyin: "Chengxin", gender: "m", confidence: "low" },
  { id: "ll_20_sf4w1", gen: 20, name: "羅氏", pinyin: "Madam Luo", gender: "f", spouseOf: "ll_20_sf4", confidence: "low" },
  { id: "ll_20_sf4w2", gen: 20, name: "廖氏", pinyin: "Madam Liao", gender: "f", spouseOf: "ll_20_sf4", confidence: "low" },

  // Gen 20 (紹廷's sons)
  { id: "ll_20_st1", gen: 20, father: "ll_19_qh3", name: "承元", pinyin: "Chengyuan", gender: "m", confidence: "low" },
  { id: "ll_20_st1w", gen: 20, name: "張氏", pinyin: "Madam Zhang", gender: "f", spouseOf: "ll_20_st1", confidence: "low" },
  { id: "ll_20_st2", gen: 20, father: "ll_19_qh3", name: "承亨", pinyin: "Chengheng", gender: "m", confidence: "low" },
  { id: "ll_20_st2w", gen: 20, name: "黃氏", pinyin: "Madam Huang", gender: "f", spouseOf: "ll_20_st2", confidence: "low" },
  { id: "ll_20_st3", gen: 20, father: "ll_19_qh3", name: "承端", pinyin: "Chengduan", gender: "m", confidence: "low" },
  { id: "ll_20_st4", gen: 20, father: "ll_19_qh3", name: "承綉", pinyin: "Chengxiu", gender: "m", confidence: "low" },

  // Gen 20 (紹基's sons)
  { id: "ll_20_sj1", gen: 20, father: "ll_19_yc1", name: "承堯", pinyin: "Chengyao", gender: "m", confidence: "low" },
  { id: "ll_20_sj1w", gen: 20, name: "溫氏", pinyin: "Madam Wen", gender: "f", spouseOf: "ll_20_sj1", confidence: "low" },
  { id: "ll_20_sj2", gen: 20, father: "ll_19_yc1", name: "承舜", pinyin: "Chengshun", gender: "m", note: "早逝", confidence: "low" },

  // Gen 20 (紹寬's sons)
  { id: "ll_20_sk1", gen: 20, father: "ll_19_yc2", name: "承浚", pinyin: "Chengjun", gender: "m", confidence: "low" },
  { id: "ll_20_sk1w", gen: 20, name: "劉氏", pinyin: "Madam Liu", gender: "f", spouseOf: "ll_20_sk1", confidence: "low" },
  { id: "ll_20_sk2", gen: 20, father: "ll_19_yc2", name: "承寵", pinyin: "Chengchong", gender: "m", confidence: "low" },
  { id: "ll_20_sk2w", gen: 20, name: "鄧氏", pinyin: "Madam Deng", gender: "f", spouseOf: "ll_20_sk2", confidence: "low" },
  { id: "ll_20_sk3", gen: 20, father: "ll_19_yc2", name: "承恩", pinyin: "Chengen", gender: "m", confidence: "low" },
  { id: "ll_20_sk3w", gen: 20, name: "陳氏", pinyin: "Madam Chen", gender: "f", spouseOf: "ll_20_sk3", confidence: "low" },
  { id: "ll_20_sk4", gen: 20, father: "ll_19_yc2", name: "承添", pinyin: "Chengtian", gender: "m", confidence: "low" },

  // Gen 20 (紹禮's sons)
  { id: "ll_20_sl1", gen: 20, father: "ll_19_yp1", name: "承煒", pinyin: "Chengwei", gender: "m", confidence: "low" },
  { id: "ll_20_sl2", gen: 20, father: "ll_19_yp1", name: "承裕", pinyin: "Chengyu", gender: "m", confidence: "low" },
  { id: "ll_20_sl2w", gen: 20, name: "黎氏", pinyin: "Madam Li", gender: "f", spouseOf: "ll_20_sl2", confidence: "low" },
  { id: "ll_20_sl3", gen: 20, father: "ll_19_yp1", name: "承聰", pinyin: "Chengcong", gender: "m", confidence: "low" },
  { id: "ll_20_sl3w", gen: 20, name: "鄧氏", pinyin: "Madam Deng", gender: "f", spouseOf: "ll_20_sl3", confidence: "low" },

  // Gen 20 (紹珍's sons)
  { id: "ll_20_sz1", gen: 20, father: "ll_19_ct2", name: "承東", pinyin: "Chengdong", gender: "m", confidence: "low" },
  { id: "ll_20_sz1w", gen: 20, name: "徐氏", pinyin: "Madam Xu", gender: "f", spouseOf: "ll_20_sz1", confidence: "low" },
  { id: "ll_20_sz2", gen: 20, father: "ll_19_ct2", name: "承謙", pinyin: "Chengqian", gender: "m", confidence: "low" },

  // Gen 20 (紹璔's sons)
  { id: "ll_20_szeng1", gen: 20, father: "ll_19_ct3", name: "承發", pinyin: "Chengfa", gender: "m", confidence: "low" },
  { id: "ll_20_szeng1w1", gen: 20, name: "劉氏", pinyin: "Madam Liu", gender: "f", spouseOf: "ll_20_szeng1", confidence: "low" },
  { id: "ll_20_szeng1w2", gen: 20, name: "曾氏", pinyin: "Madam Zeng", gender: "f", spouseOf: "ll_20_szeng1", confidence: "low" },
  { id: "ll_20_szeng2", gen: 20, father: "ll_19_ct3", name: "承波", pinyin: "Chengbo", gender: "m", confidence: "low" },
  { id: "ll_20_szeng2w", gen: 20, name: "凌氏", pinyin: "Madam Ling", gender: "f", spouseOf: "ll_20_szeng2", confidence: "low" },
  { id: "ll_20_szeng3", gen: 20, father: "ll_19_ct3", name: "承協", pinyin: "Chengxie", gender: "m", confidence: "low" },
  { id: "ll_20_szeng3w", gen: 20, name: "吳氏", pinyin: "Madam Wu", gender: "f", spouseOf: "ll_20_szeng3", confidence: "low" },
  { id: "ll_20_szeng4", gen: 20, father: "ll_19_ct3", name: "承晉", pinyin: "Chengjin", gender: "m", confidence: "low" },
  { id: "ll_20_szeng4w1", gen: 20, name: "曾氏", pinyin: "Madam Zeng", gender: "f", spouseOf: "ll_20_szeng4", confidence: "low" },
  { id: "ll_20_szeng4w2", gen: 20, name: "凌氏", pinyin: "Madam Ling", gender: "f", spouseOf: "ll_20_szeng4", confidence: "low" },
  { id: "ll_20_szeng5", gen: 20, father: "ll_19_ct3", name: "承森", pinyin: "Chengsen", gender: "m", relation: "第五房", confidence: "low" },
  { id: "ll_20_szeng5w", gen: 20, name: "鄔氏", pinyin: "Madam Wu", gender: "f", spouseOf: "ll_20_szeng5", confidence: "low" },

  // Gen 21 (承文's sons)
  { id: "ll_21_cw1", gen: 21, father: "ll_20_sf1", name: "士賢", pinyin: "Shixian", gender: "m", relation: "長子", confidence: "low" },
  { id: "ll_21_cw1w", gen: 21, name: "姚氏", pinyin: "Madam Yao", gender: "f", spouseOf: "ll_21_cw1", confidence: "low" },
  { id: "ll_21_cw2", gen: 21, father: "ll_20_sf1", name: "亞二", pinyin: "Ya'er", gender: "m", relation: "次子", note: "早喪", confidence: "low" },
  { id: "ll_21_cw3", gen: 21, father: "ll_20_sf1", name: "士和", pinyin: "Shihe", gender: "m", relation: "三子", confidence: "low" },
  { id: "ll_21_cw3w", gen: 21, name: "溫氏", pinyin: "Madam Wen", gender: "f", spouseOf: "ll_21_cw3", confidence: "low" },
  { id: "ll_21_cw4", gen: 21, father: "ll_20_sf1", name: "士業", pinyin: "Shiye", gender: "m", relation: "四子", confidence: "low" },
  { id: "ll_21_cw4w", gen: 21, name: "劉氏", pinyin: "Madam Liu", gender: "f", spouseOf: "ll_21_cw4", confidence: "low" },
  { id: "ll_21_cw5", gen: 21, father: "ll_20_sf1", name: "士釗", pinyin: "Shizhao", gender: "m", relation: "五子", confidence: "low" },
  { id: "ll_21_cw5w", gen: 21, name: "劉氏", pinyin: "Madam Liu", gender: "f", spouseOf: "ll_21_cw5", note: "早喪無嗣妻適人", confidence: "low" },
  { id: "ll_21_cw6", gen: 21, father: "ll_20_sf1", name: "士欽", pinyin: "Shiqin", gender: "m", relation: "六子", confidence: "low" },
  { id: "ll_21_cw6w", gen: 21, name: "梁氏", pinyin: "Madam Liang", gender: "f", spouseOf: "ll_21_cw6", note: "早喪無嗣妻適人", confidence: "low" },
  { id: "ll_21_cw7", gen: 21, father: "ll_20_sf1", name: "士粦", pinyin: "Shilin", gender: "m", relation: "七子", confidence: "low" },
  { id: "ll_21_cw7w", gen: 21, name: "葉氏", pinyin: "Madam Ye", gender: "f", spouseOf: "ll_21_cw7", note: "往金山無回妻適人", confidence: "low" },

  // Gen 21 (承信's sons)
  { id: "ll_21_cx1", gen: 21, father: "ll_20_sf4", name: "士才", pinyin: "Shicai", gender: "m", confidence: "low" },
  { id: "ll_21_cx2", gen: 21, father: "ll_20_sf4", name: "士發", pinyin: "Shifa", gender: "m", confidence: "low" },

  // Gen 21 (承元's sons)
  { id: "ll_21_cy1", gen: 21, father: "ll_20_st1", name: "士昌", pinyin: "Shichang", gender: "m", confidence: "low" },
  { id: "ll_21_cy2", gen: 21, father: "ll_20_st1", name: "士成", pinyin: "Shicheng", gender: "m", confidence: "low" },

  // Gen 21 (承亨's sons)
  { id: "ll_21_ch1", gen: 21, father: "ll_20_st2", name: "士成", pinyin: "Shicheng", gender: "m", note: "Name duplicated with cousin", confidence: "low" },
  { id: "ll_21_ch2", gen: 21, father: "ll_20_st2", name: "士哥", pinyin: "Shige", gender: "m", confidence: "low" },

  // Gen 21 (承堯's sons)
  { id: "ll_21_cyo1", gen: 21, father: "ll_20_sj1", name: "士楷", pinyin: "Shikai", gender: "m", confidence: "low" },
  { id: "ll_21_cyo1w", gen: 21, name: "黃氏", pinyin: "Madam Huang", gender: "f", spouseOf: "ll_21_cyo1", confidence: "low" },
  { id: "ll_21_cyo2", gen: 21, father: "ll_20_sj1", name: "士模", pinyin: "Shimo", gender: "m", confidence: "low" },
  { id: "ll_21_cyo2w", gen: 21, name: "曾氏", pinyin: "Madam Zeng", gender: "f", spouseOf: "ll_21_cyo2", confidence: "low" },

  // Gen 21 (承浚's sons)
  { id: "ll_21_cj1", gen: 21, father: "ll_20_sk1", name: "亞運", pinyin: "Yayun", gender: "m", confidence: "low" },

  // Gen 21 (承寵's sons)
  { id: "ll_21_cc1", gen: 21, father: "ll_20_sk2", name: "家小", pinyin: "Jiaxiao", gender: "m", confidence: "low" },

  // Gen 21 (承恩's sons)
  { id: "ll_21_ce1", gen: 21, father: "ll_20_sk3", name: "木秀", pinyin: "Muxiu", gender: "m", confidence: "low" },

  // Gen 21 (承裕's sons)
  { id: "ll_21_cyu1", gen: 21, father: "ll_20_sl2", name: "士僯", pinyin: "Shilin", gender: "m", confidence: "low" },
  { id: "ll_21_cyu1w", gen: 21, name: "李氏", pinyin: "Madam Li", gender: "f", spouseOf: "ll_21_cyu1", confidence: "low" },

  // Gen 21 (承聰's sons)
  { id: "ll_21_cco1", gen: 21, father: "ll_20_sl3", name: "士元", pinyin: "Shiyuan", gender: "m", confidence: "low" },

  // Gen 21 (承東's sons)
  { id: "ll_21_cd1", gen: 21, father: "ll_20_sz1", name: "士錦", pinyin: "Shijin", gender: "m", confidence: "low" },
  { id: "ll_21_cd1w", gen: 21, name: "黃氏", pinyin: "Madam Huang", gender: "f", spouseOf: "ll_21_cd1", note: "通人 (remarried?)", confidence: "low" },
  { id: "ll_21_cd2", gen: 21, father: "ll_20_sz1", name: "士鈺", pinyin: "Shiyu", gender: "m", confidence: "low" },
  { id: "ll_21_cd2w", gen: 21, name: "劉氏", pinyin: "Madam Liu", gender: "f", spouseOf: "ll_21_cd2", confidence: "low" },
  { id: "ll_21_cd3", gen: 21, father: "ll_20_sz1", name: "士鈞", pinyin: "Shijun", gender: "m", confidence: "low" },
  { id: "ll_21_cd3w", gen: 21, name: "洪氏", pinyin: "Madam Hong", gender: "f", spouseOf: "ll_21_cd3", confidence: "low" },

  // Gen 21 (承發's sons)
  { id: "ll_21_cfa1", gen: 21, father: "ll_20_szeng1", name: "士茂", pinyin: "Shimao", gender: "m", note: "無嗣", confidence: "low" },
  { id: "ll_21_cfa1w", gen: 21, name: "葉氏", pinyin: "Madam Ye", gender: "f", spouseOf: "ll_21_cfa1", note: "適人 (remarried)", confidence: "low" },
  { id: "ll_21_cfa2", gen: 21, father: "ll_20_szeng1", name: "士盛", pinyin: "Shisheng", gender: "m", confidence: "low" },
  { id: "ll_21_cfa2w1", gen: 21, name: "彭氏", pinyin: "Madam Peng", gender: "f", spouseOf: "ll_21_cfa2", note: "早喪", confidence: "low" },
  { id: "ll_21_cfa2w2", gen: 21, name: "張氏", pinyin: "Madam Zhang", gender: "f", spouseOf: "ll_21_cfa2", confidence: "low" },

  // Gen 21 (承波's sons)
  { id: "ll_21_cbo1", gen: 21, father: "ll_20_szeng2", name: "士榮", pinyin: "Shirong", gender: "m", confidence: "low" },
  { id: "ll_21_cbo1w", gen: 21, name: "葉氏", pinyin: "Madam Ye", gender: "f", spouseOf: "ll_21_cbo1", confidence: "low" },
  { id: "ll_21_cbo2", gen: 21, father: "ll_20_szeng2", name: "天佑", pinyin: "Tianyou", gender: "m", confidence: "low" },
  { id: "ll_21_cbo2w", gen: 21, name: "陳氏", pinyin: "Madam Chen", gender: "f", spouseOf: "ll_21_cbo2", confidence: "low" },

  // Gen 21 (承協's sons)
  { id: "ll_21_cxi1", gen: 21, father: "ll_20_szeng3", name: "士芳", pinyin: "Shifang", gender: "m", confidence: "low" },
  { id: "ll_21_cxi1w", gen: 21, name: "張氏", pinyin: "Madam Zhang", gender: "f", spouseOf: "ll_21_cxi1", confidence: "low" },
  { id: "ll_21_cxi2", gen: 21, father: "ll_20_szeng3", name: "士芬", pinyin: "Shifen", gender: "m", note: "早喪為虎所害", confidence: "low" },
  { id: "ll_21_cxi3", gen: 21, father: "ll_20_szeng3", name: "士芹", pinyin: "Shiqin", gender: "m", confidence: "low" },
  { id: "ll_21_cxi3w", gen: 21, name: "沈氏", pinyin: "Madam Shen", gender: "f", spouseOf: "ll_21_cxi3", confidence: "low" },

  // Gen 21 (承晉's sons)
  { id: "ll_21_cji1", gen: 21, father: "ll_20_szeng4", name: "天福", pinyin: "Tianfu", gender: "m", confidence: "low" },

  // Gen 21 (承森's sons)
  { id: "ll_21_cse1", gen: 21, father: "ll_20_szeng5", name: "成保", pinyin: "Chengbao", gender: "m", confidence: "low" },

  // Gen 22 (士賢's sons)
  { id: "ll_22_sx1", gen: 22, father: "ll_21_cw1", name: "國恭", pinyin: "Guogong", gender: "m", confidence: "low" },
  { id: "ll_22_sx1w", gen: 22, name: "陳氏", pinyin: "Madam Chen", gender: "f", spouseOf: "ll_22_sx1", confidence: "low" },
  { id: "ll_22_sx2", gen: 22, father: "ll_21_cw1", name: "榮瑞", pinyin: "Rongrui", gender: "m", confidence: "low" },

  // Gen 22 (士楷's sons)
  { id: "ll_22_sk1", gen: 22, father: "ll_21_cyo1", name: "國興", pinyin: "Guoxing", gender: "m", confidence: "low" },
  { id: "ll_22_sk2", gen: 22, father: "ll_21_cyo1", name: "國麟", pinyin: "Guolin", gender: "m", confidence: "low" },
  { id: "ll_22_sk3", gen: 22, father: "ll_21_cyo1", name: "國鳳", pinyin: "Guofeng", gender: "m", confidence: "low" },

  // Gen 22 (士模's sons)
  { id: "ll_22_sm1", gen: 22, father: "ll_21_cyo2", name: "國富", pinyin: "Guofu", gender: "m", confidence: "low" },

  // Gen 22 (士榮's sons)
  { id: "ll_22_sr1", gen: 22, father: "ll_21_cbo1", name: "恩賜", pinyin: "Enci", gender: "m", confidence: "low" },

  // Gen 22 (天佑's sons)
  { id: "ll_22_ty1", gen: 22, father: "ll_21_cbo2", name: "國安", pinyin: "Guoan", gender: "m", confidence: "low" },

  // Gen 22 (士芳's sons)
  { id: "ll_22_sf1", gen: 22, father: "ll_21_cxi1", name: "國君", pinyin: "Guojun", gender: "m", confidence: "low" },

  // Gen 23 (國恭's sons)
  { id: "ll_23_gg1", gen: 23, father: "ll_22_sx1", name: "亞二", pinyin: "Ya'er", gender: "m", note: "早喪", confidence: "low" },
];


// ==========================================
// Sabah Branch — DECEASED ANCHORS ONLY (public tier)
// ------------------------------------------------------------------
// The ~62 LIVING members of this branch have been MOVED OUT of this public
// seed into Supabase (member tier, RLS-gated) — see supabase/seed_living_members.sql.
// Rationale: data/lineage.js ships to GitHub Pages and is world-readable, so it must
// hold only PUBLIC (deceased) people. Living relatives are gated to signed-in members.
// Only the deceased ancestors that ANCHOR the tree stay here; their living descendants
// re-attach by id once a signed-in member's session loads the Supabase rows.
// ⚠ 永宏 root + the Yu Chong line still flagged confidence:"low" — family to verify.
// ⚠ NAME CLASH: this root is written 永宏, the same name as the book's 永宏 (k_yonghong, gen 22).
//   They are almost certainly NOT the same man — book 永宏's grandson 其昌 was born 1913, the
//   same years as Yu Chong (1912), which puts Yu Chong in the 其/有 generation (24) and this
//   root one above it (23, the 俊 generation). Until the family confirms the graft point, the
//   two 永宏 stay separate and this branch hangs as its own root.
// Generations here were shifted −1 with the rest of the file (see GENERATION NUMBERING above);
// the living members in Supabase (seed_living_members.sql) were shifted to match.
// Recently-deceased kept public per the family privacy model (deceased = public):
//   Clare(2006), John(1995), Daniel — move any to 'member' if you prefer.
// ==========================================
const mh_sabah = [
  { id: "mh_yonghong", gen: 23, name: "永宏 Kong", pinyin: "Yong Hong", gender: "m", deceased: true, relation: "MyHeritage 樹根", note: "Source-tree root (永宏 Kong, deceased). ⚠ Reconcile with book 永宏 k_yonghong — likely a later/different 永宏; graft point onto the k_daxin spine to be confirmed.", confidence: "low" },
  { id: "mh_enzhao", gen: 23, name: "En Zhao Kong", pinyin: "En Zhao", gender: "f", spouseOf: "mh_yonghong", deceased: true, note: "Married in; née Lei (born Lei) → 雷氏?", confidence: "low" },
  { id: "mh_yezhun", gen: 23, name: "Ye Zhun Chong", pinyin: "Ye Zhun", gender: "m", deceased: true, relation: "親家 (in-law)", note: "Father of Choon Kiaw (mh_choonkiaw), who married into the Kong line. Surname Chong — not Kong blood. Own flagged root.", confidence: "low" },
  { id: "mh_choikiaw_c", gen: 23, name: "Choi Kiaw Chong", pinyin: "Choi Kiaw", gender: "f", spouseOf: "mh_yezhun", deceased: true, note: "Mother of Choon Kiaw; née Shim (born Shim).", confidence: "low" },
  { id: "mh_yuchong", gen: 24, father: "mh_yonghong", name: "Yu Chong Kong", pinyin: "Yu Chong", gender: "m", birthYear: "1912", deathYear: "1974", relation: "main line", confidence: "low" },
  { id: "mh_choonkiaw", gen: 24, name: "Choon Kiaw Kong", pinyin: "Choon Kiaw", gender: "f", spouseOf: "mh_yuchong", birthYear: "1913", deathYear: "1989", note: "Married in; née Chong (born Chong). Parents: 父 Ye Zhun Chong (mh_yezhun), 母 Choi Kiaw Chong née Shim (mh_choikiaw_c).", confidence: "low" },
  { id: "mh_zhunfah", gen: 24, father: "mh_yonghong", name: "Zhun Fah Kong", pinyin: "Zhun Fah", gender: "m", relation: "Yu Chong 之兄弟", confidence: "low" },
  { id: "mh_lofong", gen: 24, name: "Lo Fong Kong", pinyin: "Lo Fong", gender: "f", spouseOf: "mh_zhunfah", deceased: true, note: "Married in; née Chin (born Chin).", confidence: "low" },
  { id: "mh_clare", gen: 25, father: "mh_yuchong", name: "Clare Lai", pinyin: "Clare", gender: "f", birthYear: "1939", deathYear: "2006", marriedOut: "嫁 Lai", note: "Née Kong Siew Ching (born Kong Siew Ching). Married Roland Lai.", confidence: "low" },
  { id: "mh_roland_lai", gen: 25, name: "Roland Lai Lip Chung", pinyin: "Roland Lai", gender: "m", spouseOf: "mh_clare", birthYear: "1938", deceased: true, note: "Married in (Lai family).", confidence: "low" },
  { id: "mh_john", gen: 25, father: "mh_yuchong", name: "John Ful Chung Kong", pinyin: "John", gender: "m", birthYear: "1947", deathYear: "1995", confidence: "low" },
  { id: "mh_daniel", gen: 25, father: "mh_yuchong", name: "Daniel Kong", pinyin: "Daniel", gender: "m", birthYear: "1952", deceased: true, confidence: "low" },
  { id: "mh_unknown1", gen: 25, father: "mh_yuchong", name: "Unknown Kong", pinyin: "Unknown", gender: "m", deceased: true, note: "名/性別待考 — unnamed child on source tree.", confidence: "low" },
  { id: "mh_unknown2", gen: 25, father: "mh_yuchong", name: "Unknown Kong", pinyin: "Unknown", gender: "m", deceased: true, note: "名/性別待考 — unnamed child on source tree.", confidence: "low" },
];


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
      { gen: 16, char: "朝",    pinyin: "Chao",     note: "朝纓 字成祥 (直系) · 朝陽 → 李朗(Shenzhen) branch" },
      { gen: 17, char: "龍",    pinyin: "Long",     note: "龍躍 (庠生, 禮名運洲, 九大房) / 龍見 (叔祖, 三房)" },
      { gen: 18, char: "起",    pinyin: "Qi",       note: "起瀾公 庠名東洋 (五大房) · 起章七房 / 起清八房 / 起瀨九房" },
      { gen: 19, char: "紹",    pinyin: "Shao",     note: "紹泗 / 紹淮 / 紹淡 …" },
      { gen: 20, char: "承",    pinyin: "Cheng",    note: "承續 / 承緒 / 承業" },
      { gen: 21, char: "大",    pinyin: "Da",       note: "大信 / 大忠" },
      { gen: 22, char: "永",    pinyin: "Yong",     note: "永宏 / 永仁 / 永宗" },
      { gen: 23, char: "俊 / 耀", pinyin: "Jun / Yao", note: "milk-name 俊 pairs with formal 集" },
      { gen: 24, char: "其 / 道", pinyin: "Qi / Dao",  note: "milk-name 其 pairs with formal 有" },
      { gen: 25, char: "漢",    pinyin: "Han" }
    ]
  },

  // --- PLACES ---------------------------------------------------------------
  places: [
    // origins & ancestral seats
    { id: "p_ninghua",   type: "origin", name: "寧化石壁",            nameEn: "Ninghua Shibi, Fujian — Hakka dispersal point", modern: "福建三明寧化縣石壁鎮", lat: 26.3620, lng: 116.5500, approximate: false, confidence: "med", note: "始祖 八郎 migrated FROM here to 上杭. 客家祖地 / 公祠 at Shibi village, ~22km west of Ninghua town." },
    { id: "p_shanghang", type: "origin", name: "上杭 三坪鄉",          nameEn: "Sanping, Shanghang, Fujian", modern: "福建龍岩上杭縣 (三坪為村級)", lat: 25.0497, lng: 116.4204, approximate: true,  confidence: "low", note: "始祖 八郎 opened the estate (開基). Gen 1–3 buried here. Coord is the Shanghang county seat — 三坪鄉 is a village within it, exact site to verify." },
    { id: "p_yongding",  type: "origin", name: "永定 溪南里 烏坭坪",    nameEn: "Wunipping, Xinan, Yongding, Fujian", modern: "福建龍岩永定區 (溪南/下洋一帶)", lat: 24.6300, lng: 116.8300, approximate: true,  confidence: "low", note: "'桂花樹下' — gens 4–5+ born/buried; 賴氏(貴七公妻) buried here. 溪南里 is SE Yongding (下洋/湖坑) — village-level, verify." },
    { id: "p_zhangzhou", type: "residence", name: "汀州府",            nameEn: "Tingzhou (Changting), Fujian", modern: "福建龍岩長汀縣", lat: 25.8333, lng: 116.3600, approximate: false, confidence: "high", note: "原居 汀州府 before移 to Guangdong. 汀州府治 = today's Changting county seat (note: id slug reads p_zhangzhou but this is 汀州/長汀, not 漳州)." },
    // Guangdong stops
    { id: "p_yongan",    type: "residence", name: "惠州府 永安縣",      nameEn: "Yong'an (today Zijin), Heyuan, Guangdong", modern: "廣東河源紫金縣", lat: 23.6353, lng: 115.1830, approximate: false, confidence: "high", note: "下義約; gens 8–10 born/buried (蛋家田, 羊屎坑). 永安縣 renamed 紫金縣 in 1914; coord is the Zijin county seat." },
    { id: "p_haifeng",   type: "grave",   name: "海豐縣",              nameEn: "Haifeng, Shanwei, Guangdong", modern: "廣東汕尾海豐縣", lat: 22.9667, lng: 115.3300, approximate: false, confidence: "high", note: "Gen 9 六郎公 & others buried here (海陽/海豐). Coord is the Haifeng county seat (海城鎮)." },
    { id: "p_changle",   type: "origin",  name: "長樂 (今五華縣)",      nameEn: "Changle (now Wuhua), Meizhou, Guangdong", modern: "廣東梅州五華縣", lat: 23.9240, lng: 115.7780, approximate: false, confidence: "high", note: "彰村 / 元坑 / 雙頭. Sabah branch's home county. 長樂縣 renamed 五華縣 in 1914; coord is the county seat (水寨鎮)." },
    { id: "p_zhangkeng", type: "residence", name: "東莞 樟坑徑",        nameEn: "Zhangkengjing (Dongguan/Shenzhen border)", modern: "廣東深圳龍華區觀瀾樟坑徑", lat: 22.7300, lng: 114.0500, approximate: true,  confidence: "low", note: "Some gen-24 births '在東莞樟坑徑 / 長山口'. 樟坑徑 community in Guanlan/Longhua, Shenzhen — neighborhood estimate." },
    { id: "p_lilang",    type: "residence", name: "新安 李朗",           nameEn: "Lilang, Xin'an (Shenzhen)", modern: "廣東深圳龍崗區布吉/坂田", lat: 22.628, lng: 114.130, approximate: false, note: "ll_* branch settlement. Origin of the Basel missionaries." },
    { id: "p_zengcheng", type: "residence", name: "增城 / 廣府",         nameEn: "Zengcheng / Guangzhou", modern: "廣東廣州增城區", lat: 23.2906, lng: 113.8106, approximate: false, confidence: "high", note: "元珊/元珠 branch migrated here. Coord is the Zengcheng district seat (荔城街道)." },
    // graves of the direct upper line
    { id: "p_lilan",     type: "grave",   name: "浬蘭 石角 / 李蘭 花瓶嘴", nameEn: "Lilan Shijiao / Huapingzui (burial)", lat: 23.90, lng: 115.80, approximate: true,  note: "紹泗公 (gen 20) buried 石角; wife 鄭氏 & 承緒 buried 花瓶嘴. Near 長樂 — verify.", confidence: "low" },
    { id: "p_dakeng",    type: "grave",     name: "大坑 圍背黃泥夾",       nameEn: "Dakeng (Weibei Huangnijia)", lat: 22.62, lng: 114.13, approximate: true, note: "Grave of 起瀾公." },
    { id: "p_dalong",    type: "grave",     name: "大隆",                 nameEn: "Dalong", lat: 22.62, lng: 114.13, approximate: true, note: "Grave of 承業." },
    { id: "p_dahu",      type: "grave",   name: "大湖公嶺 聖會墳場",     nameEn: "Dahu Gongling — Basel Mission cemetery", lat: 23.90, lng: 115.80, approximate: true,  note: "承續公 & 梁氏(望福), buried at the 陰城 church ground. Exact plot to verify.", confidence: "low" },
    { id: "p_shuangtou", type: "church_grave", name: "雙頭聖教堂 / 大徑陰城", nameEn: "Shuangtou Holy Church / Dajing", lat: 23.91, lng: 115.82, approximate: true, note: "永宏 first buried here, later moved.", confidence: "low" },
    { id: "p_yincheng",  type: "church_grave", name: "陰城 教會墳場 (彰村)", nameEn: "Yincheng church cemetery, Changcun", lat: 23.92, lng: 115.79, approximate: true, note: "Several gen-23/24 members: '教會陰城立有石灰坟石碑記'.", confidence: "low" },
    // ancestral halls (祠堂)
    { id: "p_hall_prov", type: "hall",    name: "省城 江氏書室 (長興里)", nameEn: "Jiang clan hall/study, Guangzhou (Changxingli)", lat: 23.117, lng: 113.259, approximate: true, note: "'在省城長興里江氏書室有正碑位'. Couplets recorded in the book.", confidence: "low" },
    { id: "p_hall_yd",   type: "hall",    name: "永定 祖堂",            nameEn: "Yongding ancestral hall", lat: 24.720, lng: 116.730, approximate: true, note: "'永定祖堂對聯' recorded in the book.", confidence: "low" },
    // diaspora — Sabah
    { id: "p_kudat",     type: "diaspora", name: "古達",               nameEn: "Kudat, Sabah, Malaysia", lat: 6.883, lng: 116.848, approximate: false, note: "'古達聖會義學堂' — Basel Mission Hakka settlement." },
    { id: "p_sandakan",  type: "diaspora", name: "山打根",             nameEn: "Sandakan, Sabah, Malaysia", lat: 5.840, lng: 118.118, approximate: false, note: "Gen-24/25 births & church." },
    { id: "p_papar",     type: "diaspora", name: "吧巴 / 巴色堆山邑",    nameEn: "Papar, Sabah, Malaysia", lat: 5.7333, lng: 115.9333, approximate: false,  note: "Later-generation births. Coord is Papar town centre.", confidence: "med" },
    { id: "p_lianzhou",  type: "residence", name: "連州",              nameEn: "Lianzhou, Guangdong", modern: "廣東清遠連州市", lat: 24.7800, lng: 112.3800, approximate: false, confidence: "high", note: "原籍連州 recorded for 有喬 (其昌). Coord is the Lianzhou city seat (連州鎮)." }
  ],

  // --- PERSONS --------------------------------------------------------------
  persons: [
    ...ll_chaoyang,
    ...mh_sabah,

    // ===== DEEP ANCESTRY (Gen 1–12) — pt1 pp.18–27 =====
    { id: "a01",  gen: 1, name: "江八郎", pinyin: "Baliang", style: "字文明", gender: "m", relation: "始祖 Founding ancestor", birthPlace: "p_ninghua", residencePlace: "p_shanghang", bio: "由寧化石壁移來上杭三坪鄉開基五業。所生三大房：長萬里、次萬戴、三萬頃。", confidence: "med" },
    { id: "a01w", gen: 1, name: "張一娘", pinyin: "Madam Zhang", gender: "f", spouseOf: "a01", burialPlace: "p_shanghang", note: "合塋福建上杭三坪鄉.", confidence: "med" },

    { id: "a02b", gen: 2, father: "a01", name: "江萬里", pinyin: "Wanli", style: "諱億 號古山", gender: "m", relation: "伯祖 (granduncle)", bio: "官授錦衣衛指揮使，亦授禮部尚書。(book links the line to the Song 江萬里 lineage)", confidence: "low" },
    { id: "a02c", gen: 2, father: "a01", name: "江萬戴", pinyin: "Wandai", style: "諱臨 號古心 益國公", gender: "m", relation: "伯祖 (granduncle)", bio: "登咸淳進士，端宗朝尚書、丞相，追封大傅益國公。(= the historical 江萬里 / 江萬載, claimed ancestor)", confidence: "low" },
    { id: "a02",  gen: 2, father: "a01", name: "江萬頃", pinyin: "Wanqing", style: "十二郎 名伯古崖", gender: "m", relation: "二世祖 (direct line)", spousePlace: "p_shanghang", bio: "宋朝明經鄉舉，授翰林院中書、戶部左侍郎、知南劍州。", confidence: "med" },
    { id: "a02w", gen: 2, name: "錢氏九娘", pinyin: "Madam Qian", gender: "f", spouseOf: "a02", burialPlace: "p_shanghang", note: "合塋上杭三坪鄉.", confidence: "low" },

    { id: "a01w2", gen: 1, name: "邱氏", pinyin: "Madam Qiu", gender: "f", spouseOf: "a01", note: "生錩 (待考).", confidence: "low" },
    { id: "a02b_w", gen: 2, name: "白氏", pinyin: "Madam Bai", gender: "f", spouseOf: "a02b", note: "封為一品夫人.", confidence: "low" },
    { id: "a02b_c1", gen: 3, father: "a02b", name: "錫", pinyin: "Xi", gender: "m", relation: "長子", confidence: "low" },
    { id: "a02b_c2", gen: 3, father: "a02b", name: "鑄", pinyin: "Zhu", gender: "m", relation: "次子", confidence: "low" },
    { id: "a02b_c3", gen: 3, father: "a02b", name: "鏜", pinyin: "Tang", gender: "m", relation: "三子", confidence: "low" },
    { id: "a02c_w", gen: 2, name: "張氏", pinyin: "Madam Zhang", gender: "f", spouseOf: "a02c", confidence: "low" },
    { id: "a02c_c1", gen: 3, father: "a02c", name: "鑰", pinyin: "Yue", gender: "m", relation: "長子", confidence: "low" },
    { id: "a02c_c2", gen: 3, father: "a02c", name: "鉦", pinyin: "Zheng", gender: "m", relation: "次子", confidence: "low" },
    { id: "a03", gen: 3, father: "a02", name: "念三郎", pinyin: "Niansanlang", gender: "m", relation: "三世祖 (direct line)", confidence: "med" },
    { id: "a03b", gen: 3, father: "a02", name: "念一郎", pinyin: "Nianyilang", gender: "m", relation: "三世", confidence: "low" },
    { id: "a03c", gen: 3, father: "a02", name: "念二郎", pinyin: "Nian'erlang", gender: "m", relation: "三世 (二叔祖)", confidence: "low" },
    { id: "a03c_w", gen: 3, name: "薛氏", pinyin: "Madam Xue", gender: "f", spouseOf: "a03c", confidence: "low" },
    { id: "a03c_c1", gen: 4, father: "a03c", name: "潤新", pinyin: "Runxin", style: "法名三十六郎", gender: "m", relation: "長子", confidence: "low" },
    { id: "a03c_c2", gen: 4, father: "a03c", name: "三千七郎", pinyin: "Sanqianqilang", gender: "m", relation: "次子", confidence: "low" },
    { id: "a03c_c2w", gen: 4, name: "吳氏七娘", pinyin: "Madam Wu", gender: "f", spouseOf: "a03c_c2", confidence: "low" },
    { id: "a03d", gen: 3, father: "a02", name: "念五郎", pinyin: "Nianwulang", gender: "m", relation: "三世", confidence: "low" },


    { id: "a04",  gen: 4, father: "a03", name: "百三郎", pinyin: "Baisanlang", gender: "m", relation: "四世祖 (direct line)", burialPlace: "p_yongding", bio: "雙塋于永定縣溪南里。所生二子：長六九郎(貴七)、次六三郎(貴六)。", note: "Gen-3 link is via the 'five great branches' split (三世分為五大支) — the individual gen-3 ancestor is not separately identified.", confidence: "low" },
    { id: "a04w", gen: 4, name: "徐氏妙祥", pinyin: "Madam Xu", gender: "f", spouseOf: "a04", burialPlace: "p_yongding", confidence: "low" },

    { id: "a04b", gen: 4, father: "a03", name: "百八郎", pinyin: "Baibalang", gender: "m", relation: "伯祖", confidence: "low" },
    { id: "a04b_w", gen: 4, name: "周氏二娘妙蓮", pinyin: "Madam Zhou", gender: "f", spouseOf: "a04b", confidence: "low" },
    { id: "a04b_c1", gen: 5, father: "a04b", name: "魁公", pinyin: "Kui", gender: "m", relation: "長子", confidence: "low" },
    { id: "a04b_c1w", gen: 5, name: "謝氏", pinyin: "Madam Xie", gender: "f", spouseOf: "a04b_c1", confidence: "low" },
    { id: "a04c", gen: 4, father: "a03", name: "四六郎", pinyin: "Siliulang", gender: "m", relation: "叔祖", confidence: "low" },
    { id: "a04c_w", gen: 4, name: "張氏", pinyin: "Madam Zhang", gender: "f", spouseOf: "a04c", confidence: "low" },


    { id: "a05",  gen: 5, father: "a04", name: "六九郎", pinyin: "Liujiulang", style: "諱貴七公", gender: "m", relation: "五世祖", burialPlace: "p_yongding", bio: "塋在福建汀州府永定縣烏坭坪溪南里。所生二子：長千一郎(文通)、次千二郎(斌通)。", note: "新安老族譜舊以賴氏/貴七為始祖；道光五年(1825)合譜接上更早之祖.", confidence: "med" },
    { id: "a05w", gen: 5, name: "賴氏", pinyin: "Madam Lai", gender: "f", spouseOf: "a05", burialPlace: "p_yongding", confidence: "med" },

    { id: "a05b", gen: 5, father: "a04", name: "六三郎", pinyin: "Liusanlang", style: "諱貴六", gender: "m", relation: "叔祖", confidence: "low" },
    { id: "a05b_w1", gen: 5, name: "王氏", pinyin: "Madam Wang", gender: "f", spouseOf: "a05b", confidence: "low" },
    { id: "a05b_w2", gen: 5, name: "賴氏", pinyin: "Madam Lai", gender: "f", spouseOf: "a05b", confidence: "low" },


    { id: "a06",  gen: 6, father: "a05", name: "千一郎", pinyin: "Qianyilang", style: "諱文通", gender: "m", relation: "六世祖", burialPlace: "p_yongding", bio: "葬于永定縣溪南。一房住長樂縣五名赤瀝。", confidence: "med" },
    { id: "a06w", gen: 6, name: "瑪氏", pinyin: "Madam Ma", gender: "f", spouseOf: "a06", confidence: "low" },

    { id: "a06b", gen: 6, father: "a05", name: "千二郎", pinyin: "Qian'erlang", style: "諱斌通", gender: "m", relation: "叔祖", confidence: "low" },
    { id: "a06b_w", gen: 6, name: "鍾氏", pinyin: "Madam Zhong", gender: "f", spouseOf: "a06b", confidence: "low" },


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

    { id: "a12b", gen: 12, father: "a11", name: "元珊公", pinyin: "Yuanshan", gender: "m", relation: "十二世", confidence: "low" },
    { id: "a12c", gen: 12, father: "a11", name: "元玉公", pinyin: "Yuanyu", gender: "m", relation: "十二世", confidence: "low" },
    { id: "a12d", gen: 12, father: "a11", name: "元珍公", pinyin: "Yuanzhen", gender: "m", relation: "十二世", confidence: "low" },


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
    { id: "a15", gen: 15, father: "a14", name: "日輝公", pinyin: "Rihui", gender: "m", relation: "十五世祖 (direct line)", confidence: "med",
      note: "Eldest son of 道通. Chart shows him fathering 朝滔." },
    { id: "a15_riming", gen: 15, father: "a14", name: "日明公", pinyin: "Riming", gender: "m", relation: "十五世", confidence: "med",
      note: "Son of 道通. Father of 朝陽 (Lilang branch ancestor)." },
    { id: "a16", gen: 16, father: "a15", name: "江朝纓公", pinyin: "Chaoying", style: "字 成祥", gender: "m", relation: "十六世祖 (direct line)", confidence: "med",
      aka: "chart reading 朝滔",
      bio: "丁未年十二月廿日辰時生，終于乾隆十二年七月十四日亥時，享壽八十一歲。葬于歸善近塘玩圍，對面河邊土名塘玩埔。妣陳氏，庚申生。所生二大房：長龍躍、次龍見。",
      note: "pt2 p.19 gives his own entry: 十六世祖江公朝纓 字成祥. (pt1's chart was read as 朝滔 — same ancestor, different hand.) p.20 continues straight into his two sons 龍躍 / 龍見." },
    { id: "a16w", gen: 16, name: "陳氏", pinyin: "Madam Chen", gender: "f", spouseOf: "a16", note: "庚申生; 終于乾隆六月大 (pt2 p.19).", confidence: "low" },

    // 十七世 — 朝纓公所生二大房: 長 龍躍 (direct line) / 次 龍見 (叔祖).
    // pt2 p.27 is 龍躍公's own entry; p.20 is 龍見公's. Before 2026-08 this slot held
    // 龍見 as the direct ancestor and had absorbed 龍躍's facts (wife 蕭氏, 九大房, 起瀾).
    { id: "a17", gen: 17, father: "a16", name: "江龍躍公", pinyin: "Longyue", style: "諱義 · 禮名 運洲", gender: "m", relation: "十七世祖 (direct line · 長房)", lifespan: "享壽七十八歲 (aged 78)", confidence: "med",
      bio: "康熙丁亥年(1707)十月廿六日生，終于乾隆四十九年(1784)，享壽七十八歲。公生平修心積善、孝友勤儉，生兒九人，廣栽桃李 — 於李朗設館授徒。長子起瀾公亦進庠。生下九大房。",
      note: "pt2 p.27「十七世祖江龍躍公。庠生。諱義。禮名運洲」— the 庠生 who taught at 李朗 (Lilang). His 九大房 are the numbered houses in pt2 (七房起章、八房起清、九房起瀨…), 起瀾公 being 長子. Identified by 江學禮 Corin, Aug 2026." },
    { id: "a17w", gen: 17, name: "蕭氏", pinyin: "Madam Xiao", gender: "f", spouseOf: "a17", note: "丙戌生，享壽八十二歲 (pt2 p.27).", confidence: "med" },

    { id: "a17b", gen: 17, father: "a16", name: "江龍見公", pinyin: "Longjian", gender: "m", relation: "十七世叔祖 (次房)", lifespan: "享壽九十四歲 (aged 94)", confidence: "med",
      bio: "康熙丁酉五月廿三日生，乾隆庚戌正月初五日終，享壽九十四歲。生三房：起潤、起渭、起溶。",
      note: "pt2 p.20「十七世叔祖龍見公」— 朝纓公's second son, a collateral (叔祖) line, NOT the Sabah ancestor." },
    { id: "a17b_w", gen: 17, name: "林氏", pinyin: "Madam Lin", gender: "f", spouseOf: "a17b", note: "享壽八十七歲 (pt2 p.20).", confidence: "med" },
    { id: "a17b_c1", gen: 18, father: "a17b", name: "起潤公", pinyin: "Qirun", gender: "m", relation: "十八世 (龍見長房)", confidence: "low", note: "妣甘氏，生紹溢 (pt2 p.22)." },
    { id: "a17b_c2", gen: 18, father: "a17b", name: "起渭公", pinyin: "Qiwei", gender: "m", relation: "十八世 (龍見次房)", confidence: "low", note: "Handwriting also readable as 起洲." },
    { id: "a17b_c3", gen: 18, father: "a17b", name: "起溶公", pinyin: "Qirong", gender: "m", relation: "十八世 (龍見三房)", confidence: "low", note: "妣戴氏，生三子 紹濬、紹萬、紹千 (pt2 p.20). Handwriting also readable as 起溢." },
    { id: "a17b_c3w", gen: 18, name: "戴氏", pinyin: "Madam Dai", gender: "f", spouseOf: "a17b_c3", confidence: "low" },

    { id: "a18", gen: 18, father: "a17", name: "江起瀾公", pinyin: "Qilan", style: "庠名 東洋", gender: "m", relation: "十八世祖 (direct line · 龍躍公長子)", burialPlace: "p_dakeng", bio: "公平日博覽群書、廣栽桃李。生於甲辰年五月廿九寅時，卒於乾隆甲午年(1774)。葬大坑圍背黃泥夾，後遷葬。所生五大房：長通漢、次通洋(通澤)、三紹淮、四紹泗、五紹淡。", confidence: "med",
      note: "pt2 p.59「十八世祖江公起瀾。長居。庠名東洋」— eldest of 龍躍公's 九大房, and like his father a 庠生. His 五大房 include 紹泗公, the direct Sabah-line father." },
    { id: "a18w", gen: 18, name: "涂氏", pinyin: "Madam Tu", gender: "f", spouseOf: "a18", confidence: "low", note: "元配; 續妣 何氏." },

    // ===== Gen 19 — 紹泗 (pt2 p.59 & p.66; 起瀾公第四房) =====
    // 起瀾(18) → 紹泗(19) → 承續(20): continuous, and it matches every label the book prints —
    // p.59 heads 起瀾 as 十八世祖 and lists 紹泗 among his 五大房 (the pages call them 十九世),
    // p.66 heads 承續 as 二十世祖. The earlier "1825 合譜 ±1 seam" here came from misreading
    // p.66 as 二十一世祖; it has been removed and the line below renumbered accordingly.
    { id: "a20", gen: 19, father: "a18", name: "江紹泗公", pinyin: "Shaosi", gender: "m", relation: "考祖 (direct father of 承續)", burialPlace: "p_lilan", bio: "起瀾公第四房。生 承續、承緒、承業。墓在浬蘭石角。", confidence: "med", note: "起瀾公第四房 (pt2 p.59). 三兄弟：承續、承緒、承業。" },
    { id: "a20w", gen: 19, name: "鄭氏", pinyin: "Madam Zheng", gender: "f", spouseOf: "a20", burialPlace: "p_lilan", note: "墓在李蘭花瓶嘴.", confidence: "med" },

    // ===== Gen 20 — 承 generation (pt2 pp.66–67) =====
    { id: "k_chengxu", gen: 20, father: "a20", name: "承緒",  pinyin: "Cheng Xu",  gender: "m", relation: "叔祖 (uncle of the line)", burialPlace: "p_lilan", note: "塋在土名 李蘭花瓶嘴.", confidence: "med" },
    { id: "k_chengye", gen: 20, father: "a20", name: "承業",  pinyin: "Cheng Ye",  gender: "m", relation: "叔祖", burialPlace: "p_dalong", note: "塋在土名 大隆.", confidence: "med" },
    { id: "k_chengxu2", gen: 20, father: "a20", name: "承續",  pinyin: "Cheng Xu",  gender: "m", relation: "二十世祖 (direct line)", burialPlace: "p_dahu", confidence: "med" },
    { id: "k_liangshi", gen: 20, name: "梁氏",  pinyin: "Madam Liang", ritualName: "望福", ritualPinyin: "Wangfu", gender: "f", spouseOf: "k_chengxu2", religion: "進巴色耶穌教 (Basel Mission)", birthYear: "壬寅年四月初八", deathYear: "甲子年", lifespan: "享壽八十三歲 (aged 83)", burialPlace: "p_dahu", confidence: "med" },

    // ===== Gen 21 — 大 generation =====
    { id: "k_dazhong", gen: 21, father: "k_chengxu2", name: "大忠",  pinyin: "Da Zhong", gender: "m", relation: "祖伯", note: "早喪 (died young).", confidence: "med" },
    { id: "k_daxin", gen: 21, father: "k_chengxu2", name: "大信",  pinyin: "Da Xin",  ritualName: "樂", gender: "m", relation: "二十一世祖 (direct line)", religion: "進巴色耶穌教 禮名 樂", bio: "公生平雜務農業亦精商務，孝奉祖母，柔得宜和，鄰睦族忠，直待人。", lifespan: "享壽五旬有四歲 (aged 54)", confidence: "med" },
    { id: "k_zhangshi", gen: 21, name: "張氏",  pinyin: "Madam Zhang", ritualName: "来安", ritualPinyin: "Lai'an", gender: "f", spouseOf: "k_daxin", religion: "禮號 来安", bio: "勤儉維家，教子有方，鄰里諸事盡勞而不怨。", lifespan: "享壽七旬八歲 (aged 78)", confidence: "med" },

    // ===== Gen 22 — 永 generation =====
    { id: "k_yazhao", gen: 22, father: "k_daxin", name: "亞招",  pinyin: "Ya Zhao",  gender: "f", marriedOut: "嫁黃沙坑凌屋", confidence: "low" },
    { id: "k_yonghong", gen: 22, father: "k_daxin", name: "永宏",  pinyin: "Yong Hong", ritualName: "昌富", hao: "毅涵", gender: "m", relation: "二十二世 (direct line)", religion: "洗禮名 昌富 號 毅涵", birthYear: "乙巳年二月廿五日", residencePlace: "p_changle", burialPlace: "p_shuangtou", bio: "公平生愛人，教子有方，心為天道流行；在長樂居處二十二年。後缺在雙頭聖教堂葬，大徑陰城有坟碑。", confidence: "med" },
    { id: "k_yongren", gen: 22, father: "k_daxin", name: "永仁",  pinyin: "Yong Ren", ritualName: "昌貴", hao: "任堂", gender: "m", relation: "二十二世叔", religion: "廣東巴色會長樂封為帮教書記職", confidence: "med" },
    { id: "k_yongchong", gen: 22, father: "k_daxin", name: "永宗",  pinyin: "Yong Zong", ritualName: "同發", hao: "鈠通", gender: "m", relation: "二十二世", religion: "洗禮名 同發", aka: "舊錄作 永崇", birthYear: "光緒八年壬午九月廿二日戌時", note: "pt2 p.74「永宗 禮名同發 號鈠通」— earlier read here as 永崇 / 禮名昌發 / 號欽道. 妣〔洲?〕氏，以耀華為子 (adopted 耀華, pt2 p.72).", confidence: "med" },
    { id: "k_changxing", gen: 22, father: "k_daxin", name: "昌興",  pinyin: "Chang Xing", gender: "m", note: "早喪.", confidence: "low" },
    { id: "k_xinjiao", gen: 22, father: "k_daxin", name: "新嬌",  pinyin: "Xin Jiao", gender: "f", confidence: "low" },
    { id: "k_lishi", gen: 22, name: "黎氏",  pinyin: "Madam Li", ritualName: "恩照", ritualPinyin: "Enzhao", gender: "f", spouseOf: "k_yonghong", religion: "禮名 恩照", note: "生下四子四女.", confidence: "med" },
    { id: "k_luoshi", gen: 22, name: "羅氏",  pinyin: "Madam Luo", ritualName: "輝光", ritualPinyin: "Huiguang", gender: "f", spouseOf: "k_yongren", confidence: "med" },
    { id: "k_hongshi", gen: 22, name: "洪氏",  pinyin: "Madam Hong", gender: "f", spouseOf: "k_yongchong", confidence: "low" },

    // ===== Gen 23 — children of 永宏 (俊/集) =====
    { id: "k_junen", gen: 23, father: "k_yonghong", name: "俊恩",  pinyin: "Jun En",  formalName: "集如", gender: "m", relation: "長子", birthYear: "癸酉年十二月初七", religion: "集如 乳名 俊恩", confidence: "med" },
    { id: "k_junhua", gen: 23, father: "k_yonghong", name: "俊華",  pinyin: "Jun Hua", gender: "m", relation: "二子", birthYear: "光緒元年乙亥十一月十三日", birthPlace: "p_changle", confidence: "med" },
    { id: "k_junming", gen: 23, father: "k_yonghong", name: "俊明",  pinyin: "Jun Ming", formalName: "集恩", gender: "m", relation: "三子 (direct line)", birthYear: "光緒三年丁丑十月初十日", religion: "集恩 乳名 俊明", birthPlace: "p_changle", confidence: "med" },
    { id: "k_jungong", gen: 23, father: "k_yonghong", name: "俊恭",  pinyin: "Jun Gong", gender: "m", relation: "四子", birthYear: "光緒十六年庚寅十二月初九日", birthPlace: "p_changle", confidence: "med" },
    { id: "k_wangshi", gen: 23, name: "王氏",  pinyin: "Madam Wang", ritualName: "寵恩", ritualPinyin: "Chong'en", gender: "f", spouseOf: "k_junen", confidence: "low" },
    { id: "k_chenshi", gen: 23, name: "陳氏",  pinyin: "Madam Chen", ritualName: "永貞", ritualPinyin: "Yongzhen", gender: "f", spouseOf: "k_junming", confidence: "med" },

    // ===== Gen 23 — children of 永仁 (耀) =====
    { id: "k_qiongying", gen: 23, father: "k_yongren", name: "瓊英",  pinyin: "Qiong Ying", gender: "f", relation: "長女", birthYear: "同治十年辛未十二月十五日", marriedOut: "出嫁于樟坑徑陳必達", confidence: "low" },
    { id: "k_guien", gen: 23, father: "k_yongren", name: "癸恩",  pinyin: "Gui En", gender: "m", relation: "次子", birthYear: "同治十二年癸酉十一月廿五日", confidence: "low" },
    { id: "k_wushi", gen: 23, name: "吳氏",  pinyin: "Madam Wu", ritualName: "求恩", ritualPinyin: "Qiu'en", gender: "f", spouseOf: "k_guien", confidence: "low" },
    { id: "k_yaoci", gen: 23, father: "k_yongren", name: "耀慈",  pinyin: "Yao Ci",  gender: "m", relation: "三子", birthYear: "光緒二年丙子二月廿一日", birthPlace: "p_changle", confidence: "low" },
    { id: "k_yaoxiang", gen: 23, father: "k_yongren", name: "耀祥",  pinyin: "Yao Xiang", gender: "m", relation: "五子", birthYear: "光緒六年庚辰五月十六日", birthPlace: "p_changle", confidence: "low" },
    { id: "k_yunying", gen: 23, father: "k_yongren", name: "雲英",  pinyin: "Yun Ying", gender: "f", relation: "四女", birthYear: "光緒四年戊寅二月初九日", confidence: "low" },
    { id: "k_yaohua", gen: 23, father: "k_yongren", name: "耀華",  pinyin: "Yao Hua", gender: "m", relation: "六子", note: "過繼永崇 (adopted to 永崇's line).", confidence: "low" },
    { id: "k_fuying", gen: 23, father: "k_yongren", name: "福英",  pinyin: "Fu Ying", gender: "f", relation: "七女", birthYear: "光緒十年甲申十二月十七日", birthPlace: "p_changle", confidence: "low" },
    { id: "k_yaoan", gen: 23, father: "k_yongren", name: "耀安",  pinyin: "Yao An",  gender: "m", relation: "八子", birthYear: "光緒十三年丁亥四月十二日", birthPlace: "p_changle", confidence: "low" },
    { id: "k_qingying", gen: 23, father: "k_yongren", name: "慶英",  pinyin: "Qing Ying", gender: "f", relation: "九女", birthYear: "光緒十五年己丑七月十二日", birthPlace: "p_changle", confidence: "low" },
    { id: "k_yaozhen", gen: 23, father: "k_yongren", name: "耀珍",  pinyin: "Yao Zhen", gender: "m", relation: "十子", birthYear: "光緒十九年癸巳六月二十日", birthPlace: "p_papar", confidence: "low" },

    // ===== Gen 24 — children of 俊明 (其/有) =====
    { id: "k_luoying", gen: 24, father: "k_junming", name: "珞英",  pinyin: "Luo Ying", gender: "f", relation: "長女", birthYear: "光緒二十五年己亥", birthPlace: "p_yongan", note: "生于永安駱坑教堂.", confidence: "low" },
    { id: "k_qizhen", gen: 24, father: "k_junming", name: "其禎",  pinyin: "Qi Zhen", gender: "m", relation: "次子", birthYear: "光緒二十八年壬寅", birthPlace: "p_sandakan", confidence: "low" },
    { id: "k_qixiang", gen: 24, father: "k_junming", name: "其祥",  pinyin: "Qi Xiang", gender: "m", relation: "三子", birthYear: "民國十年辛酉 (1921)", confidence: "low" },
    { id: "k_qichang", gen: 24, father: "k_junming", name: "其昌",  pinyin: "Qi Chang", formalName: "有喬", gender: "m", relation: "四子 (direct line)", birthYear: "民國二年 (1913)", religion: "有喬 乳名 其昌", residencePlace: "p_lianzhou", note: "原籍連州.", confidence: "med" },
    { id: "k_qifang", gen: 24, father: "k_junming", name: "其芳",  pinyin: "Qi Fang", formalName: "有梓", gender: "m", relation: "五子", religion: "有梓 乳名 其芳", confidence: "med" },
    { id: "k_qiqing", gen: 24, father: "k_junming", name: "其清",  pinyin: "Qi Qing", gender: "m", relation: "六子", birthYear: "宣統元年己酉 (1909)", birthPlace: "p_sandakan", confidence: "low" },
    { id: "k_qiyong", gen: 24, father: "k_junming", name: "其永",  pinyin: "Qi Yong", gender: "m", relation: "七子", confidence: "low" },
    { id: "k_daoxi", gen: 24, father: "k_junen", name: "道希",  pinyin: "Dao Xi",  gender: "f", relation: "長女", note: "早喪, 古達.", confidence: "low" },
    { id: "k_liying", gen: 24, father: "k_junen", name: "麗英",  pinyin: "Li Ying", gender: "f", relation: "次女", confidence: "low" },
    { id: "k_daozhen", gen: 24, father: "k_junen", name: "道珍",  pinyin: "Dao Zhen", gender: "m", relation: "三子", birthYear: "光緒廿九年癸卯", birthPlace: "p_kudat", confidence: "low" },
    { id: "k_xuaizhen", gen: 24, name: "徐愛貞",  pinyin: "Xu Aizhen", gender: "f", spouseOf: "k_qichang", note: "民國八年 (1919) 結婚.", confidence: "low" },
    { id: "k_huangciying", gen: 24, name: "黃慈英", pinyin: "Huang Ciying", gender: "f", spouseOf: "k_qifang", confidence: "low" },

    // ===== Gen 25 — 漢 generation =====
    { id: "k_hanqiang", gen: 25, father: "k_qichang", name: "漢強",  pinyin: "Han Qiang", gender: "m", relation: "長子", birthYear: "民國十三年 / 1924", confidence: "low" },
    { id: "k_hanxing", gen: 25, father: "k_qichang", name: "漢興",  pinyin: "Han Xing", gender: "m", relation: "次子", birthYear: "民國十五年 / 1926", confidence: "low" },
    { id: "k_hanying", gen: 25, father: "k_qichang", name: "漢英",  pinyin: "Han Ying", gender: "f", relation: "三女", birthYear: "民國十八年 / 1929", confidence: "low" },
    { id: "k_hanxian", gen: 25, father: "k_qichang", name: "漢賢",  pinyin: "Han Xian", gender: "m", relation: "四子", birthYear: "民國廿三年 / 1934", confidence: "low" },
    { id: "k_ruizhu", gen: 25, father: "k_qichang", name: "瑞珠",  pinyin: "Rui Zhu", gender: "f", relation: "五女", birthYear: "民國廿二年", confidence: "low" },
    { id: "k_hanneng", gen: 25, father: "k_qifang", name: "漢能",  pinyin: "Han Neng", gender: "m", relation: "子", birthYear: "民國廿一年 / 1932", confidence: "low" },
    { id: "k_runzhu", gen: 25, father: "k_qifang", name: "潤珠",  pinyin: "Run Zhu", gender: "f", relation: "女", birthYear: "民國廿三年 / 1934", confidence: "low" },

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
    { id: "n9_dagen",    gen: 21, father: "n9_chengjing", name: "大根", pinyin: "Da Gen", gender: "m", relation: "二十一世", confidence: "low" },

    // ===== COLLATERAL — 八房 起清公 house (pt2 pp.51–53) =====
    // Brother of 起瀾公 & 起瀨公 (sons of gen-17 a17). All confidence low.
    // NOTE: the 承夏/承周/紹潇/承富/大成/大全/承貴/大參/大旭 cluster on pt2 pp.49–50
    // belongs to an earlier house whose divider I haven't re-read yet — deferred to
    // avoid a wrong parent link.
    { id: "n8_qiqing",  gen: 18, father: "a17", name: "起清公", pinyin: "Qiqing", gender: "m", relation: "十八世 · 八房 (行壬)", confidence: "low", note: "妣文氏。生紹顥、紹江、紹澇、紹汪 (pt2 p.51)。" },
    { id: "n8_qiqing_w", gen: 18, name: "文氏", pinyin: "Madam Wen", gender: "f", spouseOf: "n8_qiqing", confidence: "low" },

    { id: "n8_shaoying", gen: 19, father: "n8_qiqing", name: "紹顥公", pinyin: "Shaohao", gender: "m", relation: "十九世 · 八房長子", confidence: "low", note: "妻何氏。生承超、承漢、承招 (pt2 p.51)。舊譜錄作 紹穎。" },
    { id: "n8_shaoying_w", gen: 19, name: "何氏", pinyin: "Madam He", gender: "f", spouseOf: "n8_shaoying", confidence: "low" },
    { id: "n8_shaojiang", gen: 19, father: "n8_qiqing", name: "紹江公", pinyin: "Shaojiang", gender: "m", relation: "十九世", confidence: "low", note: "妻孫氏。生承見、承趫。" },
    { id: "n8_shaolao",  gen: 19, father: "n8_qiqing", name: "紹澇公", pinyin: "Shaolao", gender: "m", relation: "十九世 · 八房三子", confidence: "low", note: "妻卓氏。生承奕 (pt2 p.50)。曾被誤錄為「紹泗」(與直系紹泗混) 及「紹芳」(誤置七房) — 2026-08 合併訂正。" },
    { id: "n8_shaolao_w", gen: 19, name: "卓氏", pinyin: "Madam Zhuo", gender: "f", spouseOf: "n8_shaolao", confidence: "low" },
    { id: "n8_shaowang", gen: 19, father: "n8_qiqing", name: "紹汪公", pinyin: "Shaowang", gender: "m", relation: "十九世", confidence: "low", note: "妻溫氏。生承魁、承滔、承良。" },

    // 紹江 line
    { id: "n8_chengjian", gen: 20, father: "n8_shaojiang", name: "承見", pinyin: "Cheng Jian", gender: "m", relation: "二十世", confidence: "low" },
    { id: "n8_chengqiao", gen: 20, father: "n8_shaojiang", name: "承趫", pinyin: "Cheng Qiao", gender: "m", relation: "二十世", confidence: "low" },

    // 紹澇 line — the only son (pt2 p.50)
    { id: "n8_chengyi",  gen: 20, father: "n8_shaolao", name: "承奕", pinyin: "Cheng Yi", aka: "職員名 潤珠", gender: "m", relation: "二十世", confidence: "low", note: "妻張氏。生大乾。" },
    // 紹顥 line (pt2 p.51)
    { id: "n8_chengchao", gen: 20, father: "n8_shaoying", name: "承超", pinyin: "Cheng Chao", gender: "m", relation: "二十世", confidence: "low" },
    { id: "n8_chenghan", gen: 20, father: "n8_shaoying", name: "承漢", pinyin: "Cheng Han", gender: "m", relation: "二十世", confidence: "low" },
    { id: "n8_chengzhao", gen: 20, father: "n8_shaoying", name: "承招", pinyin: "Cheng Zhao", gender: "m", relation: "二十世", confidence: "low", note: "妻葉氏。生大茂。" },
    { id: "n8_chengyi_w", gen: 20, name: "張氏", pinyin: "Madam Zhang", gender: "f", spouseOf: "n8_chengyi", confidence: "low" },
    { id: "n8_daqian",   gen: 21, father: "n8_chengyi", name: "大乾", pinyin: "Da Qian", gender: "m", relation: "二十一世", confidence: "low", note: "妻廖氏。生永魁、永恭。" },
    { id: "n8_daqian_w", gen: 21, name: "廖氏", pinyin: "Madam Liao", gender: "f", spouseOf: "n8_daqian", confidence: "low" },
    { id: "n8_yongkui",  gen: 22, father: "n8_daqian", name: "永魁", pinyin: "Yong Kui", gender: "m", relation: "二十二世", confidence: "low", note: "妻李氏、妾〇氏。" },
    { id: "n8_yongkui_w1", gen: 22, name: "李氏", pinyin: "Madam Li", gender: "f", spouseOf: "n8_yongkui", confidence: "low" },
    { id: "n8_yonggong", gen: 22, father: "n8_daqian", name: "永恭", pinyin: "Yong Gong", gender: "m", relation: "二十二世", confidence: "low", note: "妻〇氏。" },
    { id: "n8_damao",    gen: 21, father: "n8_chengzhao", name: "大茂", pinyin: "Da Mao", gender: "m", relation: "二十一世", confidence: "low", note: "承招妻葉氏生 (pt2 p.51)。" },
    { id: "n8_chengzhao_w", gen: 20, name: "葉氏", pinyin: "Madam Ye", gender: "f", spouseOf: "n8_chengzhao", confidence: "low" },

    // 紹汪 line
    { id: "n8_chengkui", gen: 20, father: "n8_shaowang", name: "承魁", pinyin: "Cheng Kui", gender: "m", relation: "二十世", confidence: "low" },
    { id: "n8_chengtao", gen: 20, father: "n8_shaowang", name: "承滔", pinyin: "Cheng Tao", gender: "m", relation: "二十世", confidence: "low" },
    { id: "n8_chengliang", gen: 20, father: "n8_shaowang", name: "承良", pinyin: "Cheng Liang", gender: "m", relation: "二十世", confidence: "low", note: "妻傅氏。" },
    { id: "n8_zaogu",    gen: 21, father: "n8_chengliang", name: "灶姑", pinyin: "Zao Gu", gender: "f", relation: "二十一世", confidence: "low" },
    { id: "n8_xiangxin", gen: 21, father: "n8_chengliang", name: "祥新", pinyin: "Xiang Xin", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n8_xiangzhen", gen: 21, father: "n8_chengliang", name: "祥禎", pinyin: "Xiang Zhen", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n8_xiangyong", gen: 21, father: "n8_chengliang", name: "祥永", pinyin: "Xiang Yong", gender: "m", relation: "二十一世", confidence: "low" },

    // ===== 起瀾公 五大房 — 紹泗公's four brothers (pt2 pp.61–66) =====
    // Sons of 起瀾公 (a18); siblings of the direct ancestor 紹泗公 (a20). The pages label
    // them 十九世, which is now exactly where they sit. All confidence low.
    // — 長房 通漢公 —
    { id: "f5_tonghan", gen: 19, father: "a18", name: "通漢公", pinyin: "Tonghan", gender: "m", relation: "十九世 · 長房 (大伯祖)", confidence: "low", note: "妣劉氏。" },
    { id: "f5_chengtong", gen: 20, father: "f5_tonghan", name: "承統公", pinyin: "Cheng Tong", gender: "m", relation: "二十世", confidence: "low", note: "妣李氏。" },
    { id: "f5_dachang", gen: 21, father: "f5_chengtong", name: "大昌公", pinyin: "Da Chang", formalName: "國學名 清輝", gender: "m", relation: "二十一世", confidence: "low", note: "妣張氏。" },
    { id: "f5_dakuan", gen: 21, father: "f5_chengtong", name: "大寬公", pinyin: "Da Kuan", gender: "m", relation: "二十一世", confidence: "low", note: "妣廖氏。" },
    { id: "f5_dazhen", gen: 21, father: "f5_chengtong", name: "大振公", pinyin: "Da Zhen", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "f5_jigong", gen: 22, father: "f5_dachang", name: "集恭", pinyin: "Ji Gong", gender: "m", relation: "二十二世", confidence: "low", note: "妻凌氏。" },
    { id: "f5_yongfa", gen: 22, father: "f5_dakuan", name: "永發", pinyin: "Yong Fa", gender: "m", relation: "二十二世", confidence: "low" },
    { id: "f5_yongji", gen: 22, father: "f5_dakuan", name: "永吉", pinyin: "Yong Ji", gender: "m", relation: "二十二世", confidence: "low", note: "妣曾氏。" },
    { id: "f5_yonghe", gen: 22, father: "f5_dakuan", name: "永合", pinyin: "Yong He", gender: "m", relation: "二十二世", confidence: "low" },
    { id: "f5_yonghui", gen: 22, father: "f5_dakuan", name: "永輝", pinyin: "Yong Hui", gender: "m", relation: "二十二世", confidence: "low" },
    { id: "f5_jizhen", gen: 23, father: "f5_yongji", name: "集珍", pinyin: "Ji Zhen", gender: "m", relation: "二十三世", confidence: "low" },
    // — 次房 通澤公 (一名通洋) —
    { id: "f5_tongze", gen: 19, father: "a18", name: "通澤公", pinyin: "Tongze", aka: "一名 通洋", gender: "m", relation: "十九世 · 次房 (二伯祖)", confidence: "low", note: "妣梁氏。以紹淮公次子承球公為継嗣。" },
    { id: "f5_chengqiu", gen: 20, father: "f5_tongze", name: "承球公", pinyin: "Cheng Qiu", gender: "m", relation: "二十世 (継嗣)", confidence: "low", note: "紹淮公次子，過繼通澤公為嗣。" },
    { id: "f5_daan", gen: 21, father: "f5_chengqiu", name: "大安公", pinyin: "Da An", gender: "m", relation: "二十一世", confidence: "low", note: "妣林氏。" },
    { id: "f5_dachangB", gen: 22, father: "f5_daan", name: "大常公", pinyin: "Da Chang", gender: "m", relation: "二十二世", confidence: "low", note: "妣黃氏。" },
    { id: "f5_yongqing", gen: 22, father: "f5_daan", name: "永清", pinyin: "Yong Qing", gender: "m", relation: "二十二世", confidence: "low", note: "妻劉氏。生光緒十二年秋月。" },
    { id: "f5_yongfeng", gen: 23, father: "f5_dachangB", name: "永鳳", pinyin: "Yong Feng", gender: "m", relation: "二十三世", confidence: "low" },
    { id: "f5_yonghuang", gen: 23, father: "f5_dachangB", name: "永凰", pinyin: "Yong Huang", gender: "m", relation: "二十三世", confidence: "low" },
    // — 三房 紹淮公 —
    { id: "f5_shaohuai", gen: 19, father: "a18", name: "紹淮公", pinyin: "Shaohuai", gender: "m", relation: "十九世 · 三房 (三伯祖)", confidence: "low", note: "妣曾氏。生承基、承球(過繼通澤)、承謀、承訓。" },
    { id: "f5_chengji", gen: 20, father: "f5_shaohuai", name: "承基", pinyin: "Cheng Ji", gender: "m", relation: "二十世", confidence: "low" },
    { id: "f5_chengmou", gen: 20, father: "f5_shaohuai", name: "承謀", pinyin: "Cheng Mou", gender: "m", relation: "二十世", confidence: "low" },
    { id: "f5_chengxun", gen: 20, father: "f5_shaohuai", name: "承訓公", pinyin: "Cheng Xun", gender: "m", relation: "二十世", confidence: "low", note: "妣劉氏。" },
    { id: "f5_dawen", gen: 21, father: "f5_chengxun", name: "大文公", pinyin: "Da Wen", gender: "m", relation: "二十一世", confidence: "low", note: "妣宗氏。" },
    { id: "f5_jinfu", gen: 22, father: "f5_dawen", name: "金福", pinyin: "Jin Fu", gender: "m", relation: "二十二世", confidence: "low" },
    // — 五房 紹淡公 —
    { id: "f5_shaodan", gen: 19, father: "a18", name: "紹淡公", pinyin: "Shaodan", gender: "m", relation: "十九世 · 五房 (五叔祖)", confidence: "low", note: "妣劉氏。" },
    { id: "f5_chengguo", gen: 20, father: "f5_shaodan", name: "承國公", pinyin: "Cheng Guo", gender: "m", relation: "二十世", confidence: "low", note: "妣曾氏。" },
    { id: "f5_dake", gen: 21, father: "f5_chengguo", name: "大可公", pinyin: "Da Ke", gender: "m", relation: "二十一世", confidence: "low", note: "妣張氏。" },
    { id: "f5_yongwei", gen: 22, father: "f5_dake", name: "永威", pinyin: "Yong Wei", gender: "m", relation: "二十二世", confidence: "low", note: "妣張氏。" },
    { id: "f5_yuanfa", gen: 23, father: "f5_yongwei", name: "元發", pinyin: "Yuan Fa", gender: "m", relation: "二十三世", confidence: "low", note: "往金山 (overseas)." },

    // ==========================================
    // 七房 (起章公) - pt2 pp.44-50
    // ==========================================
    { id: "n7_qizhang", gen: 18, father: "a17", name: "起章公", pinyin: "Qizhang", gender: "m", relation: "十八世 · 七房祖", confidence: "low", note: "起瀾公之兄弟（龍躍公九大房之七）。生紹污、紹濂、紹顯、紹门（據世系表與家譜推斷）。舊稿誤將八房之紹澇公抄作「紹芳」列此 — 2026-08 刪除。" },

    { id: "n7_shaowu", gen: 19, father: "n7_qizhang", name: "紹污公", pinyin: "Shaowu", gender: "m", relation: "十九世", confidence: "low", note: "妻陳氏。生承賢、承禎、承猷、承紀、承立、承運。" },
    { id: "n7_shaowu_w", gen: 19, name: "陳氏", pinyin: "Madam Chen", gender: "f", spouseOf: "n7_shaowu", confidence: "low" },
    
    { id: "n7_chengxian", gen: 20, father: "n7_shaowu", name: "承賢公", pinyin: "Chengxian", gender: "m", relation: "二十世", confidence: "low", note: "妻凌氏。生大元、大軒、大蔣。" },
    { id: "n7_chengxian_w", gen: 20, name: "凌氏", pinyin: "Madam Ling", gender: "f", spouseOf: "n7_chengxian", confidence: "low" },
    { id: "n7_dayuan", gen: 21, father: "n7_chengxian", name: "大元", pinyin: "Dayuan", gender: "m", relation: "二十一世", confidence: "low", note: "妻劉氏。生旭新、旭彰。" },
    { id: "n7_dayuan_w", gen: 21, name: "劉氏", pinyin: "Madam Liu", gender: "f", spouseOf: "n7_dayuan", confidence: "low" },
    { id: "n7_xuxin", gen: 22, father: "n7_dayuan", name: "旭新", pinyin: "Xuxin", gender: "m", relation: "二十二世", confidence: "low", note: "妻凌氏。生下雕福。" },
    { id: "n7_xuxin_w", gen: 22, name: "凌氏", pinyin: "Madam Ling", gender: "f", spouseOf: "n7_xuxin", confidence: "low" },
    { id: "n7_diaofu", gen: 23, father: "n7_xuxin", name: "雕福", pinyin: "Diaofu", gender: "m", relation: "二十三世", confidence: "low" },
    { id: "n7_xuzhang", gen: 22, father: "n7_dayuan", name: "旭彰", pinyin: "Xuzhang", gender: "m", relation: "二十二世", confidence: "low" },
    
    { id: "n7_daxuan", gen: 21, father: "n7_chengxian", name: "大軒", pinyin: "Daxuan", gender: "m", relation: "二十一世", confidence: "low", note: "妻俞氏。生旭初。" },
    { id: "n7_daxuan_w", gen: 21, name: "俞氏", pinyin: "Madam Yu", gender: "f", spouseOf: "n7_daxuan", confidence: "low" },
    { id: "n7_xuchu", gen: 22, father: "n7_daxuan", name: "旭初", pinyin: "Xuchu", gender: "m", relation: "二十二世", confidence: "low" },
    
    { id: "n7_dajiang", gen: 21, father: "n7_chengxian", name: "大蔣", pinyin: "Dajiang", gender: "m", relation: "二十一世", confidence: "low", note: "妻廖氏。" },
    { id: "n7_dajiang_w", gen: 21, name: "廖氏", pinyin: "Madam Liao", gender: "f", spouseOf: "n7_dajiang", confidence: "low" },

    { id: "n7_chengzhen", gen: 20, father: "n7_shaowu", name: "承禎公", pinyin: "Chengzhen", formalName: "國學名 澄珠", hao: "號 鑒川", gender: "m", relation: "二十世", confidence: "low", note: "妻廖氏、續伍氏。生大欽。" },
    { id: "n7_chengzhen_w1", gen: 20, name: "廖氏", pinyin: "Madam Liao", gender: "f", spouseOf: "n7_chengzhen", confidence: "low" },
    { id: "n7_chengzhen_w2", gen: 20, name: "伍氏", pinyin: "Madam Wu", gender: "f", spouseOf: "n7_chengzhen", confidence: "low" },
    { id: "n7_daqin", gen: 21, father: "n7_chengzhen", name: "大欽", pinyin: "Daqin", gender: "m", relation: "二十一世", confidence: "low", note: "妻葉氏。生旭謙、旭濂。" },
    { id: "n7_daqin_w", gen: 21, name: "葉氏", pinyin: "Madam Ye", gender: "f", spouseOf: "n7_daqin", confidence: "low" },
    { id: "n7_xuqian", gen: 22, father: "n7_daqin", name: "旭謙", pinyin: "Xuqian", gender: "m", relation: "二十二世", confidence: "low" },
    { id: "n7_xulian", gen: 22, father: "n7_daqin", name: "旭濂", pinyin: "Xulian", gender: "m", relation: "二十二世", confidence: "low" },

    { id: "n7_chengyou", gen: 20, father: "n7_shaowu", name: "承猷公", pinyin: "Chengyou", gender: "m", relation: "二十世", confidence: "low", note: "妻戴氏。生大業、大威、大茂。" },
    { id: "n7_chengyou_w", gen: 20, name: "戴氏", pinyin: "Madam Dai", gender: "f", spouseOf: "n7_chengyou", confidence: "low" },
    { id: "n7_daye", gen: 21, father: "n7_chengyou", name: "大業", pinyin: "Daye", gender: "m", relation: "二十一世", confidence: "low", note: "妻何氏。生旭標、旭煥。" },
    { id: "n7_daye_w", gen: 21, name: "何氏", pinyin: "Madam He", gender: "f", spouseOf: "n7_daye", confidence: "low" },
    { id: "n7_xubiao", gen: 22, father: "n7_daye", name: "旭標", pinyin: "Xubiao", gender: "m", relation: "二十二世", confidence: "low", note: "妻鄭氏。" },
    { id: "n7_xubiao_w", gen: 22, name: "鄭氏", pinyin: "Madam Zheng", gender: "f", spouseOf: "n7_xubiao", confidence: "low" },
    { id: "n7_xuhuan2", gen: 22, father: "n7_daye", name: "旭煥", pinyin: "Xuhuan", gender: "m", relation: "二十二世", confidence: "low" },
    { id: "n7_dawei", gen: 21, father: "n7_chengyou", name: "大威", pinyin: "Dawei", gender: "m", relation: "二十一世", confidence: "low", note: "妻刁氏。" },
    { id: "n7_dawei_w", gen: 21, name: "刁氏", pinyin: "Madam Diao", gender: "f", spouseOf: "n7_dawei", confidence: "low" },
    { id: "n7_damao", gen: 21, father: "n7_chengyou", name: "大茂", pinyin: "Damao", gender: "m", relation: "二十一世", confidence: "low" },

    { id: "n7_chengji", gen: 20, father: "n7_shaowu", name: "承紀公", pinyin: "Chengji", gender: "m", relation: "二十世", confidence: "low", note: "妻廖氏。生大雍、大英。" },
    { id: "n7_chengji_w", gen: 20, name: "廖氏", pinyin: "Madam Liao", gender: "f", spouseOf: "n7_chengji", confidence: "low" },
    { id: "n7_dayong", gen: 21, father: "n7_chengji", name: "大雍", pinyin: "Dayong", gender: "m", relation: "二十一世", confidence: "low", note: "妻葉氏。生旭臨、旭茂。" },
    { id: "n7_dayong_w", gen: 21, name: "葉氏", pinyin: "Madam Ye", gender: "f", spouseOf: "n7_dayong", confidence: "low" },
    { id: "n7_xulin", gen: 22, father: "n7_dayong", name: "旭臨", pinyin: "Xulin", gender: "m", relation: "二十二世", confidence: "low", note: "妻曾氏。" },
    { id: "n7_xulin_w", gen: 22, name: "曾氏", pinyin: "Madam Zeng", gender: "f", spouseOf: "n7_xulin", confidence: "low" },
    { id: "n7_xumao", gen: 22, father: "n7_dayong", name: "旭茂", pinyin: "Xumao", gender: "m", relation: "二十二世", confidence: "low", note: "妻吳氏，早喪。" },
    { id: "n7_xumao_w", gen: 22, name: "吳氏", pinyin: "Madam Wu", gender: "f", spouseOf: "n7_xumao", confidence: "low", note: "早喪" },
    
    { id: "n7_daying", gen: 21, father: "n7_chengji", name: "大英", pinyin: "Daying", gender: "m", relation: "二十一世", confidence: "low", note: "妻萬氏。生水秀、金秀。" },
    { id: "n7_daying_w", gen: 21, name: "萬氏", pinyin: "Madam Wan", gender: "f", spouseOf: "n7_daying", confidence: "low" },
    { id: "n7_shuixiu", gen: 22, father: "n7_daying", name: "水秀", pinyin: "Shuixiu", gender: "m", relation: "二十二世", confidence: "low" },
    { id: "n7_jinxiu", gen: 22, father: "n7_daying", name: "金秀", pinyin: "Jinxiu", gender: "m", relation: "二十二世", confidence: "low" },

    { id: "n7_chengli", gen: 20, father: "n7_shaowu", name: "承立公", pinyin: "Chengli", hao: "號 卓然", gender: "m", relation: "二十世", confidence: "low", note: "妻李氏、續劉氏。生大錦、大釗、大鈺。" },
    { id: "n7_chengli_w1", gen: 20, name: "李氏", pinyin: "Madam Li", gender: "f", spouseOf: "n7_chengli", confidence: "low" },
    { id: "n7_chengli_w2", gen: 20, name: "劉氏", pinyin: "Madam Liu", gender: "f", spouseOf: "n7_chengli", confidence: "low" },
    { id: "n7_dajin", gen: 21, father: "n7_chengli", name: "大錦", pinyin: "Dajin", hao: "號 繡卿", gender: "m", relation: "二十一世", confidence: "low", note: "妻凌氏。生旭亮、旭明、旭熙、旭開。" },
    { id: "n7_dajin_w", gen: 21, name: "凌氏", pinyin: "Madam Ling", gender: "f", spouseOf: "n7_dajin", confidence: "low" },
    { id: "n7_xuliang", gen: 22, father: "n7_dajin", name: "旭亮", pinyin: "Xuliang", gender: "m", relation: "二十二世", confidence: "low", note: "妻張氏。" },
    { id: "n7_xuliang_w", gen: 22, name: "張氏", pinyin: "Madam Zhang", gender: "f", spouseOf: "n7_xuliang", confidence: "low" },
    { id: "n7_xuming", gen: 22, father: "n7_dajin", name: "旭明", pinyin: "Xuming", gender: "m", relation: "二十二世", confidence: "low", note: "妻賴氏。" },
    { id: "n7_xuming_w", gen: 22, name: "賴氏", pinyin: "Madam Lai", gender: "f", spouseOf: "n7_xuming", confidence: "low" },
    { id: "n7_xuxi", gen: 22, father: "n7_dajin", name: "旭熙", pinyin: "Xuxi", gender: "m", relation: "二十二世", confidence: "low", note: "妻劉氏。" },
    { id: "n7_xuxi_w", gen: 22, name: "劉氏", pinyin: "Madam Liu", gender: "f", spouseOf: "n7_xuxi", confidence: "low" },
    { id: "n7_xukai", gen: 22, father: "n7_dajin", name: "旭開", pinyin: "Xukai", gender: "m", relation: "二十二世", confidence: "low" },
    
    { id: "n7_dazhao", gen: 21, father: "n7_chengli", name: "大釗", pinyin: "Dazhao", gender: "m", relation: "二十一世", confidence: "low" },
    { id: "n7_dayu", gen: 21, father: "n7_chengli", name: "大鈺", pinyin: "Dayu", gender: "m", relation: "二十一世", confidence: "low" },

    { id: "n7_chengyun", gen: 20, father: "n7_shaowu", name: "承運公", pinyin: "Chengyun", gender: "m", relation: "二十世", confidence: "low" },
    
    // --- Unclear parentage (p.48) ---
    { id: "n7_chengxia", gen: 20, name: "承夏", pinyin: "Chengxia", gender: "m", relation: "二十世", confidence: "low", note: "（房序待考。見於七房紹濂公之前，父名缺）妻〇氏、妾邱氏。生大来。" },
    { id: "n7_chengxia_w1", gen: 20, name: "〇氏", pinyin: "Madam Unknown", gender: "f", spouseOf: "n7_chengxia", confidence: "low" },
    { id: "n7_chengxia_w2", gen: 20, name: "邱氏", pinyin: "Madam Qiu", gender: "f", spouseOf: "n7_chengxia", confidence: "low", note: "妾" },
    { id: "n7_dalai", gen: 21, father: "n7_chengxia", name: "大来", pinyin: "Dalai", gender: "m", relation: "二十一世", confidence: "low", note: "妻曾氏。" },
    { id: "n7_dalai_w", gen: 21, name: "曾氏", pinyin: "Madam Zeng", gender: "f", spouseOf: "n7_dalai", confidence: "low" },
    
    { id: "n7_chengzhou", gen: 20, name: "承周", pinyin: "Chengzhou", gender: "m", relation: "二十世", confidence: "low", note: "（房序待考。見於七房紹濂公之前，父名缺）妻張氏。生大芳。" },
    { id: "n7_chengzhou_w", gen: 20, name: "張氏", pinyin: "Madam Zhang", gender: "f", spouseOf: "n7_chengzhou", confidence: "low" },
    { id: "n7_dafang", gen: 21, father: "n7_chengzhou", name: "大芳", pinyin: "Dafang", gender: "m", relation: "二十一世", confidence: "low", note: "妻鄭氏。生瑞蘭。" },
    { id: "n7_dafang_w", gen: 21, name: "鄭氏", pinyin: "Madam Zheng", gender: "f", spouseOf: "n7_dafang", confidence: "low" },
    { id: "n7_ruilan", gen: 22, father: "n7_dafang", name: "瑞蘭", pinyin: "Ruilan", gender: "m", relation: "二十二世", confidence: "low", note: "妻張氏。" },
    { id: "n7_ruilan_w", gen: 22, name: "張氏", pinyin: "Madam Zhang", gender: "f", spouseOf: "n7_ruilan", confidence: "low" },

    // --- 紹濂公 branch (p.48-49) ---
    { id: "n7_shaolian", gen: 19, father: "n7_qizhang", name: "紹濂公", pinyin: "Shaolian", gender: "m", relation: "十九世", confidence: "low", note: "妻梁氏。生承富、承貴。" },
    { id: "n7_shaolian_w", gen: 19, name: "梁氏", pinyin: "Madam Liang", gender: "f", spouseOf: "n7_shaolian", confidence: "low" },
    
    { id: "n7_chengfu", gen: 20, father: "n7_shaolian", name: "承富公", pinyin: "Chengfu", gender: "m", relation: "二十世", confidence: "low", note: "妻馮氏。生大成、大全。" },
    { id: "n7_chengfu_w", gen: 20, name: "馮氏", pinyin: "Madam Feng", gender: "f", spouseOf: "n7_chengfu", confidence: "low" },
    
    { id: "n7_dacheng", gen: 21, father: "n7_chengfu", name: "大成", pinyin: "Dacheng", gender: "m", relation: "二十一世", confidence: "low", note: "妻朱氏。生亞夀、亞蓮。" },
    { id: "n7_dacheng_w", gen: 21, name: "朱氏", pinyin: "Madam Zhu", gender: "f", spouseOf: "n7_dacheng", confidence: "low" },
    { id: "n7_yashou", gen: 22, father: "n7_dacheng", name: "亞夀", pinyin: "Yashou", gender: "m", relation: "二十二世", confidence: "low" },
    { id: "n7_yalian", gen: 22, father: "n7_dacheng", name: "亞蓮", pinyin: "Yalian", gender: "m", relation: "二十二世", confidence: "low" },

    { id: "n7_daquan", gen: 21, father: "n7_chengfu", name: "大全", pinyin: "Daquan", gender: "m", relation: "二十一世", confidence: "low", note: "妻李氏。生亞色、色三、亞養、亞卜。" },
    { id: "n7_daquan_w", gen: 21, name: "李氏", pinyin: "Madam Li", gender: "f", spouseOf: "n7_daquan", confidence: "low" },
    { id: "n7_yase", gen: 22, father: "n7_daquan", name: "亞色", pinyin: "Yase", gender: "m", relation: "二十二世", confidence: "low" },
    { id: "n7_sesan", gen: 22, father: "n7_daquan", name: "色三", pinyin: "Sesan", gender: "m", relation: "二十二世", confidence: "low" },
    { id: "n7_yasyang", gen: 22, father: "n7_daquan", name: "亞養", pinyin: "Yayang", gender: "m", relation: "二十二世", confidence: "low" },
    { id: "n7_yabo", gen: 22, father: "n7_daquan", name: "亞卜", pinyin: "Yabo", gender: "m", relation: "二十二世", confidence: "low" },

    { id: "n7_chenggui", gen: 20, father: "n7_shaolian", name: "承貴公", pinyin: "Chenggui", gender: "m", relation: "二十世", confidence: "low", note: "妻劉氏。生大參、大旭。" },
    { id: "n7_chenggui_w", gen: 20, name: "劉氏", pinyin: "Madam Liu", gender: "f", spouseOf: "n7_chenggui", confidence: "low" },
    { id: "n7_dacan", gen: 21, father: "n7_chenggui", name: "大參", pinyin: "Dacan", gender: "m", relation: "二十一世", confidence: "low", note: "妻〇氏、續吳氏。生瑞亭、亞生、亞順。本身並子孫俱奉耶穌教（瑞亭原傳道職也）。" },
    { id: "n7_dacan_w1", gen: 21, name: "〇氏", pinyin: "Madam Unknown", gender: "f", spouseOf: "n7_dacan", confidence: "low" },
    { id: "n7_ruiting", gen: 22, father: "n7_dacan", name: "瑞亭", pinyin: "Ruiting", gender: "m", relation: "二十二世", confidence: "low", note: "大參妻〇氏生。原傳道職也。妻羅氏，生茂仁、道平、榮齊、清和，又生五女。" },
    { id: "n7_ruiting_w", gen: 22, name: "羅氏", pinyin: "Madam Luo", gender: "f", spouseOf: "n7_ruiting", confidence: "low", note: "生茂仁、道平、榮齊、清和，又生五女。" },
    { id: "n7_maoren", gen: 23, father: "n7_ruiting", name: "茂仁", pinyin: "Maoren", gender: "m", relation: "二十三世", confidence: "low" },
    { id: "n7_daoping", gen: 23, father: "n7_ruiting", name: "道平", pinyin: "Daoping", gender: "m", relation: "二十三世", confidence: "low" },
    { id: "n7_rongqi", gen: 23, father: "n7_ruiting", name: "榮齊", pinyin: "Rongqi", gender: "m", relation: "二十三世", confidence: "low" },
    { id: "n7_qinghe", gen: 23, father: "n7_ruiting", name: "清和", pinyin: "Qinghe", gender: "m", relation: "二十三世", confidence: "low" },
    
    { id: "n7_dacan_w2", gen: 21, name: "吳氏", pinyin: "Madam Wu", gender: "f", spouseOf: "n7_dacan", confidence: "low" },
    { id: "n7_yasheng", gen: 22, father: "n7_dacan", name: "亞生", pinyin: "Yasheng", gender: "m", relation: "二十二世", confidence: "low", note: "大參續妻吳氏生。" },
    { id: "n7_yashun", gen: 22, father: "n7_dacan", name: "亞順", pinyin: "Yashun", gender: "m", relation: "二十二世", confidence: "low", note: "大參續妻吳氏生。" },
    
    { id: "n7_daxu", gen: 21, father: "n7_chenggui", name: "大旭", pinyin: "Daxu", gender: "m", relation: "二十一世", confidence: "low" },

    // --- 紹顯公 branch (p.50) ---
    { id: "n7_shaoxian", gen: 19, father: "n7_qizhang", name: "紹顯公", pinyin: "Shaoxian", gender: "m", relation: "十九世", confidence: "low" },
    
    // --- 紹门公 branch (p.50) ---
    { id: "n7_shaomen", gen: 19, father: "n7_qizhang", name: "紹门公", pinyin: "Shaomen", gender: "m", relation: "十九世", confidence: "low", note: "妻張氏。生承冕、承冠。" },
    { id: "n7_shaomen_w", gen: 19, name: "張氏", pinyin: "Madam Zhang", gender: "f", spouseOf: "n7_shaomen", confidence: "low" },
    { id: "n7_chengmian", gen: 20, father: "n7_shaomen", name: "承冕", pinyin: "Chengmian", gender: "m", relation: "二十世", confidence: "low" },
    { id: "n7_chengguan", gen: 20, father: "n7_shaomen", name: "承冠", pinyin: "Chengguan", gender: "m", relation: "二十世", confidence: "low" },

    // --- REMOVED 2026-08: the "紹芳公 → 承奕 → 大乾 → 永魁/永恭" block that used to sit here.
    // It was a duplicate of the SAME people already recorded under 八房 起清公 (n8_shaolao …).
    // pt2 p.50 reads 紹澇公 (妻卓氏 → 承奕, 職員名 潤珠), and p.51 names 起清公's four sons
    // outright: 紹顥、紹江、紹澇、紹汪 — so 紹澇 is 八房's, not 七房's, and "紹芳" was a
    // misreading of the same 紹澇. 七房 起章公's attested sons are 紹污/紹濂/紹顯/紹门.
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
    { fromGen: 11, toGen: 18, place: "永安 → 長樂 遷徙（李朗支於此分出）", placeEn: "Yong'an → Changle (Lilang branch diverged)",
      era: "明末–清（約1600s–1700s）", eraEn: "late Ming–Qing (c. 1600s–1700s)", color: "#7a4fa31c",
      note: "約1569年遷長樂；朝湧／朝鴻一支遷新安李朗（今深圳）—— 旁支。" },
    { fromGen: 19, toGen: 21, place: "長樂 彰村・元坑（今五華）", placeEn: "Changle: Changcun (now Wuhua)",
      era: "清（約1700s–1800s）", eraEn: "Qing (c. 1700s–1800s)", color: "#9e2b251c",
      note: "紹泗 → 承續 → 大信；巴色會入信。" },
    { fromGen: 22, toGen: 27, place: "長樂 → 沙巴（古達・山打根・吧巴）", placeEn: "Changle → Sabah (Kudat · Sandakan · Papar)",
      era: "清末–民國（約1860s–1940s）", eraEn: "late Qing–Republic (c. 1860s–1940s)", color: "#2d6b4f26",
      note: "巴色會客家信徒移民英屬北婆羅洲。" }
  ]
};
