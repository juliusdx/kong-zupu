/* App shell: tabs, search, person drawer, about. */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const placeById = id => LINEAGE.places.find(p => p.id === id);
  const personById = id => LINEAGE.persons.find(p => p.id === id);

  let mapReady = false;
  let currentPersonId = null;

  /* ---- Overrides + Admin mode ---------------------------------------------
   * Admin mode is enabled with ?admin=1 in the URL (optionally gated by a
   * passphrase set in APP_CONFIG.ADMIN_PASS). It is a LOCAL editing aid only:
   * choices are applied in-memory and exported as data/overrides.js, which the
   * admin commits to the repo. Real server-side auth arrives with the backend. */
  const ADMIN = new URLSearchParams(location.search).has("admin") &&
    (!window.APP_CONFIG || !APP_CONFIG.ADMIN_PASS ||
     prompt("Admin passphrase:") === APP_CONFIG.ADMIN_PASS);
  let pending = {};                       // id -> confirmed override fields (this session)

  function applyOverride(id, fields) {
    const p = personById(id);
    if (p) Object.assign(p, fields);
  }
  function mergeCommittedOverrides() {
    const o = window.LINEAGE_OVERRIDES || {};
    Object.keys(o).forEach(id => applyOverride(id, o[id]));
  }
  function chooseCandidate(id, cand) {
    const fields = {
      name: cand.name,
      pinyin: cand.pinyin || personById(id).pinyin,
      confidence: "med",
      _confirmed: cand.name,
      note: (cand.note ? cand.note + " " : "") +
            "✔ Confirmed as the direct-line ancestor via admin (" +
            new Date().toISOString().slice(0, 10) + ")."
    };
    pending[id] = fields;
    applyOverride(id, fields);
    Tree.setOptions({});                  // re-render with the new name (keyed join, no dupes)
    openPerson(id);                       // refresh the drawer
    Tree.focus(id);
    refreshAdminBar();
    updateVerifyCount();
    if ($("#verify-panel").classList.contains("open")) buildVerifyList();
  }
  function downloadOverrides() {
    const merged = Object.assign({}, window.LINEAGE_OVERRIDES || {}, pending);
    Object.values(merged).forEach(v => delete v._confirmed);
    const body = Object.entries(merged)
      .map(([id, o]) => "  " + JSON.stringify(id) + ": " + JSON.stringify(o))
      .join(",\n");
    const text =
      "/* ADMIN-CONFIRMED CORRECTIONS — commit this file to data/overrides.js */\n" +
      "window.LINEAGE_OVERRIDES = {\n" + body + "\n};\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/javascript" }));
    a.download = "overrides.js"; a.click();
    URL.revokeObjectURL(a.href);
  }
  function refreshAdminBar() {
    let bar = document.getElementById("admin-bar");
    if (!ADMIN) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "admin-bar";
      document.body.appendChild(bar);
    }
    const n = Object.keys(pending).length;
    bar.innerHTML =
      "<span>" + I18N.t("a_msg") + "</span>" +
      '<button id="admin-dl"' + (n ? "" : " disabled") + ">" + I18N.t("a_download") +
      (n ? " (" + n + ")" : "") + "</button>";
    if (n) document.getElementById("admin-dl").onclick = downloadOverrides;
  }

  function show(view) {
    $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === view));
    $$(".view").forEach(v => v.classList.remove("active"));
    $("#view-" + view).classList.add("active");
    if (view === "map") { MapView.init(); mapReady = true; }
    if (view === "tree") setTimeout(() => Tree.fit(), 50);
    if (view === "review") buildReview();
  }

  /* ---- Auth UI + admin review --------------------------------------------- */
  function setupAuth() {
    const btn = $("#auth-status");
    const scrim = $("#signin-scrim"), modal = $("#signin-modal");
    const openModal = () => { scrim.classList.add("open"); modal.classList.add("open"); $("#signin-msg").textContent = ""; };
    const closeModal = () => { scrim.classList.remove("open"); modal.classList.remove("open"); };
    $("#signin-close").onclick = closeModal;
    scrim.onclick = closeModal;

    $("#signin-magic").onclick = async () => {
      const email = $("#signin-email").value.trim();
      if (!email) { $("#signin-msg").textContent = I18N.t("s_enter_email"); return; }
      $("#signin-msg").textContent = I18N.t("s_sending");
      try {
        const { error } = await Auth.sendMagicLink(email);
        if (error) throw error;
        $("#signin-msg").textContent = I18N.t("s_sent");
      } catch (e) { $("#signin-msg").textContent = I18N.t("s_err") + e.message; }
    };
    $("#signin-google").onclick = async () => {
      $("#signin-msg").textContent = I18N.t("s_redir");
      try { const { error } = await Auth.google(); if (error) throw error; }
      catch (e) { $("#signin-msg").textContent = I18N.t("s_err") + e.message; }
    };

    Auth.onChange(st => {
      if (!st.live) {
        btn.textContent = I18N.t("auth_guest");
        btn.removeAttribute("data-i18n");
        btn.onclick = null;
        return;
      }
      if (st.user) {
        const label = (st.profile && st.profile.full_name) || st.user.email;
        btn.removeAttribute("data-i18n");
        btn.textContent = (st.isAdmin ? "★ " : "") + label;
        btn.onclick = () => { if (confirm(I18N.t("auth_signout_confirm"))) Auth.signOut(); };
        closeModal();
      } else {
        btn.setAttribute("data-i18n", "auth_signin");
        btn.textContent = I18N.t("auth_signin");
        btn.onclick = openModal;
      }
      $("#tab-review").style.display = st.isAdmin ? "" : "none";
      if (!st.isAdmin && $("#view-review").classList.contains("active")) show("tree");
    });
  }

  async function buildReview() {
    const wrap = $("#review-wrap");
    const st = Auth.state();
    const head = "<h2>" + I18N.t("r_h") + "</h2>";
    if (!st.isAdmin) { wrap.innerHTML = head + "<p class='muted'>" + I18N.t("r_adminonly") + "</p>"; return; }
    wrap.innerHTML = head + "<p class='muted'>" + I18N.t("r_loading") + "</p>";
    try {
      const sb = Auth.client();
      const { data, error } = await sb.from("contributions").select("*")
        .eq("status", "pending").order("created_at", { ascending: false });
      if (error) throw error;
      if (!data.length) { wrap.innerHTML = head + "<p class='muted'>" + I18N.t("r_none") + "</p>"; return; }
      wrap.innerHTML = head + `<p class="muted">${data.length}${I18N.t("r_pending")}</p>` + data.map(renderContribCard).join("");
      const payloadById = Object.fromEntries(data.map(c => [c.id, c.payload]));
      wrap.querySelectorAll("[data-approve]").forEach(b => b.onclick = () => decide(b.dataset.approve, "approved", payloadById[b.dataset.approve]));
      wrap.querySelectorAll("[data-reject]").forEach(b => b.onclick = () => decide(b.dataset.reject, "rejected", payloadById[b.dataset.reject]));
    } catch (e) {
      wrap.innerHTML = head + "<p class='muted'>" + I18N.t("r_error") + e.message + "</p>";
    }
  }
  function esc(s) { return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
  function renderContribCard(c) {
    const p = c.payload || {};
    const rows = Object.entries(p)
      .filter(([k, v]) => v && !["status", "submittedAt"].includes(k))
      .map(([k, v]) => `<div class="row"><span class="k">${esc(k)}</span><span>${esc(v)}</span></div>`).join("");
    return `<div class="contrib-card">
      <div class="cc-head">#${esc(c.id.slice(0, 8))} · ${new Date(c.created_at).toLocaleString()}</div>
      ${rows}
      <div class="cc-actions">
        <button class="primary" data-approve="${c.id}">${I18N.t("r_approve")}</button>
        <button class="ghost" data-reject="${c.id}">${I18N.t("r_reject")}</button>
      </div></div>`;
  }
  async function decide(id, status, payload) {
    try {
      const sb = Auth.client(), st = Auth.state();
      // On approve, promote new-person contributions onto the live tree.
      if (status === "approved" && payload &&
          (payload.action === "add_child" || payload.action === "add_spouse")) {
        const row = {
          id: "c_" + id.slice(0, 8),
          name: payload.name || "(unnamed)",
          pinyin: payload.pinyin || null,
          ritual_name: payload.ritualName || null,
          gender: payload.gender || "m",
          gen: payload.gen ? parseInt(payload.gen, 10) : null,
          bio: payload.bio || null,
          birth_year: payload.birth || null,
          living: payload.living === "true",
          visibility: payload.living === "true" ? "member" : "public",
          confidence: "low",
          source: "contribution"
        };
        if (payload.action === "add_spouse") row.spouse_of = payload.relatedTo;
        else row.father_id = payload.relatedTo;
        const { error: insErr } = await sb.from("persons").upsert(row);
        if (insErr) throw insErr;
      }
      // On approve, promote a location contribution onto the map.
      if (status === "approved" && payload && payload.action === "add_place") {
        const lat = parseFloat(payload.lat), lng = parseFloat(payload.lng);
        if (!isFinite(lat) || !isFinite(lng))
          throw new Error("This location submission has no valid latitude/longitude.");
        const place = {
          id: "pl_" + id.slice(0, 8),
          type: payload.placeType || "residence",
          name: payload.placeName || payload.place || payload.name || "(unnamed place)",
          name_en: payload.pinyin || null,
          lat, lng,
          approximate: false,
          note: payload.bio || null,
          visibility: "public"
        };
        const { error: plErr } = await sb.from("places").upsert(place);
        if (plErr) throw plErr;
      }
      const { error } = await sb.from("contributions")
        .update({ status, reviewed_by: st.user.id }).eq("id", id);
      if (error) throw error;
      await loadLiveData();
      buildReview();
    } catch (e) { alert(I18N.t("r_failed") + e.message); }
  }

  /* ---- Live data: merge Supabase rows on top of the static seed ----------- */
  let mediaByPerson = {};
  const camel = r => ({
    id: r.id, gen: r.gen, name: r.name, pinyin: r.pinyin,
    ritualName: r.ritual_name, formalName: r.formal_name, hao: r.hao,
    gender: r.gender, father: r.father_id, spouseOf: r.spouse_of,
    birthYear: r.birth_year, deathYear: r.death_year, lifespan: r.lifespan,
    religion: r.religion, relation: r.relation, bio: r.bio,
    birthPlace: r.birth_place, residencePlace: r.residence_place, burialPlace: r.burial_place,
    living: r.living, confidence: r.confidence, _live: true
  });
  const camelPlace = r => ({
    id: r.id, type: r.type, name: r.name, nameEn: r.name_en,
    lat: r.lat, lng: r.lng, approximate: r.approximate, note: r.note, _live: true
  });
  function mergeRow(list, row) {
    const ex = list.find(x => x.id === row.id);
    if (ex) Object.assign(ex, row); else list.push(row);
  }
  async function loadLiveData() {
    if (!Auth.LIVE) return;
    const sb = Auth.client(); if (!sb) return;
    try {
      const [pp, pl, md] = await Promise.all([
        sb.from("persons").select("*"),
        sb.from("places").select("*"),
        sb.from("media").select("*")
      ]);
      (pl.data || []).forEach(r => mergeRow(LINEAGE.places, camelPlace(r)));
      (pp.data || []).forEach(r => mergeRow(LINEAGE.persons, camel(r)));
      mediaByPerson = {};
      (md.data || []).forEach(m => (mediaByPerson[m.person_id] = mediaByPerson[m.person_id] || []).push(m));
      Tree.render("#tree-canvas", openPerson);   // re-index + redraw with merged data
      if (window.MapView && MapView.refresh) MapView.refresh();
      updateVerifyCount();
    } catch (e) { console.warn("live data load failed", e); }
  }

  async function uploadPhoto(personId, file) {
    const sb = Auth.client(), st = Auth.state();
    if (!st.user) throw new Error("Sign in to add photos.");
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const path = personId + "/" + Date.now() + "_" + safe;
    const up = await sb.storage.from("photos").upload(path, file, { upsert: false });
    if (up.error) throw up.error;
    const url = sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
    const ins = await sb.from("media").insert({
      person_id: personId, url, uploaded_by: st.user.id, visibility: "member"
    });
    if (ins.error) throw ins.error;
  }
  async function approvePhoto(mediaId) {
    const sb = Auth.client();
    const { error } = await sb.from("media").update({ approved: true }).eq("id", mediaId);
    if (error) { alert("Failed: " + error.message); return; }
    await loadLiveData();
  }

  /* ---- Person drawer ---- */
  function openPerson(id) {
    const p = personById(id);
    if (!p) return;
    currentPersonId = id;
    const sp = Tree.spouseFor(id);
    const father = p.father ? personById(p.father) : null;
    const kids = LINEAGE.persons.filter(k => k.father === id && !k.spouseOf);
    const spouseHusband = p.spouseOf ? personById(p.spouseOf) : null;

    const T = I18N.t;
    const rows = [];
    const row = (k, v) => v ? rows.push(`<div class="row"><span class="k">${k}</span><span>${v}</span></div>`) : null;
    row(T("d_generation"), "第 " + p.gen + " 世 · Gen " + p.gen);
    row(T("d_romanization"), p.pinyin);
    row(T("d_role"), p.relation);
    if (p.style) row(T("d_style"), p.style);
    if (p.ritualName) row(T("d_ritual"), p.ritualName + (p.ritualPinyin ? " (" + p.ritualPinyin + ")" : ""));
    if (p.formalName) row(T("d_formal"), p.formalName);
    if (p.hao) row(T("d_hao"), p.hao);
    if (p.milkName) row(T("d_milk"), p.milkName);
    if (p.aka) row(T("d_aka"), p.aka);
    row(T("d_gender"), p.gender === "f" ? T("d_female") : T("d_male"));
    row(T("d_born"), p.birthYear);
    row(T("d_lifespan"), p.lifespan);
    row(T("d_faith"), p.religion);
    row(T("d_marriedout"), p.marriedOut);
    if (p.birthPlace) row(T("d_birthplace"), placeLink(p.birthPlace));
    if (p.residencePlace) row(T("d_residence"), placeLink(p.residencePlace));
    if (p.burialPlace) row(T("d_burial"), placeLink(p.burialPlace));

    // candidate ancestors (for unresolved placeholder generations)
    let candHtml = "";
    if (p.candidates && p.candidates.length) {
      const items = p.candidates.map((c, i) => `
        <div class="cand${p._confirmed === c.name ? " chosen" : ""}">
          <div class="cand-name">${c.name}${p._confirmed === c.name ? " ✔" : ""} <span class="cand-pin">${c.pinyin || ""}</span></div>
          ${c.note ? `<div class="cand-note">${c.note}</div>` : ""}
          ${ADMIN ? `<button class="cand-pick" data-pick="${i}">${T("d_setcorrect")}</button>` : ""}
        </div>`).join("");
      candHtml = `<div class="field-section">${ADMIN ? T("d_cand_admin") : T("d_cand")}</div>
        <div class="cand-list">${items}</div>`;
    }

    const kin = [];
    if (father) kin.push(`<div class="row"><span class="k">${T("d_father")}</span><span class="kin"><a data-go="${father.id}">${father.name}</a></span></div>`);
    if (spouseHusband) kin.push(`<div class="row"><span class="k">${T("d_spouseof")}</span><span class="kin"><a data-go="${spouseHusband.id}">${spouseHusband.name}</a></span></div>`);
    if (sp) kin.push(`<div class="row"><span class="k">${T("d_spouse")}</span><span class="kin"><a data-go="${sp.id}">${sp.name}</a></span></div>`);
    if (kids.length) kin.push(`<div class="row"><span class="k">${T("d_children")}</span><span class="kin">${kids.map(k=>`<a data-go="${k.id}">${k.name}</a>`).join("、")}</span></div>`);

    // photos
    const photos = mediaByPerson[p.id] || [];
    const me = Auth.state();
    let photoHtml = "";
    if (photos.length) {
      photoHtml = `<div class="field-section">${T("d_photos")}</div><div class="photo-grid">` +
        photos.map(m => `<figure class="photo">
          <img src="${m.url}" alt="" loading="lazy">
          ${!m.approved ? `<figcaption class="pending">${me.isAdmin ? `<button data-approve-photo="${m.id}">${T("d_approve")}</button>` : T("d_pending")}</figcaption>` : ""}
        </figure>`).join("") + `</div>`;
    }
    const uploadHtml = me.user
      ? `<button class="action" id="add-photo">${T("d_addphoto")}</button><input type="file" id="photo-file" accept="image/*" hidden>`
      : "";

    $("#drawer-body").innerHTML = `
      <h2>${p.name}</h2>
      <div class="pin-name">${p.pinyin || ""}</div>
      <div>
        ${p.confidence === "low" ? `<span class="badge low">${T("d_badge_low")}</span>` : ""}
        ${p.religion ? '<span class="badge relig">巴色會 Basel Mission</span>' : ""}
      </div>
      ${p.bio ? `<div class="bio">${p.bio}</div>` : ""}
      ${rows.join("")}
      ${candHtml}
      ${photoHtml}
      ${uploadHtml}
      ${kin.length ? `<div class="field-section" style="border:none;margin-top:1rem">${T("d_family")}</div>${kin.join("")}` : ""}
      <button class="action" data-edit="${p.id}">${T("d_suggest")}</button>
    `;
    $$("#drawer-body [data-go]").forEach(a => a.onclick = () => { openPerson(a.dataset.go); Tree.focus(a.dataset.go); });
    $("#drawer-body [data-edit]").onclick = () => { closeDrawer(); show("contribute"); };
    if (ADMIN) $$("#drawer-body [data-pick]").forEach(b =>
      b.onclick = () => chooseCandidate(p.id, p.candidates[+b.dataset.pick]));
    if (me.user) {
      $("#add-photo").onclick = () => $("#photo-file").click();
      $("#photo-file").onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        const btn = $("#add-photo"); btn.textContent = I18N.t("d_uploading"); btn.disabled = true;
        try { await uploadPhoto(p.id, f); await loadLiveData(); openPerson(p.id); }
        catch (err) { alert(I18N.t("d_uploadfail") + err.message); btn.textContent = I18N.t("d_addphoto"); btn.disabled = false; }
      };
    }
    if (me.isAdmin) $$("#drawer-body [data-approve-photo]").forEach(b =>
      b.onclick = async () => { await approvePhoto(b.dataset.approvePhoto); openPerson(p.id); });
    $("#drawer").classList.add("open");
    $("#drawer-scrim").classList.add("open");
  }
  function placeLink(id) {
    const pl = placeById(id); if (!pl) return id;
    return `<a class="kin" data-place="${id}" style="cursor:pointer">${pl.name}${pl.approximate ? I18N.t("d_approx") : ""}</a>`;
  }
  function closeDrawer() {
    $("#drawer").classList.remove("open");
    $("#drawer-scrim").classList.remove("open");
  }

  /* ---- Needs-verification list ---- */
  function updateVerifyCount() {
    const n = LINEAGE.persons.filter(p => p.confidence === "low").length;
    const el = $("#verify-count"); if (el) el.textContent = "(" + n + ")";
  }
  function buildVerifyList() {
    const T = I18N.t, body = $("#verify-body");
    const low = LINEAGE.persons.filter(p => p.confidence === "low")
      .sort((a, b) => (a.gen || 0) - (b.gen || 0));
    if (!low.length) { body.innerHTML = `<h2>${T("vp_title")}</h2><p class="muted">${T("vp_none")}</p>`; return; }
    body.innerHTML = `<h2>${T("vp_title")} <span class="muted">(${low.length})</span></h2>` +
      `<p class="muted">${T("vp_hint")}</p>` +
      low.map(p => {
        const f = p.father ? personById(p.father) : null;
        const alt = [p.style, p.ritualName, p.formalName, p.hao, p.milkName, p.aka].filter(Boolean).join(" · ");
        const meta = "第" + p.gen + "世" + (f ? " · " + T("d_father") + " " + f.name : "") + (alt ? " · " + alt : "");
        return `<button class="verify-item" data-go="${p.id}"><span class="vn">⚠ ${p.name}</span><span class="vg">${meta}</span></button>`;
      }).join("");
    body.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { openPerson(b.dataset.go); Tree.focus(b.dataset.go); });
  }
  function openVerify() { buildVerifyList(); $("#verify-panel").classList.add("open"); }
  function closeVerify() { $("#verify-panel").classList.remove("open"); }

  /* ---- Search ---- */
  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return;
    const allNames = p => [p.name, p.pinyin, p.ritualName, p.ritualPinyin, p.style,
      p.formalName, p.hao, p.milkName, p.aka].filter(Boolean).join(" ").toLowerCase();
    const hit = LINEAGE.persons.find(p => allNames(p).includes(q));
    if (hit) { show("tree"); Tree.focus(hit.id); openPerson(hit.id); }
  }

  /* ---- About ---- */
  function buildAbout() {
    const gp = LINEAGE.generationPoem;
    const T = I18N.t;
    $("#about-wrap").innerHTML = `
      <h2>${T("ab_h")}</h2>
      <p>${T("ab_p1")}</p>
      <p>${T("ab_p2")}</p>

      <h3>${T("ab_h_poem")}</h3>
      <p>${gp.note}</p>
      <div class="poem">
        ${gp.characters.map(c => `<div class="gchar"><span>第${c.gen}世</span><b>${c.char}</b><span>${c.pinyin}</span></div>`).join("")}
      </div>

      <h3>${T("ab_h_help")}</h3>
      <p>${T("ab_help")}</p>

      <h3>${T("ab_h_privacy")}</h3>
      <p>${T("ab_privacy")}</p>

      <h3>${T("ab_h_tech")}</h3>
      <p>${T("ab_tech")}</p>
    `;
  }

  /* ---- Init ---- */
  function init() {
    mergeCommittedOverrides();
    I18N.applyStatic();
    Tree.render("#tree-canvas", openPerson);
    Contribute.build();
    buildAbout();
    refreshAdminBar();

    // language toggle + re-render dynamic UI on language change
    const langBtn = $("#lang-toggle");
    langBtn.textContent = I18N.t("lang_switch");
    langBtn.onclick = () => I18N.toggle();
    I18N.onChange(() => {
      langBtn.textContent = I18N.t("lang_switch");
      Contribute.build();
      buildAbout();
      refreshAdminBar();
      Tree.setOptions({});   // refresh swim-lane / band labels to the new language
      updateVerifyCount();
      if ($("#verify-panel").classList.contains("open")) buildVerifyList();
      if ($("#view-review").classList.contains("active")) buildReview();
      if ($("#drawer").classList.contains("open") && currentPersonId) openPerson(currentPersonId);
    });

    $$(".tab").forEach(t => t.onclick = () => show(t.dataset.view));
    $("#drawer-close").onclick = closeDrawer;
    $("#drawer-scrim").onclick = closeDrawer;
    $("#toggle-daughters").onchange = e => Tree.setOptions({ daughters: e.target.checked });
    $("#toggle-pinyin").onchange = e => Tree.setOptions({ pinyin: e.target.checked });
    $("#toggle-swim").onchange = e => Tree.setOptions({ swim: e.target.checked });
    $("#btn-expand").onclick = () => Tree.expandAll();
    $("#btn-fit").onclick = () => Tree.fit();
    $("#btn-verify").onclick = openVerify;
    $("#verify-close").onclick = closeVerify;
    updateVerifyCount();
    $("#search").addEventListener("keydown", e => { if (e.key === "Enter") search(e.target.value); });

    // place links inside drawer
    document.addEventListener("click", e => {
      const a = e.target.closest("[data-place]");
      if (a) { closeDrawer(); show("map"); }
    });
    window.addEventListener("resize", () => { Tree.onResize(); });

    setupAuth();
    Auth.init().then(loadLiveData);
  }

  window.openPerson = openPerson;
  document.addEventListener("DOMContentLoaded", init);
})();
