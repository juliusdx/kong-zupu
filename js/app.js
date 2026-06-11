/* App shell: tabs, search, person drawer, about. */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const placeById = id => LINEAGE.places.find(p => p.id === id);
  const personById = id => LINEAGE.persons.find(p => p.id === id);

  let mapReady = false;
  let currentPersonId = null;
  let currentPlaceId = null;

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
    if (view === "tree") {
      setTimeout(() => Tree.fit(), 50);
      if (currentPersonId) setTimeout(() => renderBreadcrumb(currentPersonId), 60); else hideBreadcrumb();
    } else hideBreadcrumb();
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

        // Link the place to the related person if specified
        if (payload.relatedTo) {
          let updateField = null;
          if (payload.placeType === "grave" || payload.placeType === "church_grave") updateField = "burial_place";
          else if (payload.placeType === "residence" || payload.placeType === "diaspora") updateField = "residence_place";
          else if (payload.placeType === "origin") updateField = "birth_place";

          if (updateField) {
            const pObj = personById(payload.relatedTo);
            if (pObj) {
              const { data: upData, error: upErr } = await sb.from("persons")
                .update({ [updateField]: place.id })
                .eq("id", payload.relatedTo)
                .select();
              if (upErr) throw upErr;
              if (!upData || upData.length === 0) {
                // No live row exists, so insert one copying essential properties from memory
                const fullRow = {
                  id: payload.relatedTo,
                  name: pObj.name,
                  gen: pObj.gen,
                  pinyin: pObj.pinyin,
                  ritual_name: pObj.ritualName,
                  formal_name: pObj.formalName,
                  hao: pObj.hao,
                  gender: pObj.gender,
                  father_id: pObj.father,
                  spouse_of: pObj.spouseOf,
                  birth_year: pObj.birthYear,
                  death_year: pObj.deathYear,
                  lifespan: pObj.lifespan,
                  religion: pObj.religion,
                  relation: pObj.relation,
                  bio: pObj.bio,
                  birth_place: pObj.birthPlace,
                  residence_place: pObj.residencePlace,
                  burial_place: pObj.burialPlace,
                  confidence: pObj.confidence,
                  [updateField]: place.id
                };
                Object.keys(fullRow).forEach(k => fullRow[k] === undefined && delete fullRow[k]);
                const { error: insErr } = await sb.from("persons").insert(fullRow);
                if (insErr) throw insErr;
              }
            }
          }
        }
      }
      // On approve, apply a member's exact-GPS correction to an existing place.
      if (status === "approved" && payload && payload.action === "update_place") {
        const lat = parseFloat(payload.lat), lng = parseFloat(payload.lng);
        if (!isFinite(lat) || !isFinite(lng))
          throw new Error("This location correction has no valid latitude/longitude.");
        const ex = placeById(payload.placeId);
        // upsert handles both an existing live place (update coords) and a
        // seed-only place that has no live row yet (insert, copying seed fields).
        const place = {
          id: payload.placeId,
          type: (ex && ex.type) || payload.placeType || "residence",
          name: (ex && ex.name) || payload.placeName || "(unnamed place)",
          name_en: ex ? ex.nameEn : null,
          lat, lng,
          approximate: false,
          note: ex ? ex.note : null,
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
  let mediaByPlace = {};
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
      mediaByPerson = {}; mediaByPlace = {};
      (md.data || []).forEach(m => {
        if (m.place_id) (mediaByPlace[m.place_id] = mediaByPlace[m.place_id] || []).push(m);
        else if (m.person_id) (mediaByPerson[m.person_id] = mediaByPerson[m.person_id] || []).push(m);
      });
      // main photo per person → tree avatars (approved only; respects RLS visibility tiers).
      // Use the chosen cover photo if set, otherwise the first approved one.
      LINEAGE.persons.forEach(p => {
        const ap = (mediaByPerson[p.id] || []).filter(m => m.approved);
        const main = ap.find(m => m.cover) || ap[0];
        if (main) p.photo = main.url; else delete p.photo;
      });
      Tree.render("#tree-canvas", openPerson);   // re-index + redraw with merged data
      if (window.MapView && MapView.refresh) MapView.refresh();
      updateVerifyCount();
    } catch (e) { console.warn("live data load failed", e); }
  }

  // Shrink/re-encode big photos in the browser before upload — saves bandwidth and
  // storage, which matters a lot on slow mainland-China connections. EXIF-orientation
  // aware via createImageBitmap; falls back to the original file if anything fails.
  async function downscaleImage(file, maxDim = 1600, quality = 0.82) {
    try {
      if (!file.type || !file.type.startsWith("image/") || file.type === "image/gif") return file;
      let bmp;
      if (window.createImageBitmap) {
        try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
        catch (e) { bmp = await createImageBitmap(file); }
      } else {
        const url = URL.createObjectURL(file);
        bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      }
      const w0 = bmp.width, h0 = bmp.height, big = Math.max(w0, h0);
      if (big <= maxDim && file.size < 600 * 1024) return file;   // already small enough
      const scale = Math.min(1, maxDim / big);
      const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
      const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
      const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", quality));
      if (!blob || blob.size >= file.size) return file;           // no win → keep original
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch (e) { console.warn("downscale skipped", e); return file; }
  }

  // Upload a photo attached to either a person (member tier) or a place (public).
  async function uploadMedia(subject, file) {
    const sb = Auth.client(), st = Auth.state();
    if (!st.user) throw new Error("Sign in to add photos.");
    const existing = subject.placeId ? (mediaByPlace[subject.placeId] || []) : (mediaByPerson[subject.personId] || []);
    if (existing.length >= 5) throw new Error(I18N.t("d_maxphotos"));
    file = await downscaleImage(file);
    const key = subject.placeId || subject.personId;
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const path = (subject.placeId ? "places/" : "") + key + "/" + Date.now() + "_" + safe;
    const up = await sb.storage.from("photos").upload(path, file, { upsert: false });
    if (up.error) throw up.error;
    const url = sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
    const row = subject.placeId
      ? { place_id: subject.placeId, url, uploaded_by: st.user.id, visibility: "public" }
      : { person_id: subject.personId, url, uploaded_by: st.user.id, visibility: "member" };
    const ins = await sb.from("media").insert(row);
    if (ins.error) throw ins.error;
  }
  const uploadPhoto = (personId, file) => uploadMedia({ personId }, file);
  async function approvePhoto(mediaId) {
    const sb = Auth.client();
    const { error } = await sb.from("media").update({ approved: true }).eq("id", mediaId);
    if (error) { alert("Failed: " + error.message); return; }
    await loadLiveData();
  }
  // Choose which approved photo is the tree avatar: clear siblings, set this one.
  async function setCover(mediaId, personId) {
    const sb = Auth.client();
    try {
      await sb.from("media").update({ cover: false }).eq("person_id", personId).neq("id", mediaId);
      const { error } = await sb.from("media").update({ cover: true }).eq("id", mediaId);
      if (error) throw error;
      await loadLiveData();
      openPerson(personId);
    } catch (e) { alert(I18N.t("r_failed") + e.message); }
  }

  /* ---- Person drawer ---- */
  function openPerson(id) {
    const p = personById(id);
    if (!p) return;
    currentPersonId = id; currentPlaceId = null;
    renderBreadcrumb(id);
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
        photos.map(m => `<figure class="photo${m.cover ? " is-cover" : ""}">
          <img src="${m.url}" alt="" loading="lazy">
          ${m.cover ? `<span class="cover-badge" title="${T("d_cover")}">★</span>` : ""}
          ${!m.approved
            ? `<figcaption class="pending">${me.isAdmin ? `<button data-approve-photo="${m.id}">${T("d_approve")}</button>` : T("d_pending")}</figcaption>`
            : (me.isAdmin && !m.cover ? `<figcaption class="setcover"><button data-cover="${m.id}">${T("d_setcover")}</button></figcaption>` : "")}
        </figure>`).join("") + `</div>`;
    }
    const atMax = photos.length >= 5;
    const uploadHtml = me.user
      ? (atMax ? `<p class="muted">${T("d_maxphotos")}</p>`
               : `<button class="action" id="add-photo">${T("d_addphoto")}</button><input type="file" id="photo-file" accept="image/*" hidden>`)
      : "";

    $("#drawer-body").innerHTML = `
      <h2>${p.name}</h2>
      <div class="pin-name">${p.pinyin || ""}</div>
      <div>
        ${p.confidence === "low" ? `<span class="badge low">${T("d_badge_low")}</span>` : ""}
        ${p.religion ? '<span class="badge relig">巴色會 Basel Mission</span>' : ""}
        ${p.seam ? `<span class="badge seam">${T("d_seam_badge")}</span>` : ""}
      </div>
      ${p.seam ? `<p class="muted" style="margin:.4rem 0">${T("d_seam")}</p>` : ""}
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
    if (me.user && !atMax) {
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
    if (me.isAdmin) $$("#drawer-body [data-cover]").forEach(b =>
      b.onclick = () => setCover(b.dataset.cover, p.id));
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

  /* ---- Place drawer (shares #drawer with the person drawer) ---------------- */
  const PLACE_TYPE_KEY = { hall:"pt_hall", grave:"pt_grave", church_grave:"pt_church",
    residence:"pt_residence", origin:"pt_origin", diaspora:"pt_diaspora" };
  function openPlace(id) {
    const pl = placeById(id);
    if (!pl) return;
    currentPlaceId = id; currentPersonId = null;
    hideBreadcrumb();
    const T = I18N.t, me = Auth.state();
    const who = LINEAGE.persons.filter(pp => [pp.birthPlace,pp.burialPlace,pp.residencePlace].includes(pl.id));
    const rows = [];
    const row = (k,v) => v ? rows.push(`<div class="row"><span class="k">${k}</span><span>${v}</span></div>`) : null;
    row(T("pl_type"), T(PLACE_TYPE_KEY[pl.type] || pl.type));
    if (pl.modern) row(T("pl_modern"), pl.modern);
    if (who.length) row(T("pl_linked"), who.map(w=>`<a class="kin" data-go="${w.id}">${w.name}</a>`).join("、"));

    const photos = mediaByPlace[pl.id] || [];
    let photoHtml = "";
    if (photos.length) {
      photoHtml = `<div class="field-section">${T("pl_photos")}</div><div class="photo-grid">` +
        photos.map(m => `<figure class="photo"><img src="${m.url}" alt="" loading="lazy">
          ${!m.approved ? `<figcaption class="pending">${me.isAdmin ? `<button data-approve-photo="${m.id}">${T("d_approve")}</button>` : T("d_pending")}</figcaption>` : ""}
        </figure>`).join("") + `</div>`;
    }

    $("#drawer-body").innerHTML = `
      <h2>${pl.name}</h2>
      <div class="pin-name">${pl.nameEn || ""}</div>
      <div>${pl.approximate
        ? `<span class="badge low">${T("pl_approx_warn")}</span>`
        : `<span class="badge verified">${T("pl_verified")}</span>`}</div>
      ${pl.note ? `<div class="bio">${pl.note}</div>` : ""}
      ${rows.join("")}
      ${photoHtml}
      <button class="action" id="place-pin">${T("pl_suggest_loc")}</button>
      ${me.user
        ? (photos.length >= 5
            ? `<p class="muted">${T("d_maxphotos")}</p>`
            : `<button class="action" id="place-photo">${T("pl_addphoto")}</button><input type="file" id="place-file" accept="image/*" hidden>`)
        : ""}
      <button class="action" id="place-map">${T("pl_view_map")}</button>
    `;
    $$("#drawer-body [data-go]").forEach(a => a.onclick = () => { openPerson(a.dataset.go); Tree.focus(a.dataset.go); });
    if (me.isAdmin) $$("#drawer-body [data-approve-photo]").forEach(b =>
      b.onclick = async () => { await approvePhoto(b.dataset.approvePhoto); openPlace(pl.id); });
    $("#place-pin").onclick = () => suggestLocation(pl);
    $("#place-map").onclick = () => { closeDrawer(); show("map"); };
    if (me.user && photos.length < 5) {
      $("#place-photo").onclick = () => $("#place-file").click();
      $("#place-file").onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        const btn = $("#place-photo"); btn.textContent = T("d_uploading"); btn.disabled = true;
        try { await uploadMedia({ placeId: pl.id }, f); await loadLiveData(); openPlace(pl.id); }
        catch (err) { alert(T("d_uploadfail") + err.message); btn.textContent = T("pl_addphoto"); btn.disabled = false; }
      };
    }
    $("#drawer").classList.add("open");
    $("#drawer-scrim").classList.add("open");
  }

  /* Member suggests an exact GPS by dropping a pin on the map → review queue. */
  async function suggestLocation(place) {
    closeDrawer();
    show("map");
    const coords = await MapView.pickLocation(place);
    if (!coords) return;
    const payload = {
      action: "update_place", placeId: place.id, placeName: place.name,
      placeType: place.type, lat: coords.lat, lng: coords.lng,
      submittedAt: new Date().toISOString(), status: "pending"
    };
    try {
      if (Auth.LIVE && Auth.client()) {
        const sb = Auth.client(), st = Auth.state();
        const ins = { payload, status: "pending" };
        if (st.user) ins.submitted_by = st.user.id;
        const { error } = await sb.from("contributions").insert(ins);
        if (error) throw error;
      } else {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `zupu-location-${Date.now()}.json`; a.click();
        URL.revokeObjectURL(a.href);
      }
      alert(I18N.t("pick_thanks"));
    } catch (e) { alert(I18N.t("pick_fail") + e.message); }
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

  /* ---- Search (live autocomplete dropdown) ---- */
  const SEARCH_FIELDS = ["name", "pinyin", "ritualName", "ritualPinyin", "style", "formalName", "hao", "milkName", "aka"];
  const SEARCH_LIMIT = 20;
  let searchMatches = [], searchActive = -1;

  function searchHits(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    const scored = [];
    for (const p of LINEAGE.persons) {
      let rank = 99;
      for (const f of SEARCH_FIELDS) {
        const v = p[f]; if (!v) continue;
        const idx = String(v).toLowerCase().indexOf(q);
        if (idx === 0) { rank = 0; break; }       // prefix match ranks first
        if (idx > 0) rank = Math.min(rank, 1);    // substring match
      }
      if (rank < 99) scored.push({ p, rank });
    }
    scored.sort((a, b) => a.rank - b.rank || (a.p.gen || 0) - (b.p.gen || 0) || a.p.name.localeCompare(b.p.name));
    return scored.map(s => s.p);
  }
  function hl(text, q) {
    if (!text) return "";
    const t = String(text), i = t.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(t);
    return esc(t.slice(0, i)) + "<mark>" + esc(t.slice(i, i + q.length)) + "</mark>" + esc(t.slice(i + q.length));
  }
  function renderSearch(raw) {
    const box = $("#search-results"), q = raw.trim();
    if (!q) { closeSearch(); return; }
    const all = searchHits(q);
    searchMatches = all.slice(0, SEARCH_LIMIT);
    searchActive = -1;
    $("#search").setAttribute("aria-expanded", "true");
    if (!all.length) {
      box.innerHTML = `<li class="sr-empty">${I18N.t("search_none")}</li>`;
      box.classList.add("open"); return;
    }
    const ql = q.toLowerCase();
    box.innerHTML = searchMatches.map((p, i) => {
      const sub = [];
      if (p.pinyin) sub.push(hl(p.pinyin, q));
      ["ritualName", "style", "formalName", "hao", "milkName", "aka"].forEach(f => {
        if (p[f] && String(p[f]).toLowerCase().includes(ql)) sub.push(hl(p[f], q));
      });
      const gen = p.gen != null ? "第" + p.gen + "世" : "";
      const subTxt = sub.filter(Boolean).join(" · ");
      return `<li role="option" data-id="${p.id}" data-i="${i}">
        <span class="sr-name">${hl(p.name, q)}</span>
        <span class="sr-sub">${subTxt ? subTxt + (gen ? " · " : "") : ""}${gen}</span></li>`;
    }).join("") + (all.length > SEARCH_LIMIT ? `<li class="sr-more">+${all.length - SEARCH_LIMIT}${I18N.t("search_more")}</li>` : "");
    box.classList.add("open");
    box.querySelectorAll("li[data-id]").forEach(li => li.onclick = () => pickSearch(li.dataset.id));
  }
  function pickSearch(id) {
    closeSearch();
    $("#search").value = "";
    show("tree"); Tree.focus(id); openPerson(id);
  }
  function closeSearch() {
    const box = $("#search-results");
    box.classList.remove("open"); box.innerHTML = "";
    searchMatches = []; searchActive = -1;
    $("#search").setAttribute("aria-expanded", "false");
  }
  function moveActive(delta) {
    const items = $$("#search-results li[data-id]");
    if (!items.length) return;
    searchActive = (searchActive + delta + items.length) % items.length;
    items.forEach((li, i) => li.classList.toggle("active", i === searchActive));
    items[searchActive].scrollIntoView({ block: "nearest" });
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

      <h3>${T("ab_h_seam")}</h3>
      <p>${T("ab_seam")}</p>

      <h3>${T("ab_h_privacy")}</h3>
      <p>${T("ab_privacy")}</p>

      <h3>${T("ab_h_tech")}</h3>
      <p>${T("ab_tech")}</p>
    `;
  }

  /* ---- "You are here" breadcrumb ---- */
  // walk father links up to the 始祖; for a married-in spouse, anchor on the husband's
  // line and append the spouse as the final crumb
  function ancestorPath(id) {
    let p = personById(id);
    if (!p) return [];
    let spouse = null;
    if (p.spouseOf) { spouse = p; p = personById(p.spouseOf) || p; }
    const chain = [], seen = new Set();
    while (p && !seen.has(p.id)) { seen.add(p.id); chain.unshift(p); p = p.father ? personById(p.father) : null; }
    return spouse ? chain.concat([spouse]) : chain;
  }
  function positionBreadcrumb() {
    const bc = $("#tree-breadcrumb");
    if (!bc || bc.hidden) return;
    const c = $("#tree-canvas").getBoundingClientRect();
    bc.style.top = (c.top + 10) + "px";
    bc.style.left = (c.left + 16) + "px";
    bc.style.maxWidth = (c.width - 32) + "px";
  }
  function hideBreadcrumb() { const bc = $("#tree-breadcrumb"); if (bc) bc.hidden = true; }
  function renderBreadcrumb(id) {
    const bc = $("#tree-breadcrumb");
    const chain = ancestorPath(id);
    if (!chain.length) { bc.hidden = true; return; }
    const cur = chain[chain.length - 1];
    const crumb = p => `<a class="bc-crumb${p.id === cur.id ? " bc-current" : ""}" data-go="${p.id}">${p.name}</a>`;
    let parts;
    if (chain.length > 5) {
      // collapse the deep middle so the bar stays readable: 始祖 › … › last three
      const mid = chain.slice(1, chain.length - 3).map(p => p.name).join(" › ");
      parts = [crumb(chain[0]), `<span class="bc-more" title="${mid}">…</span>`].concat(chain.slice(-3).map(crumb));
    } else {
      parts = chain.map(crumb);
    }
    const genTxt = I18N.getLang() === "zh" ? ("第 " + cur.gen + " 世") : ("Gen " + cur.gen);
    const sep = `<span class="bc-sep">›</span>`;
    bc.innerHTML = `<span class="bc-label">${I18N.t("bc_here")}</span>${parts.join(sep)}<span class="bc-gen">· ${genTxt}</span>`;
    bc.hidden = false;
    positionBreadcrumb();
    $$("#tree-breadcrumb [data-go]").forEach(a => a.onclick = () => { openPerson(a.dataset.go); Tree.focus(a.dataset.go); });
  }

  /* ---- First-run welcome card ---- */
  const INTRO_SEEN_KEY = "zupu_seen_intro";
  function buildIntro() {
    if ($("#intro-card")) return;
    const scrim = document.createElement("div");
    scrim.id = "intro-scrim"; scrim.className = "intro-scrim";
    const card = document.createElement("div");
    card.id = "intro-card"; card.className = "intro-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.innerHTML = `
      <span class="intro-seal">江</span>
      <h2 data-i18n="intro_title"></h2>
      <p class="intro-sub" data-i18n="intro_sub"></p>
      <ul class="intro-tips">
        <li data-i18n-html="intro_tip_click"></li>
        <li data-i18n-html="intro_tip_expand"></li>
        <li data-i18n-html="intro_tip_search"></li>
      </ul>
      <div class="intro-actions">
        <button class="primary" id="intro-start" data-i18n="intro_start"></button>
        <button id="intro-expand" data-i18n="intro_expand"></button>
        <button id="intro-skip" data-i18n="intro_skip"></button>
      </div>`;
    document.body.appendChild(scrim);
    document.body.appendChild(card);
    I18N.applyStatic(card);
    $("#intro-start").onclick = () => { closeIntro(); Tree.home(); };
    $("#intro-expand").onclick = () => { closeIntro(); Tree.expandAll(); };
    $("#intro-skip").onclick = () => closeIntro();
    scrim.onclick = () => closeIntro();
    // keep the card legible if the user flips language while it is open
    I18N.onChange(() => { if (card.classList.contains("open")) I18N.applyStatic(card); });
  }
  function maybeShowIntro() {
    let seen = false;
    try { seen = localStorage.getItem(INTRO_SEEN_KEY) === "1"; } catch (e) { /* ignore */ }
    if (seen) return;
    $("#intro-scrim").classList.add("open");
    $("#intro-card").classList.add("open");
  }
  function closeIntro() {
    $("#intro-scrim").classList.remove("open");
    $("#intro-card").classList.remove("open");
    try { localStorage.setItem(INTRO_SEEN_KEY, "1"); } catch (e) { /* ignore */ }
  }

  /* ---- Init ---- */
  function init() {
    mergeCommittedOverrides();
    I18N.applyStatic();
    Tree.render("#tree-canvas", openPerson);
    Contribute.build();
    buildAbout();
    buildIntro();
    refreshAdminBar();
    maybeShowIntro();

    // language toggle + re-render dynamic UI on language change
    const langBtn = $("#lang-toggle");
    langBtn.textContent = I18N.t("lang_switch");
    langBtn.onclick = () => I18N.toggle();
    I18N.onChange(() => {
      langBtn.textContent = I18N.t("lang_switch");
      Contribute.build();
      buildAbout();
      refreshAdminBar();
      try { Tree.setOptions({}); }   // refresh swim-lane / band labels to the new language
      catch (e) { console.warn("tree relabel skipped", e); }   // never let it block the map/drawer relabel
      updateVerifyCount();
      if (window.MapView && MapView.relabel) MapView.relabel();   // rebuild map popups in the new language
      if ($("#verify-panel").classList.contains("open")) buildVerifyList();
      if ($("#view-review").classList.contains("active")) buildReview();
      if ($("#drawer").classList.contains("open") && currentPersonId) openPerson(currentPersonId);
      if ($("#drawer").classList.contains("open") && currentPlaceId) openPlace(currentPlaceId);
      if (currentPersonId && !$("#tree-breadcrumb").hidden) renderBreadcrumb(currentPersonId);
    });

    $$(".tab").forEach(t => t.onclick = () => show(t.dataset.view));
    $("#drawer-close").onclick = closeDrawer;
    $("#drawer-scrim").onclick = closeDrawer;
    $("#toggle-daughters").onchange = e => Tree.setOptions({ daughters: e.target.checked });
    $("#toggle-pinyin").onchange = e => Tree.setOptions({ pinyin: e.target.checked });
    $("#toggle-photos").onchange = e => Tree.setOptions({ photos: e.target.checked });
    $("#toggle-swim").onchange = e => Tree.setOptions({ swim: e.target.checked });
    // map layer filters (祖籍 / 遷居 / 墓 / 祠堂 / 教會墳場 / 沙巴)
    $$(".layer-toggle").forEach(c => c.onchange = () => MapView.setLayer(c.dataset.group, c.checked));
    $("#btn-home").onclick = () => { Tree.home(); hideBreadcrumb(); };
    $("#btn-expand").onclick = () => Tree.expandAll();
    $("#btn-fit").onclick = () => Tree.fit();
    $("#btn-verify").onclick = openVerify;
    $("#verify-close").onclick = closeVerify;
    updateVerifyCount();
    const sEl = $("#search");
    sEl.addEventListener("input", e => renderSearch(e.target.value));
    sEl.addEventListener("focus", e => { if (e.target.value.trim()) renderSearch(e.target.value); });
    sEl.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const pick = (searchActive >= 0 ? searchMatches[searchActive] : searchMatches[0]);
        if (pick) pickSearch(pick.id);
      } else if (e.key === "Escape") { closeSearch(); sEl.blur(); }
    });
    document.addEventListener("click", e => { if (!e.target.closest(".search-box")) closeSearch(); });

    // place links (person drawer + map popups) open the place drawer
    document.addEventListener("click", e => {
      const a = e.target.closest("[data-place]");
      if (a) { e.preventDefault(); openPlace(a.dataset.place); }
    });

    // photo lightbox — click any thumbnail (drawer grid or tree avatar) to expand
    const lb = $("#lightbox"), lbImg = $("#lightbox-img");
    const closeLb = () => lb.classList.remove("open");
    $("#lightbox-close").onclick = closeLb;
    lb.onclick = closeLb;
    document.addEventListener("click", e => {
      const thumb = e.target.closest(".photo img");
      if (thumb && thumb.src) { lbImg.src = thumb.src; lb.classList.add("open"); }
    });
    window.addEventListener("resize", () => { Tree.onResize(); positionBreadcrumb(); });

    setupAuth();
    Auth.init().then(loadLiveData);
  }

  window.openPerson = openPerson;
  window.openPlace = openPlace;
  document.addEventListener("DOMContentLoaded", init);
})();
