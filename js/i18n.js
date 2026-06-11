/* Bilingual UI (中文 / English). Auto-detects browser language, remembers choice,
 * exposes window.I18N. Genealogical CONTENT (names, bios) is left as-is; this only
 * translates the interface chrome. */
(function () {
  const dict = {
    en: {
      brand_tag: "The Kong Family Zupu · Hakka Christian lineage · 廣東 → 沙巴",
      tab_tree: "族譜 Tree", tab_map: "地圖 Map", tab_contribute: "貢獻 Contribute",
      tab_review: "審核 Review", tab_about: "關於 About",
      search_ph: "Search name / 名…", auth_signin: "Sign in", auth_guest: "Guest",
      auth_signout_confirm: "Sign out?", lang_switch: "中文",

      tt_daughters: "Show daughters & married-in", tt_romanization: "Romanization",
      tt_photos: "Photos",
      tt_expand: "Expand all", tt_fit: "Fit", tt_swim: "Place · era lanes",
      tt_verify: "To verify", vp_title: "⚠ Needs verification",
      vp_none: "Nothing flagged. 🎉",
      vp_hint: "Click a name to jump to it on the tree, then confirm or fix via Contribute.",
      legend_son: "son line", legend_daughter: "daughter",
      legend_spouse: "married-in", legend_low: "needs verification",

      mt_origin: "祖籍 Origin (Fujian/GD)", mt_residence: "遷居 Migration stops",
      mt_grave: "墓 Graves", mt_hall: "祠堂 Ancestral halls",
      mt_church: "教會墳場 Church grounds", mt_diaspora: "沙巴 Diaspora (Sabah)",
      mt_note: "Pins marked “approx.” are town-level — replace with exact GPS via Contribute.",

      c_h: "Add or correct a record",
      c_intro_live: "Every submission goes to the review queue and appears on the tree once an editor approves it.",
      c_intro_demo: "Every submission is reviewed before it appears. No database is connected, so your entry downloads as a JSON file to send to the family keeper.",
      f_action: "What are you doing?",
      f_opt_add_child: "Add a child to someone", f_opt_add_spouse: "Add a spouse",
      f_opt_edit: "Correct / enrich an existing person", f_opt_add_place: "Add / fix a location (祠堂 / grave)",
      f_relatedto: "Relative this connects to", f_section_person: "Person details",
      f_name: "Name 名 (Chinese)", f_pinyin: "Romanization / English",
      f_ritual: "Ritual / baptism name 禮名", f_milk: "Milk name 乳名",
      f_aka: "Other names (字 / 號 / nickname)", f_gender: "Gender",
      f_male: "Male 男", f_female: "Female 女", f_gen: "Generation 世 (number)",
      f_living: "Living?", f_living_yes: "Living", f_living_no: "Deceased",
      f_birth: "Birth date", f_place: "Birth or current place",
      f_bio: "Short write-up / biography 傳記",
      f_section_loc: "Location (for 祠堂 / grave / residence pins)",
      f_placetype: "Place type", pt_hall: "祠堂 Ancestral hall", pt_grave: "墓 Grave",
      pt_church: "教會墳場 Church ground", pt_residence: "遷居 Residence",
      pt_origin: "祖籍 Origin", pt_diaspora: "沙巴 Diaspora",
      f_placename: "Place name (for new locations)", f_lat: "Latitude", f_lng: "Longitude",
      f_photo: "Photo URL or note", f_section_contact: "Contact (private — never shown publicly)",
      f_contributor: "Your name", f_contact: "Your email / phone",
      f_privacy: "<b>Privacy:</b> contact details and info about <i>living</i> people are stored in the private/member tier and are never shown on the public tree. Minors are hidden by default. You can request removal at any time.",
      f_submit_live: "Submit for review", f_submit_demo: "Download submission (demo)",
      f_note_live: "Goes to the moderation queue.",
      f_note_demo: "No database connected yet — saves a JSON file to send to the keeper.",
      f_thanks_live: "謝謝!  Thank you — your submission was received and will appear after review.",
      f_thanks_demo: "謝謝!  Your submission file was downloaded — please send it to the family keeper.",
      f_fail: "Submission failed: ",

      d_generation: "Generation", d_romanization: "Romanization", d_role: "Role",
      d_style: "字/號 Style name", d_ritual: "禮名 Ritual name", d_formal: "名 Formal name",
      d_hao: "號 Style name", d_milk: "乳名 Milk name", d_aka: "別名 Also known as",
      d_gender: "Gender", d_male: "男 Male", d_female: "女 Female",
      d_born: "Born", d_lifespan: "Lifespan", d_faith: "Faith", d_marriedout: "Married out",
      d_birthplace: "Birth place", d_residence: "Residence", d_burial: "Burial",
      d_badge_low: "⚠ needs verification", d_family: "Family", d_father: "Father",
      d_spouseof: "Spouse of", d_spouse: "Spouse", d_children: "Children",
      d_cand_admin: "候選祖先 · Candidate ancestors — click to confirm the direct line",
      d_cand: "候選祖先 · Candidate ancestors (admin can confirm)",
      d_setcorrect: "Set as correct →", d_photos: "相片 · Photos",
      d_addphoto: "＋ Add a photo", d_uploading: "Uploading…", d_pending: "pending review",
      d_maxphotos: "Maximum 5 photos reached.",
      d_approve: "Approve", d_suggest: "Suggest a correction →", d_approx: " (approx.)",
      d_uploadfail: "Upload failed: ",

      pl_modern: "今 Modern", pl_type: "Type", pl_linked: "People here",
      pl_approx_warn: "Approximate location — exact GPS needed",
      pl_verified: "✓ verified location",
      pl_suggest_loc: "📍 Pin the exact location",
      pl_view_map: "View on map →", pl_photos: "Location photos",
      pl_addphoto: "＋ Add a location photo",
      m_details: "Details & photos →",
      pick_hint: "Click the map to place",
      pick_drag: "Drag the pin to fine-tune, then save.",
      pick_save: "Save this location", pick_cancel: "Cancel",
      pick_thanks: "謝謝!  Your suggested location was submitted for review.",
      pick_fail: "Could not submit location: ",

      s_h: "登入 · Sign in",
      s_desc: "Family members sign in to add photos, see living-member details, and contribute. Your email is never shown publicly.",
      s_email: "Email", s_magic: "Email me a magic link", s_or: "or",
      s_google: "Continue with Google", s_enter_email: "Enter your email first.",
      s_sending: "Sending…", s_sent: "✓ Check your inbox for the sign-in link.",
      s_redir: "Redirecting to Google…", s_err: "Error: ",

      a_msg: "⚑ Admin mode — click an ancestor marked ⚑ to confirm its identity.",
      a_download: "Download overrides.js",

      r_h: "審核 · Contribution review", r_adminonly: "Admins only.",
      r_loading: "Loading pending submissions…", r_none: "No pending submissions. 🎉",
      r_pending: " pending.", r_error: "Error: ", r_approve: "Approve", r_reject: "Reject",
      r_failed: "Failed: ",

      ab_h: "關於這個族譜 · About this Zupu",
      ab_p1: "This is a living, crowdsourced 族譜 (<i>zupu</i>) for the <b>江 (Kong / Jiang) family</b>, hall name <b>濟陽 (Jiyang)</b> — a Hakka Christian lineage of the <b>巴色會 (Basel Mission)</b>. It descends from the <b>始祖 江八郎 (字文明)</b>, who moved from <b>寧化石壁</b> (the legendary Hakka dispersal point) to <b>上杭三坪鄉</b> in Fujian and founded the family estate. The book claims descent from the Song-dynasty brothers 江萬里 / 江萬載 (益國公) — a lineage claim worth verifying rather than taking as established fact.",
      ab_p2: "Over the centuries the family migrated 汀州永定 (烏坭坪 桂花樹下) → <b>長樂 (today 五華)</b> around 1569 → 永安 → <b>新安 李朗 (today Shenzhen)</b>; and one line emigrated to British North Borneo — <b>古達 Kudat, 山打根 Sandakan, 吧巴 Papar</b> in Sabah, Malaysia. The seed data is transcribed from the full handwritten <i>Kong Family Book</i> (pt 1 &amp; 2), covering generations 1–26 of the direct line.",
      ab_h_poem: "字輩 · Generational names",
      ab_h_help: "How to help",
      ab_help: "Most early entries are marked <span class=\"badge low\">needs verification</span> — they are best-effort readings of old handwriting. If you recognise an ancestor, can add a photo, fix a date, add your own branch, or pin the exact GPS of a 祠堂 (ancestral hall) or grave, please use the <b>貢獻 Contribute</b> tab. Every change is reviewed before it goes live.",
      ab_h_privacy: "Privacy",
      ab_privacy: "The lineage and ancestral sites are public. Photos and details of <i>living</i> members are shown only to signed-in family. Contact details are private. Minors are hidden by default, and anyone may ask to be removed.",
      ab_h_tech: "Technical",
      ab_tech: "Static site (hostable free on GitHub Pages) + optional Supabase backend for accounts, uploads and moderation. See <code>README.md</code> and <code>supabase/schema.sql</code> in the repository."
    },

    zh: {
      brand_tag: "江氏族譜 · 客家基督徒世系 · 廣東 → 沙巴",
      tab_tree: "族譜", tab_map: "地圖", tab_contribute: "貢獻",
      tab_review: "審核", tab_about: "關於",
      search_ph: "搜尋姓名 / 名…", auth_signin: "登入", auth_guest: "訪客",
      auth_signout_confirm: "登出？", lang_switch: "EN",

      tt_daughters: "顯示女兒及外姓配偶", tt_romanization: "羅馬拼音",
      tt_photos: "相片",
      tt_expand: "全部展開", tt_fit: "置中", tt_swim: "遷徙年代帶（地點・年代）",
      tt_verify: "待考證", vp_title: "⚠ 待考證清單",
      vp_none: "沒有待考證項目。🎉",
      vp_hint: "點選跳至族譜該人，再透過「貢獻」確認或修正。",
      legend_son: "男系", legend_daughter: "女兒",
      legend_spouse: "配偶", legend_low: "待考證",

      mt_origin: "祖籍（閩／粵）", mt_residence: "遷居",
      mt_grave: "墳墓", mt_hall: "祠堂",
      mt_church: "教會墳場", mt_diaspora: "沙巴僑居",
      mt_note: "標示「約」的座標僅到鄉鎮級，請透過「貢獻」提供精確座標。",

      c_h: "新增或修正記錄",
      c_intro_live: "所有提交將進入審核佇列，經編輯核准後顯示於族譜。",
      c_intro_demo: "所有提交經審核後顯示。目前未連接資料庫，您的記錄將下載為 JSON 檔，請寄給族譜管理人。",
      f_action: "您要做什麼？",
      f_opt_add_child: "為某人新增子女", f_opt_add_spouse: "新增配偶",
      f_opt_edit: "修正／補充現有人物", f_opt_add_place: "新增／修正地點（祠堂／墳墓）",
      f_relatedto: "關聯的親屬", f_section_person: "人物資料",
      f_name: "姓名 名（中文）", f_pinyin: "羅馬拼音／英文",
      f_ritual: "禮名／洗禮名", f_milk: "乳名", f_aka: "其他名字（字／號／綽號）", f_gender: "性別",
      f_male: "男", f_female: "女", f_gen: "世代 世（數字）",
      f_living: "在世？", f_living_yes: "在世", f_living_no: "已故",
      f_birth: "出生日期", f_place: "出生或現居地",
      f_bio: "簡介／傳記",
      f_section_loc: "地點（祠堂／墳墓／居所座標）",
      f_placetype: "地點類型", pt_hall: "祠堂", pt_grave: "墳墓",
      pt_church: "教會墳場", pt_residence: "居所",
      pt_origin: "祖籍", pt_diaspora: "僑居（沙巴）",
      f_placename: "地點名稱（新地點）", f_lat: "緯度", f_lng: "經度",
      f_photo: "相片連結或備註", f_section_contact: "聯絡方式（私密 — 不公開顯示）",
      f_contributor: "您的姓名", f_contact: "您的電郵／電話",
      f_privacy: "<b>私隱：</b>聯絡方式及<i>在世</i>者的資料僅存於私密／成員層級，不會顯示於公開族譜。未成年者預設隱藏。您可隨時要求移除。",
      f_submit_live: "提交審核", f_submit_demo: "下載提交（示範）",
      f_note_live: "將進入審核佇列。",
      f_note_demo: "尚未連接資料庫 — 將存成 JSON 檔寄給管理人。",
      f_thanks_live: "謝謝！您的提交已收到，將於審核後顯示。",
      f_thanks_demo: "謝謝！提交檔案已下載，請寄給族譜管理人。",
      f_fail: "提交失敗：",

      d_generation: "世代", d_romanization: "羅馬拼音", d_role: "稱謂",
      d_style: "字／號", d_ritual: "禮名", d_formal: "名",
      d_hao: "號", d_milk: "乳名", d_aka: "別名", d_gender: "性別", d_male: "男", d_female: "女",
      d_born: "生於", d_lifespan: "享壽", d_faith: "信仰", d_marriedout: "外嫁",
      d_birthplace: "出生地", d_residence: "居所", d_burial: "葬於",
      d_badge_low: "⚠ 待考證", d_family: "親屬", d_father: "父",
      d_spouseof: "配偶（夫）", d_spouse: "配偶", d_children: "子女",
      d_cand_admin: "候選祖先 — 點選確認直系",
      d_cand: "候選祖先（管理員可確認）",
      d_setcorrect: "設為正確 →", d_photos: "相片",
      d_addphoto: "＋ 新增相片", d_uploading: "上載中…", d_pending: "待審核",
      d_maxphotos: "已達上限 5 張相片。",
      d_approve: "核准", d_suggest: "建議修正 →", d_approx: "（約）",
      d_uploadfail: "上載失敗：",

      pl_modern: "今地", pl_type: "類型", pl_linked: "相關人物",
      pl_approx_warn: "座標約略 — 待補精確 GPS",
      pl_verified: "✓ 位置已核實",
      pl_suggest_loc: "📍 標出精確位置",
      pl_view_map: "在地圖檢視 →", pl_photos: "地點相片",
      pl_addphoto: "＋ 新增地點相片",
      m_details: "詳情與相片 →",
      pick_hint: "點地圖標出位置：",
      pick_drag: "可拖曳圖釘微調，然後儲存。",
      pick_save: "儲存此位置", pick_cancel: "取消",
      pick_thanks: "謝謝！您建議的位置已提交審核。",
      pick_fail: "提交位置失敗：",

      s_h: "登入",
      s_desc: "家族成員登入後可新增相片、查看在世成員資料並參與貢獻。您的電郵不會公開。",
      s_email: "電郵", s_magic: "寄送登入連結至電郵", s_or: "或",
      s_google: "使用 Google 登入", s_enter_email: "請先輸入電郵。",
      s_sending: "傳送中…", s_sent: "✓ 請查收電郵中的登入連結。",
      s_redir: "轉往 Google…", s_err: "錯誤：",

      a_msg: "⚑ 管理模式 — 點選標示 ⚑ 的祖先以確認身分。",
      a_download: "下載 overrides.js",

      r_h: "審核 · 提交審核", r_adminonly: "僅限管理員。",
      r_loading: "載入待審提交…", r_none: "沒有待審提交。🎉",
      r_pending: " 件待審。", r_error: "錯誤：", r_approve: "核准", r_reject: "拒絕",
      r_failed: "失敗：",

      ab_h: "關於這個族譜",
      ab_p1: "這是一部活的、眾人協作的<b>江氏</b>（客家「Kong」）<b>族譜</b>，堂號<b>濟陽</b> — 屬<b>巴色會（Basel Mission）</b>的客家基督徒世系。始祖為<b>江八郎（字文明）</b>，由<b>寧化石壁</b>（客家播遷的傳說起點）遷往福建<b>上杭三坪鄉</b>開基立業。族譜自稱出自宋代兄弟江萬里／江萬載（益國公）一脈 — 此說宜考證，未必為定論。",
      ab_p2: "歷代遷徙：汀州永定（烏坭坪 桂花樹下）→ 約1569年遷<b>長樂（今五華）</b>→ 永安 → <b>新安李朗（今深圳）</b>；其中一支遠渡英屬北婆羅洲 — 馬來西亞沙巴的<b>古達、山打根、吧巴</b>。種子資料轉錄自手抄本《江氏族譜》（上、下冊），涵蓋直系第 1–26 世。",
      ab_h_poem: "字輩",
      ab_h_help: "如何協助",
      ab_help: "多數早期條目標示為<span class=\"badge low\">待考證</span> — 皆為對舊手稿的盡力辨讀。若您認得某位祖先、能補上相片、訂正日期、新增自己的支系，或標出<b>祠堂</b>或墳墓的精確座標，請使用<b>貢獻</b>頁。所有更動經審核後方會上線。",
      ab_h_privacy: "私隱",
      ab_privacy: "世系與祖地公開可見。<i>在世</i>成員的相片與細節僅向已登入的家族成員顯示。聯絡方式為私密。未成年者預設隱藏，任何人亦可要求移除。",
      ab_h_tech: "技術",
      ab_tech: "靜態網站（可免費託管於 GitHub Pages）＋ 可選用的 Supabase 後端，處理帳戶、上載與審核。詳見儲存庫中的 <code>README.md</code> 與 <code>supabase/schema.sql</code>。"
    }
  };

  function detect() {
    try {
      const saved = localStorage.getItem("zupu_lang");
      if (saved === "zh" || saved === "en") return saved;
    } catch (e) { /* ignore */ }
    return (navigator.language || "").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
  }

  let lang = detect();
  const subs = [];

  function t(key) {
    return (dict[lang] && dict[lang][key]) || dict.en[key] || key;
  }
  function getLang() { return lang; }
  function setLang(l) {
    if (l !== "zh" && l !== "en") return;
    lang = l;
    try { localStorage.setItem("zupu_lang", l); } catch (e) { /* ignore */ }
    applyStatic();
    subs.forEach(fn => { try { fn(lang); } catch (e) { console.error(e); } });
  }
  function toggle() { setLang(lang === "zh" ? "en" : "zh"); }
  function onChange(fn) { subs.push(fn); }

  function applyStatic(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.getAttribute("data-i18n")); });
    root.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    root.querySelectorAll("[data-i18n-ph]").forEach(el => { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
  }

  window.I18N = { t, getLang, setLang, toggle, onChange, applyStatic };
})();
