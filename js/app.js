/* App shell: tabs, search, person drawer, about. */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const placeById = id => LINEAGE.places.find(p => p.id === id);
  const personById = id => LINEAGE.persons.find(p => p.id === id);

  let mapReady = false;

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
      '<span>⚑ Admin mode — click an ancestor marked ⚑ to confirm its identity.</span>' +
      '<button id="admin-dl"' + (n ? "" : " disabled") + '>Download overrides.js' +
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
      if (!email) { $("#signin-msg").textContent = "Enter your email first."; return; }
      $("#signin-msg").textContent = "Sending…";
      try {
        const { error } = await Auth.sendMagicLink(email);
        if (error) throw error;
        $("#signin-msg").textContent = "✓ Check your inbox for the sign-in link.";
      } catch (e) { $("#signin-msg").textContent = "Error: " + e.message; }
    };
    $("#signin-google").onclick = async () => {
      $("#signin-msg").textContent = "Redirecting to Google…";
      try { const { error } = await Auth.google(); if (error) throw error; }
      catch (e) { $("#signin-msg").textContent = "Error: " + e.message; }
    };

    Auth.onChange(st => {
      if (!st.live) {
        btn.textContent = "Guest";
        btn.title = "Sign-in activates once Supabase is configured";
        btn.onclick = null;
        return;
      }
      if (st.user) {
        const label = (st.profile && st.profile.full_name) || st.user.email;
        btn.textContent = (st.isAdmin ? "★ " : "") + label;
        btn.title = "Click to sign out";
        btn.onclick = () => { if (confirm("Sign out?")) Auth.signOut(); };
        closeModal();
      } else {
        btn.textContent = "Sign in";
        btn.title = "Sign in";
        btn.onclick = openModal;
      }
      $("#tab-review").style.display = st.isAdmin ? "" : "none";
      if (!st.isAdmin && $("#view-review").classList.contains("active")) show("tree");
    });
  }

  async function buildReview() {
    const wrap = $("#review-wrap");
    const st = Auth.state();
    if (!st.isAdmin) { wrap.innerHTML = "<h2>審核 · Contribution review</h2><p class='muted'>Admins only.</p>"; return; }
    wrap.innerHTML = "<h2>審核 · Contribution review</h2><p class='muted'>Loading pending submissions…</p>";
    try {
      const sb = Auth.client();
      const { data, error } = await sb.from("contributions").select("*")
        .eq("status", "pending").order("created_at", { ascending: false });
      if (error) throw error;
      const head = "<h2>審核 · Contribution review</h2>";
      if (!data.length) { wrap.innerHTML = head + "<p class='muted'>No pending submissions. 🎉</p>"; return; }
      wrap.innerHTML = head + `<p class="muted">${data.length} pending.</p>` + data.map(renderContribCard).join("");
      const payloadById = Object.fromEntries(data.map(c => [c.id, c.payload]));
      wrap.querySelectorAll("[data-approve]").forEach(b => b.onclick = () => decide(b.dataset.approve, "approved", payloadById[b.dataset.approve]));
      wrap.querySelectorAll("[data-reject]").forEach(b => b.onclick = () => decide(b.dataset.reject, "rejected", payloadById[b.dataset.reject]));
    } catch (e) {
      wrap.innerHTML = "<h2>審核 · Contribution review</h2><p class='muted'>Error: " + e.message + "</p>";
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
        <button class="primary" data-approve="${c.id}">Approve</button>
        <button class="ghost" data-reject="${c.id}">Reject</button>
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
      const { error } = await sb.from("contributions")
        .update({ status, reviewed_by: st.user.id }).eq("id", id);
      if (error) throw error;
      await loadLiveData();
      buildReview();
    } catch (e) { alert("Failed: " + e.message); }
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
    const sp = Tree.spouseFor(id);
    const father = p.father ? personById(p.father) : null;
    const kids = LINEAGE.persons.filter(k => k.father === id && !k.spouseOf);
    const spouseHusband = p.spouseOf ? personById(p.spouseOf) : null;

    const rows = [];
    const row = (k, v) => v ? rows.push(`<div class="row"><span class="k">${k}</span><span>${v}</span></div>`) : null;
    row("Generation", "第 " + p.gen + " 世 · Gen " + p.gen);
    row("Romanization", p.pinyin);
    row("Role", p.relation);
    if (p.style) row("字/號 Style name", p.style);
    if (p.ritualName) row("禮名 Ritual name", p.ritualName + (p.ritualPinyin ? " (" + p.ritualPinyin + ")" : ""));
    if (p.formalName) row("名 Formal name", p.formalName);
    if (p.hao) row("號 Style name", p.hao);
    row("Gender", p.gender === "f" ? "女 Female" : "男 Male");
    row("Born", p.birthYear);
    row("Lifespan", p.lifespan);
    row("Faith", p.religion);
    row("Married out", p.marriedOut);
    if (p.birthPlace) row("Birth place", placeLink(p.birthPlace));
    if (p.residencePlace) row("Residence", placeLink(p.residencePlace));
    if (p.burialPlace) row("Burial", placeLink(p.burialPlace));

    // candidate ancestors (for unresolved placeholder generations)
    let candHtml = "";
    if (p.candidates && p.candidates.length) {
      const items = p.candidates.map((c, i) => `
        <div class="cand${p._confirmed === c.name ? " chosen" : ""}">
          <div class="cand-name">${c.name}${p._confirmed === c.name ? " ✔" : ""} <span class="cand-pin">${c.pinyin || ""}</span></div>
          ${c.note ? `<div class="cand-note">${c.note}</div>` : ""}
          ${ADMIN ? `<button class="cand-pick" data-pick="${i}">Set as correct →</button>` : ""}
        </div>`).join("");
      candHtml = `<div class="field-section">候選祖先 · Candidate ancestors${ADMIN ? " — click to confirm the direct line" : " (admin can confirm)"}</div>
        <div class="cand-list">${items}</div>`;
    }

    const kin = [];
    if (father) kin.push(`<div class="row"><span class="k">Father</span><span class="kin"><a data-go="${father.id}">${father.name}</a></span></div>`);
    if (spouseHusband) kin.push(`<div class="row"><span class="k">Spouse of</span><span class="kin"><a data-go="${spouseHusband.id}">${spouseHusband.name}</a></span></div>`);
    if (sp) kin.push(`<div class="row"><span class="k">Spouse</span><span class="kin"><a data-go="${sp.id}">${sp.name}</a></span></div>`);
    if (kids.length) kin.push(`<div class="row"><span class="k">Children</span><span class="kin">${kids.map(k=>`<a data-go="${k.id}">${k.name}</a>`).join("、")}</span></div>`);

    $("#drawer-body").innerHTML = `
      <h2>${p.name}</h2>
      <div class="pin-name">${p.pinyin || ""}</div>
      <div>
        ${p.confidence === "low" ? '<span class="badge low">⚠ needs verification</span>' : ""}
        ${p.religion ? '<span class="badge relig">巴色會 Basel Mission</span>' : ""}
      </div>
      ${p.bio ? `<div class="bio">${p.bio}</div>` : ""}
      ${rows.join("")}
      ${candHtml}
      ${kin.length ? `<div class="field-section" style="border:none;margin-top:1rem">Family</div>${kin.join("")}` : ""}
      <button class="action" data-edit="${p.id}">Suggest a correction →</button>
    `;
    $$("#drawer-body [data-go]").forEach(a => a.onclick = () => { openPerson(a.dataset.go); Tree.focus(a.dataset.go); });
    $("#drawer-body [data-edit]").onclick = () => { closeDrawer(); show("contribute"); };
    if (ADMIN) $$("#drawer-body [data-pick]").forEach(b =>
      b.onclick = () => chooseCandidate(p.id, p.candidates[+b.dataset.pick]));
    $("#drawer").classList.add("open");
    $("#drawer-scrim").classList.add("open");
  }
  function placeLink(id) {
    const pl = placeById(id); if (!pl) return id;
    return `<a class="kin" data-place="${id}" style="cursor:pointer">${pl.name}${pl.approximate ? " (approx.)" : ""}</a>`;
  }
  function closeDrawer() {
    $("#drawer").classList.remove("open");
    $("#drawer-scrim").classList.remove("open");
  }

  /* ---- Search ---- */
  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) return;
    const hit = LINEAGE.persons.find(p =>
      (p.name && p.name.includes(q)) ||
      (p.pinyin && p.pinyin.toLowerCase().includes(q)) ||
      (p.ritualName && p.ritualName.includes(q)));
    if (hit) { show("tree"); Tree.focus(hit.id); openPerson(hit.id); }
  }

  /* ---- About ---- */
  function buildAbout() {
    const gp = LINEAGE.generationPoem;
    $("#about-wrap").innerHTML = `
      <h2>關於這個族譜 · About this Zupu</h2>
      <p>This is a living, crowdsourced 族譜 (<i>zupu</i>) for the <b>江 (Kong / Jiang) family</b>, hall name
      <b>濟陽 (Jiyang)</b> — a Hakka Christian lineage of the <b>巴色會 (Basel Mission)</b>. It descends from
      the <b>始祖 江八郎 (字文明)</b>, who moved from <b>寧化石壁</b> (the legendary Hakka dispersal point) to
      <b>上杭三坪鄉</b> in Fujian and founded the family estate. The book claims descent from the Song-dynasty
      brothers 江萬里 / 江萬載 (益國公) — a lineage claim worth verifying rather than taking as established fact.</p>
      <p>Over the centuries the family migrated 汀州永定 (烏坭坪 桂花樹下) → <b>長樂 (today 五華)</b> around
      1569 → 永安 → <b>新安 李朗 (today Shenzhen)</b>; and one line emigrated to British North Borneo —
      <b>古達 Kudat, 山打根 Sandakan, 吧巴 Papar</b> in Sabah, Malaysia. The seed data is transcribed from the
      full handwritten <i>Kong Family Book</i> (pt 1 &amp; 2), covering generations 1–26 of the direct line.</p>

      <h3>字輩 · Generational names</h3>
      <p>${gp.note}</p>
      <div class="poem">
        ${gp.characters.map(c => `<div class="gchar"><span>第${c.gen}世</span><b>${c.char}</b><span>${c.pinyin}</span></div>`).join("")}
      </div>

      <h3>How to help</h3>
      <p>Most early entries are marked <span class="badge low">needs verification</span> — they are best-effort
      readings of old handwriting. If you recognise an ancestor, can add a photo, fix a date, add your own
      branch, or pin the exact GPS of a 祠堂 (ancestral hall) or grave, please use the
      <b>貢獻 Contribute</b> tab. Every change is reviewed before it goes live.</p>

      <h3>Privacy</h3>
      <p>The lineage and ancestral sites are public. Photos and details of <i>living</i> members are shown
      only to signed-in family. Contact details are private. Minors are hidden by default, and anyone may
      ask to be removed.</p>

      <h3>Technical</h3>
      <p>Static site (hostable free on GitHub Pages) + optional Supabase backend for accounts, uploads and
      moderation. See <code>README.md</code> and <code>supabase/schema.sql</code> in the repository.</p>
    `;
  }

  /* ---- Init ---- */
  function init() {
    mergeCommittedOverrides();
    Tree.render("#tree-canvas", openPerson);
    Contribute.build();
    buildAbout();
    refreshAdminBar();

    $$(".tab").forEach(t => t.onclick = () => show(t.dataset.view));
    $("#drawer-close").onclick = closeDrawer;
    $("#drawer-scrim").onclick = closeDrawer;
    $("#toggle-daughters").onchange = e => Tree.setOptions({ daughters: e.target.checked });
    $("#toggle-pinyin").onchange = e => Tree.setOptions({ pinyin: e.target.checked });
    $("#btn-expand").onclick = () => Tree.expandAll();
    $("#btn-fit").onclick = () => Tree.fit();
    $("#search").addEventListener("keydown", e => { if (e.key === "Enter") search(e.target.value); });

    // place links inside drawer
    document.addEventListener("click", e => {
      const a = e.target.closest("[data-place]");
      if (a) { closeDrawer(); show("map"); }
    });
    window.addEventListener("resize", () => { Tree.onResize(); });

    setupAuth();
    Auth.init();
  }

  window.openPerson = openPerson;
  document.addEventListener("DOMContentLoaded", init);
})();
