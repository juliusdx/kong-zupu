/* App shell: tabs, search, person drawer, about. */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const placeById = id => LINEAGE.places.find(p => p.id === id);
  const personById = id => LINEAGE.persons.find(p => p.id === id);

  let mapReady = false;
  let currentPersonId = null;
  let currentPlaceId = null;
  let suppressHistory = false;   // true while replaying a popstate, so we don't re-push

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

  // Size the tree/map canvas to exactly fill the space below the header + toolbar, using
  // live element heights instead of a fixed magic number. The header height varies a lot
  // (esp. on mobile, where tabs/search wrap), so calc(100vh - 165px) overflowed the page;
  // this keeps the canvas flush with the viewport at any width. window.innerHeight tracks
  // the *visible* height, so it also handles mobile browser chrome.
  function sizeCanvas() {
    const header = $(".site-header");
    const hh = header ? header.getBoundingClientRect().height : 0;
    [["#view-tree", "#tree-canvas", ".tree-toolbar"], ["#view-map", "#map-canvas", ".map-toolbar"]]
      .forEach(([vs, cs, ts]) => {
        const view = $(vs); if (!view || !view.classList.contains("active")) return;
        const canvas = $(cs), toolbar = view.querySelector(ts);
        const tbh = toolbar ? toolbar.getBoundingClientRect().height : 0;
        if (canvas) canvas.style.height = Math.max(240, Math.round(window.innerHeight - hh - tbh)) + "px";
      });
  }

  function show(view, opts) {
    $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === view));
    $$(".view").forEach(v => v.classList.remove("active"));
    $("#view-" + view).classList.add("active");
    sizeCanvas();
    if (view === "map") { MapView.init(); mapReady = true; }
    if (view === "tree") {
      if (!opts || !opts.noFit) setTimeout(() => { sizeCanvas(); Tree.fit(); }, 50);   // skip when caller will focus a node
      if (currentPersonId) setTimeout(() => renderBreadcrumb(currentPersonId), 60); else hideBreadcrumb();
    } else hideBreadcrumb();
    if (view === "review") buildReview();
    if (view === "members") buildMembers();
    if (view === "sources") buildSources();
    pushNav();
  }

  /* ---- Browser history / back-button support ------------------------------
   * The app is a single page with no URL changes, so the browser Back button used
   * to do nothing (or leave the site). We mirror each navigable state — which view
   * is active, and which person/place drawer is open — into history.pushState, and
   * replay it on popstate. Back from the contribute form returns to the open drawer
   * the user came from; back from a drawer closes it; back between tabs switches view. */
  function activeView() {
    const v = $(".view.active");
    return v ? v.id.replace(/^view-/, "") : "tree";
  }
  function navSnapshot() {
    const drawerOpen = $("#drawer").classList.contains("open");
    return {
      view: activeView(),
      personId: drawerOpen ? currentPersonId : null,
      placeId: drawerOpen ? currentPlaceId : null
    };
  }
  // Push a history entry for the current UI, unless we're replaying history or the
  // state is unchanged (drawer refreshes — photo upload, language toggle — re-open the
  // same person and must not spawn duplicate entries).
  function pushNav() {
    if (suppressHistory) return;
    const s = navSnapshot(), cur = history.state;
    if (cur && cur.view === s.view && cur.personId === s.personId && cur.placeId === s.placeId) return;
    history.pushState(s, "");
  }
  function applyNav(s) {
    suppressHistory = true;
    try {
      show(s.view);
      if (s.personId) openPerson(s.personId);
      else if (s.placeId) openPlace(s.placeId);
      else closeDrawer();
    } finally {
      suppressHistory = false;
    }
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
      $("#tab-members").style.display = st.isAdmin ? "" : "none";
      if (!st.isAdmin && $("#view-review").classList.contains("active")) show("tree");
      if (!st.isAdmin && $("#view-members").classList.contains("active")) show("tree");
      refreshMembersCount();   // badge the tab as soon as an admin signs in
      if ($("#view-sources").classList.contains("active")) buildSources();   // refresh lock state
    });
  }

  async function buildReview() {
    const wrap = $("#review-wrap");
    const st = Auth.state();
    const T = I18N.t;
    const head = "<h2>" + T("r_h") + "</h2>";
    if (!st.isAdmin) { wrap.innerHTML = head + "<p class='muted'>" + T("r_adminonly") + "</p>"; return; }
    wrap.innerHTML = head + "<p class='muted'>" + T("r_loading") + "</p>";
    try {
      const sb = Auth.client();
      // members_admin is admin-only and carries name + email, so the log can name the
      // reviewer rather than showing a bare uuid. With several people approving now,
      // "who decided this" matters as much as "what changed".
      const [pendingRes, histRes, memRes] = await Promise.all([
        sb.from("contributions").select("*").eq("status", "pending").order("created_at", { ascending: false }),
        sb.from("contributions").select("*").neq("status", "pending").order("reviewed_at", { ascending: false }).limit(50),
        sb.from("members_admin").select("id, email, full_name")
      ]);
      if (pendingRes.error) throw pendingRes.error;
      const pending = pendingRes.data || [];
      const history = histRes.data || [];
      const reviewerById = {};
      (memRes && memRes.data || []).forEach(m => { reviewerById[m.id] = m.full_name || m.email || m.id; });
      const reviewerName = uid => uid ? esc(reviewerById[uid] || uid.slice(0, 8) + "…") : "—";

      let html = head;
      html += pending.length
        ? `<p class="muted">${pending.length}${T("r_pending")}</p>` + pending.map(renderContribCard).join("")
        : "<p class='muted'>" + T("r_none") + "</p>";

      if (history.length) {
        // Human-readable summary of what each contribution changed
        function histDetail(p) {
          const a = p.action || "";
          if (a === "edit") {
            const person = personById(p.relatedTo);
            const personName = person ? esc(person.name || p.relatedTo) : esc(p.relatedTo || "?");
            // Authoritative path: the from→to diff captured at submit time.
            if (Array.isArray(p.changes) && p.changes.length) {
              const changes = p.changes.map(ch =>
                `<span class="rh-field">${esc(ch.label || ch.field)}: <s>${esc(ch.from) || "∅"}</s> → <b>${esc(ch.to) || "∅"}</b></span>`);
              return `Edit <b>${personName}</b><br>` + changes.join(" &nbsp;");
            }
            // Fallback for older records (no captured diff): compare submitted values
            // against current person data — best-effort only.
            const FIELD_LABELS = { name:"name", pinyin:"pinyin", ritualName:"ritual name",
              milkName:"milk name", aka:"also known as", gender:"gender", gen:"generation",
              birth:"birth year", bio:"bio", living:"living", lat:"latitude", lng:"longitude" };
            const skip = new Set(["action","relatedTo","contributor","contributorContact",
              "contributorLocation","relationship","kinship","siblingOf","cleared","moveTo","moveRel","moveNote","contactConsent","submittedAt","status",
              "photo","personPhone","personWechat","personEmail","changes","submitterEmail","submitterId"]);
            const changes = Object.entries(p)
              .filter(([k, v]) => !skip.has(k) && v !== "" && v != null)
              .map(([k, v]) => {
                const label = FIELD_LABELS[k] || k;
                const oldVal = person ? (person[k] || person[{ ritualName:"ritualName", milkName:"milkName", gen:"gen", birth:"birthYear", living:"living" }[k] || k]) : null;
                return oldVal != null && String(oldVal) !== String(v)
                  ? `<span class="rh-field">${label}: <s>${esc(String(oldVal))}</s> → <b>${esc(String(v))}</b></span>`
                  : `<span class="rh-field">${label}: <b>${esc(String(v))}</b></span>`;
              });
            return `Edit <b>${personName}</b>` + (changes.length ? "<br>" + changes.join(" &nbsp;") : "");
          }
          if (a === "add_child" || a === "add_spouse") {
            const rel = a === "add_spouse" ? "spouse of" : "child of";
            const parent = personById(p.relatedTo);
            const parentName = parent ? esc(parent.name) : esc(p.relatedTo || "?");
            // A "brother / sister of X" submission is stored as a child of X's father —
            // say so, or the card looks like it names the wrong relative.
            const sib = p.siblingOf ? personById(p.siblingOf) : null;
            const via = sib ? ` (as a sibling of <b>${esc(sib.name)}</b>)` : "";
            return `Add <b>${esc(p.name || "?")}</b> as ${rel} <b>${parentName}</b>${via}`;
          }
          if (a === "add_place" || a === "update_place") {
            const verb = a === "add_place" ? "Add" : "Update";
            return `${verb} place: <b>${esc(p.placeName || p.place || "?")}</b>${p.placeType ? ` (${esc(p.placeType)})` : ""}`;
          }
          if (a === "fix_transcription") {
            return `Transcription correction: doc <b>${esc(p.doc_id || "?")}</b> p.${esc(String(p.page || "?"))}`;
          }
          return esc(a.replace(/_/g, " ") || "—");
        }

        html += `<div class="review-history">
          <h3 class="rh-head">${T("r_history")}</h3>
          <table class="rh-table"><thead><tr>
            <th>${T("r_hist_reviewed")}</th><th>${T("r_hist_action")}</th>
            <th>${T("r_hist_who")}</th><th>${T("r_hist_by")}</th><th>${T("r_hist_status")}</th><th>${T("r_hist_reason")}</th>
          </tr></thead><tbody>` +
          history.map(c => {
            const p = c.payload || {};
            const when = c.reviewed_at ? new Date(c.reviewed_at) : null;
            const reviewed = when
              ? `<span title="${esc(when.toLocaleString())}">${esc(when.toLocaleDateString())}</span>`
              : "—";
            const who = esc(p.contributor || p.contributorContact || "—");
            const badge = c.status === "approved"
              ? `<span class="rh-badge rh-ok">✓ approved</span>`
              : `<span class="rh-badge rh-no">✗ rejected</span>`;
            const reason = c.rejection_reason ? esc(c.rejection_reason) : "—";
            return `<tr><td>${reviewed}</td><td class="rh-detail">${histDetail(p)}</td><td>${who}</td>` +
                   `<td class="rh-by">${reviewerName(c.reviewed_by)}</td><td>${badge}</td><td class="rh-reason">${reason}</td></tr>`;
          }).join("") +
          `</tbody></table></div>`;
      }

      // Archived people live here so there is one obvious place to undo a removal.
      html += `<h3>${T("at_arch_h")}</h3><div id="archived-list"></div>`;

      wrap.innerHTML = html;
      buildArchivedList();
      const payloadById = Object.fromEntries(pending.map(c => [c.id, c.payload]));
      wrap.querySelectorAll("[data-approve]").forEach(b => b.onclick = () => decide(b.dataset.approve, "approved", payloadById[b.dataset.approve]));
      wrap.querySelectorAll("[data-reject]").forEach(b => b.onclick = () => decide(b.dataset.reject, "rejected", payloadById[b.dataset.reject]));
    } catch (e) {
      wrap.innerHTML = head + "<p class='muted'>" + T("r_error") + e.message + "</p>";
    }
  }
  /* ---- Members (admin): approve / revoke family sign-ups -------------------
   * profiles.approved gates living-member detail (person_details, contacts, photos).
   * New sign-ups default to false — handle_new_user doesn't set the column — so until
   * an admin approves them here they see living relatives as name-only skeletons.
   * Hiding the tab is cosmetic: members_admin and set_member_approved both re-check
   * is_admin() server-side (migration_v14). */
  let membersPending = 0;

  async function buildMembers() {
    const wrap = $("#members-wrap");
    const st = Auth.state();
    const T = I18N.t;
    const head = `<h2>${T("m_h")}</h2>`;
    if (!st.isAdmin) { wrap.innerHTML = head + `<p class="muted">${T("r_adminonly")}</p>`; return; }
    wrap.innerHTML = head + `<p class="muted">${T("m_loading")}</p>`;
    try {
      const sb = Auth.client();
      const { data, error } = await sb.from("members_admin").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data || [];
      const pending = rows.filter(r => !r.approved);
      const approved = rows.filter(r => r.approved);

      const table = (list, canApprove) => `<table class="rh-table mem-table"><thead><tr>
          <th>${T("m_col_name")}</th><th>${T("m_col_email")}</th><th>${T("m_col_joined")}</th><th></th>
        </tr></thead><tbody>` + list.map(r => {
          const self = st.user && r.id === st.user.id;
          const name = r.full_name ? esc(r.full_name) : `<span class="muted">${T("m_noname")}</span>`;
          const badges = (r.is_admin ? ` <span class="rh-badge rh-ok">${T("m_admin_badge")}</span>` : "")
                       + (self ? ` <span class="rh-badge">${T("m_you")}</span>` : "");
          const joined = r.created_at ? new Date(r.created_at).toLocaleDateString() : "—";
          // An admin revoking themself would lock the panel behind their own approval
          // flag on next load, so leave admins without a revoke button.
          const btn = canApprove
            ? `<button class="primary" data-approve-member="${esc(r.id)}">${T("m_approve")}</button>`
            : (r.is_admin ? "" : `<button class="ghost" data-revoke-member="${esc(r.id)}">${T("m_revoke")}</button>`);
          // Reviewer rights are only offered to already-approved members, and never
          // for yourself — set_member_admin refuses self-demotion server-side too.
          const adminBtn = canApprove || self ? ""
            : (r.is_admin
                ? `<button class="ghost" data-demote="${esc(r.id)}">${T("m_demote")}</button>`
                : `<button class="ghost" data-promote="${esc(r.id)}">${T("m_promote")}</button>`);
          return `<tr><td>${name}${badges}</td><td class="mem-email">${esc(r.email || "—")}</td>` +
                 `<td>${joined}</td><td class="mem-act">${btn} ${adminBtn}</td></tr>`;
        }).join("") + `</tbody></table>`;

      let html = head + `<p class="muted">${T("m_intro")}</p>`;
      html += `<h3 class="rh-head">${T("m_pending_h")}</h3>`;
      html += pending.length ? table(pending, true) : `<p class="muted">${T("m_none_pending")}</p>`;
      if (approved.length) html += `<h3 class="rh-head">${T("m_approved_h")}</h3>` + table(approved, false);
      html += `<div id="mem-msg" class="signin-msg"></div>`;
      wrap.innerHTML = html;

      wrap.querySelectorAll("[data-approve-member]").forEach(b =>
        b.onclick = () => setMemberApproved(b.dataset.approveMember, true));
      wrap.querySelectorAll("[data-revoke-member]").forEach(b =>
        b.onclick = () => { if (confirm(T("m_revoke_confirm"))) setMemberApproved(b.dataset.revokeMember, false); });
      wrap.querySelectorAll("[data-promote]").forEach(b =>
        b.onclick = () => { if (confirm(T("m_promote_confirm"))) setMemberAdmin(b.dataset.promote, true); });
      wrap.querySelectorAll("[data-demote]").forEach(b =>
        b.onclick = () => { if (confirm(T("m_demote_confirm"))) setMemberAdmin(b.dataset.demote, false); });

      membersPending = pending.length;
      updateMembersBadge();
    } catch (e) {
      wrap.innerHTML = head + `<p class="muted">${T("m_error")}${esc(e.message)}</p>`;
    }
  }

  // Grant or remove reviewer rights. The RPC re-checks is_admin() and refuses
  // self-demotion, so the UI guards here are convenience, not security.
  async function setMemberAdmin(id, makeAdmin) {
    const msg = $("#mem-msg");
    if (msg) msg.textContent = I18N.t("m_working");
    try {
      const { error } = await Auth.client().rpc("set_member_admin", { target_id: id, make_admin: makeAdmin });
      if (error) throw error;
      await buildMembers();
    } catch (e) {
      if (msg) msg.textContent = I18N.t("m_error") + e.message;
    }
  }

  async function setMemberApproved(id, approve) {
    const msg = $("#mem-msg");
    if (msg) msg.textContent = I18N.t("m_working");
    try {
      const { error } = await Auth.client().rpc("set_member_approved", { target_id: id, approve });
      if (error) throw error;
      await buildMembers();          // re-read so the row moves between the two tables
    } catch (e) {
      if (msg) msg.textContent = I18N.t("m_error") + e.message;
    }
  }

  function updateMembersBadge() {
    const el = $("#members-count");
    if (!el) return;
    el.textContent = membersPending ? String(membersPending) : "";
    el.hidden = !membersPending;
  }

  // Count waiting sign-ups without opening the tab, so the badge shows up on sign-in.
  async function refreshMembersCount() {
    if (!Auth.state().isAdmin) { membersPending = 0; updateMembersBadge(); return; }
    try {
      const { count, error } = await Auth.client()
        .from("members_admin").select("id", { count: "exact", head: true }).eq("approved", false);
      if (error) throw error;
      membersPending = count || 0;
      updateMembersBadge();
    } catch (e) { console.warn("members count failed", e); }
  }

  function esc(s) { return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
  function renderContribCard(c) {
    const p = c.payload || {};
    // proofread transcription corrections render as a current-vs-suggested comparison
    if (p.action === "fix_transcription") {
      const T = I18N.t;
      return `<div class="contrib-card">
        <div class="cc-head">#${esc(c.id.slice(0, 8))} · ${new Date(c.created_at).toLocaleString()} · ${T("r_tx_label")} · ${T("pf_page")} ${esc(p.page)}${p.contributor ? " · " + esc(p.contributor) : ""}</div>
        <div class="tx-compare">
          <div class="tx-col"><div class="tx-h">${T("r_tx_current")}</div><pre class="tx-pre old">${esc(p.original || "")}</pre></div>
          <div class="tx-col"><div class="tx-h">${T("r_tx_new")}</div><pre class="tx-pre new">${esc(p.text || "")}</pre></div>
        </div>
        <div class="cc-reason"><textarea id="cc-reason-${c.id}" placeholder="${T("r_reason_ph")}"></textarea></div>
        <div class="cc-actions">
          <button class="primary" data-approve="${c.id}">${T("r_approve")}</button>
          <button class="ghost" data-reject="${c.id}">${T("r_reject")}</button>
        </div></div>`;
    }
    // For an edit, show the captured from→to diff up top so the reviewer sees exactly
    // what changed without scanning every field row.
    const changesHtml = (p.action === "edit" && Array.isArray(p.changes) && p.changes.length)
      ? `<div class="cc-changes"><div class="cc-changes-h">${I18N.t("r_changes")}</div>` +
        p.changes.map(ch =>
          `<div class="cc-change"><span class="k">${esc(ch.label || ch.field)}</span>` +
          `<span class="cc-from">${esc(ch.from) || "∅"}</span>` +
          `<span class="cc-arrow">→</span>` +
          `<span class="cc-to">${esc(ch.to) || "∅"}</span></div>`).join("") +
        `</div>`
      : "";
    // the photo (a data: or http URL) renders as a thumbnail, not as a giant text row.
    // Skip internal/raw-diff keys — changes are shown by changesHtml above.
    const HIDE = ["status", "submittedAt", "photo", "changes", "submitterId"];
    const rows = Object.entries(p)
      .filter(([k, v]) => v && !HIDE.includes(k))
      .map(([k, v]) => `<div class="row"><span class="k">${esc(k)}</span><span>${esc(v)}</span></div>`).join("");
    const photoHtml = p.photo
      ? `<div class="row"><span class="k">photo</span><span><img class="cc-photo" src="${esc(p.photo)}" alt=""></span></div>`
      : "";
    return `<div class="contrib-card">
      <div class="cc-head">#${esc(c.id.slice(0, 8))} · ${new Date(c.created_at).toLocaleString()}</div>
      ${changesHtml}${rows}${photoHtml}
      <div class="cc-reason"><textarea id="cc-reason-${c.id}" placeholder="${I18N.t("r_reason_ph")}"></textarea></div>
      <div class="cc-actions">
        <button class="primary" data-approve="${c.id}">${I18N.t("r_approve")}</button>
        <button class="ghost" data-reject="${c.id}">${I18N.t("r_reject")}</button>
      </div></div>`;
  }
  async function decide(id, status, payload) {
    // A correction that replaces the target's name outright is the signature of a
    // mistargeted submission — someone filled the form in for a NEW person while the
    // picker still pointed at a relative. That is how 有章's details were written onto
    // his father 俊華. Make the admin read the swap out loud before it is applied.
    if (status === "approved" && payload && payload.action === "edit" && payload.name) {
      const target = personById(payload.relatedTo);
      const cur = (target && target.name || "").trim(), next = String(payload.name).trim();
      if (target && cur && next && cur !== next && !next.includes(cur) && !cur.includes(next)) {
        const msg = fill(I18N.t("r_confirm_rename"),
          { old: cur, new: next, pin: target.pinyin || "—" });
        if (!confirm(msg)) return;
      }
    }
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
          milk_name: payload.milkName || null,
          aka: payload.aka || null,
          gender: payload.gender || "m",
          // Generation comes from the relative, not from whatever was typed: a child is
          // one below their parent, a spouse sits level. A submitted number is used only
          // when the relative has no generation of their own to derive from.
          gen: relGen(payload.action, payload.relatedTo, payload.gen),
          bio: payload.bio || null,
          birth_year: payload.birth || null,
          living: payload.living === "true",
          visibility: payload.living === "true" ? "member" : "public",
          confidence: "low",
          source: "contribution"
        };
        if (payload.action === "add_spouse") row.spouse_of = payload.relatedTo;
        else row.father_id = payload.relatedTo;
        const plat = parseFloat(payload.lat), plng = parseFloat(payload.lng);   // dropped pin → person's map dot
        if (isFinite(plat) && isFinite(plng)) { row.lat = plat; row.lng = plng; }
        const { error: insErr } = await sb.from("persons").upsert(row);
        if (insErr) throw insErr;
        await attachContribPhoto(row.id, payload.photo, row.visibility);
        await attachContribContact(row.id, payload);
      }
      // On approve, apply an "edit" correction to the named person. Most ancestors
      // exist only in the static seed (no live row yet), so we UPDATE first and, when
      // nothing matched, INSERT a row that snapshots the seed person with the edits on
      // top — same pattern as the place-link path below.
      if (status === "approved" && payload && payload.action === "edit") {
        const pid = payload.relatedTo;
        if (!pid) throw new Error("This correction doesn't say which person it edits.");
        const has = k => Object.prototype.hasOwnProperty.call(payload, k);
        const fields = {};
        if (payload.name) fields.name = payload.name;            // name is NOT NULL — never blank it
        if (has("pinyin"))     fields.pinyin = payload.pinyin || null;
        if (has("ritualName")) fields.ritual_name = payload.ritualName || null;
        if (has("milkName"))   fields.milk_name = payload.milkName || null;
        if (has("aka"))        fields.aka = payload.aka || null;
        if (payload.gender === "m" || payload.gender === "f") fields.gender = payload.gender;
        if (has("gen") && payload.gen !== "" && !payload.moveTo) {
          // An edit may not move someone between generations by hand — the tree
          // derives that from parentage. Keep the person where their father puts them.
          // Skipped when the same correction re-parents them: the move sets it instead.
          const cur = personById(pid), dad = cur && cur.father ? personById(cur.father) : null;
          const derived = dad && dad.gen != null ? dad.gen + 1 : null;
          fields.gen = derived != null ? derived : parseInt(payload.gen, 10);
        }
        const elat = parseFloat(payload.lat), elng = parseFloat(payload.lng);   // dropped pin → person's map dot
        if (isFinite(elat) && isFinite(elng)) { fields.lat = elat; fields.lng = elng; }
        if (has("birth"))      fields.birth_year = payload.birth || null;
        if (has("bio"))        fields.bio = payload.bio || null;
        if (has("living")) {
          fields.living = payload.living === "true";
          fields.visibility = fields.living ? "member" : "public";
        }
        // Fields the submitter deliberately emptied. They cannot ride along in `fields`
        // above, because the payload drops empty values before it is stored — so the
        // intent is carried as a list of field names instead.
        const CLEARABLE_COLS = { pinyin: "pinyin", ritualName: "ritual_name",
          milkName: "milk_name", aka: "aka", birth: "birth_year", bio: "bio" };
        (Array.isArray(payload.cleared) ? payload.cleared : []).forEach(f => {
          if (CLEARABLE_COLS[f]) fields[CLEARABLE_COLS[f]] = null;
        });

        const { data: upData, error: upErr } = await sb.from("persons")
          .update(fields).eq("id", pid).select();
        if (upErr) throw upErr;
        let vis = fields.visibility;
        if (!upData || upData.length === 0) {
          const pObj = personById(pid);
          if (!pObj) throw new Error("Unknown person for this correction: " + pid);
          const fullRow = seedPersonRow(pObj);
          Object.assign(fullRow, fields);   // edits override the seed snapshot
          vis = vis || fullRow.visibility;
          const { error: insErr } = await sb.from("persons").upsert(fullRow);
          if (insErr) throw insErr;
        }
        // Living members keep birth year and bio in person_details, which loadLiveData
        // applies ON TOP of the persons row — so an edit that only touched persons would
        // be overwritten again on the next load. Keep the two in step.
        const detail = {};
        if (has("birth")) detail.birth_year = payload.birth || null;
        if (has("bio")) detail.bio = payload.bio || null;
        (Array.isArray(payload.cleared) ? payload.cleared : []).forEach(f => {
          if (f === "birth") detail.birth_year = null;
          if (f === "bio") detail.bio = null;
        });
        if (Object.keys(detail).length) {
          try {
            const { data: dRow } = await sb.from("person_details").select("person_id").eq("person_id", pid);
            if (dRow && dRow.length) await sb.from("person_details").update(detail).eq("person_id", pid);
          } catch (_) { /* table not migrated, or not visible to this admin — persons row stands */ }
        }

        // Re-parenting, when the correction asked for it. applyMove() is the same code
        // the admin "Move…" button runs, so this inherits its loop guard and its
        // generation cascade over everyone below the person. It throws rather than
        // half-applying, and decide() aborts before marking the contribution approved.
        if (payload.moveTo) {
          const mover = personById(pid);
          if (!mover) throw new Error("Unknown person for this move: " + pid);
          if (!personById(payload.moveTo)) throw new Error("Unknown target for this move: " + payload.moveTo);
          await applyMove(mover, payload.moveRel || "child", payload.moveTo);
        }

        const cur = personById(pid);
        await attachContribPhoto(pid, payload.photo, vis || (cur && cur.living ? "member" : "public"));
        await attachContribContact(pid, payload);
      }
      // On approve, promote a location contribution onto the map.
      if (status === "approved" && payload && payload.action === "add_place") {
        // A place may arrive with no pin at all. Half the graves in the book are recorded
        // only as a土名 —「大坑圍背黃泥夾」,「金銀玩」— and nobody alive knows where that
        // is on a modern map. Refusing those would either lose the fact or push the
        // reviewer into inventing coordinates, which is worse than an honest blank. The
        // map already skips places without coordinates, and the place card offers
        // "Suggest a location" for whoever can eventually place it.
        const lat = parseFloat(payload.lat), lng = parseFloat(payload.lng);
        const located = isFinite(lat) && isFinite(lng);
        const place = {
          id: "pl_" + id.slice(0, 8),
          type: payload.placeType || "residence",
          name: payload.placeName || payload.place || payload.name || "(unnamed place)",
          name_en: payload.pinyin || null,
          lat: located ? lat : null,
          lng: located ? lng : null,
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
                  milk_name: pObj.milkName,
                  aka: pObj.aka,
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
      // On approve, store a proofread transcription correction so it shows for everyone.
      if (status === "approved" && payload && payload.action === "fix_transcription") {
        const { error: txErr } = await sb.from("transcriptions").upsert({
          doc_id: payload.doc_id, page: parseInt(payload.page, 10),
          text: payload.text || "", updated_by: st.user.id, updated_at: new Date().toISOString()
        });
        if (txErr) throw txErr;
      }
      const reasonEl = document.querySelector(`#cc-reason-${id}`);
      const reason = (status === "rejected" && reasonEl) ? reasonEl.value.trim() : null;
      const update = { status, reviewed_by: st.user.id, reviewed_at: new Date().toISOString() };
      if (reason) update.rejection_reason = reason;
      const { error } = await sb.from("contributions").update(update).eq("id", id);
      if (error) throw error;
      // Fire-and-forget: notify the contributor; never blocks the review action
      sb.functions.invoke("notify-contributor", { body: { id, status, reason } })
        .catch(e => console.warn("Contributor notification skipped:", e.message));
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
    milkName: r.milk_name, aka: r.aka,
    gender: r.gender, father: r.father_id, spouseOf: r.spouse_of,
    birthYear: r.birth_year, deathYear: r.death_year, lifespan: r.lifespan,
    religion: r.religion, relation: r.relation, bio: r.bio,
    birthPlace: r.birth_place, residencePlace: r.residence_place, burialPlace: r.burial_place,
    lat: r.lat, lng: r.lng,
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
  // An archived live row masks its seed twin: pull the person out of the tree
  // entirely rather than merging the row in. Restoring re-merges it (the archive
  // wrote a full snapshot, so nothing is lost for seed-only people).
  function dropRow(list, id) {
    const i = list.findIndex(x => x.id === id);
    if (i >= 0) list.splice(i, 1);
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
      (pp.data || []).forEach(r => {
        if (r.archived) dropRow(LINEAGE.persons, r.id);
        else mergeRow(LINEAGE.persons, camel(r));
      });
      // Signed-out visitors don't receive member-tier (living) rows from `persons` (RLS).
      // The family chose to keep living adults findable by NAME + tree position, so pull
      // a column-limited public view (no birth year, bio, location, photo, contact; no
      // minors). Signed-in members already get these via the persons fetch above.
      if (!Auth.state().user) {
        try {
          const { data: lm } = await sb.from("persons_public_search").select("*");
          (lm || []).forEach(r => mergeRow(LINEAGE.persons, camel(r)));
        } catch (_) { /* view not migrated yet — living members stay hidden to anon */ }
      }
      // Gated detail for LIVING members: birth year / bio live in person_details,
      // which RLS exposes only to admins, approved members, or self. Non-approved
      // members get nothing back here, so they see only the basic skeleton above.
      // Guarded separately so the app still works before the Stage-2 migration is run
      // (missing table → ignore, keep basic info).
      try {
        const { data: det } = await sb.from("person_details").select("*");
        (det || []).forEach(d => {
          const p = LINEAGE.persons.find(x => x.id === d.person_id);
          if (!p) return;
          if (d.birth_year) p.birthYear = d.birth_year;
          if (d.death_year) p.deathYear = d.death_year;
          if (d.lifespan)   p.lifespan  = d.lifespan;
          if (d.religion)   p.religion  = d.religion;
          if (d.bio)        p.bio       = d.bio;
        });
      } catch (_) { /* person_details not migrated yet — basic info only */ }
      // Private per-person contact directory (phone / WeChat / email). RLS returns only
      // rows the viewer may see (admins, or the linked member's own), so anon gets nothing.
      try {
        LINEAGE.persons.forEach(p => { delete p.contact; });
        const { data: ct } = await sb.from("contacts").select("*");
        (ct || []).forEach(c => {
          const p = LINEAGE.persons.find(x => x.id === c.person_id);
          if (p) p.contact = { phone: c.phone, wechat: c.wechat, email: c.email, address: c.address };
        });
      } catch (_) { /* contacts not migrated yet — skip */ }
      // Member-tier photos live in the private bucket and carry only a path. Mint
      // short-lived signed URLs so they display for signed-in family; anonymous
      // visitors never receive these rows (media RLS), so this stays empty for them.
      const privRows = (md.data || []).filter(m => m.private_path);
      if (privRows.length) {
        try {
          const { data: signed } = await sb.storage.from("photos-private")
            .createSignedUrls(privRows.map(m => m.private_path), 3600);
          (signed || []).forEach((s, i) => { if (s && s.signedUrl) privRows[i].url = s.signedUrl; });
        } catch (e) { console.warn("signed photo urls failed", e); }
      }
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
      clearPyCache();                            // names may have changed — rebuild on demand
      Tree.render("#tree-canvas", openPerson);   // re-index + redraw with merged data
      if (window.MapView && MapView.refresh) MapView.refresh();
      updateVerifyCount();
    } catch (e) { console.warn("live data load failed", e); }
  }

  /* ---- Visitor counter (header "👁 N") ----------------------------------- */
  // Bumped once per browser session (sessionStorage guard); otherwise we just read
  // the current value, so a refresh isn't counted as a new visit. Anonymous visitors
  // are counted too (the bump RPC is granted to anon). See supabase/migration_v11.sql.
  let visitCount = null;
  function renderVisitCount() {
    const el = $("#visit-count");
    if (!el || visitCount == null) return;
    const n = Number(visitCount), num = n.toLocaleString();
    const label = I18N.getLang() === "zh" ? `瀏覽 ${num} 次` : `${num} ${n === 1 ? "visit" : "visits"}`;
    el.innerHTML = `👁 <span class="vc-num">${num}</span>`;
    el.title = label;
    el.setAttribute("aria-label", label);
    el.hidden = false;
  }
  async function loadVisitorCount() {
    if (!Auth.LIVE) return;
    const sb = Auth.client(); if (!sb) return;
    try {
      let fresh = false;
      try { fresh = !sessionStorage.getItem("zupu_visited"); } catch (_) { /* private mode */ }
      if (fresh) {
        const { data, error } = await sb.rpc("bump_counter", { k: "site_visits" });
        if (!error && data != null) {
          visitCount = data;
          try { sessionStorage.setItem("zupu_visited", "1"); } catch (_) { /* ignore */ }
        }
      }
      if (visitCount == null) {
        const { data } = await sb.from("counters").select("value").eq("key", "site_visits").maybeSingle();
        if (data) visitCount = data.value;
      }
      if (visitCount != null) renderVisitCount();
    } catch (e) { console.warn("visit count failed", e); }
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
    if (subject.placeId) {
      // place photos are public → public bucket, public URL (unchanged)
      const path = "places/" + key + "/" + Date.now() + "_" + safe;
      const up = await sb.storage.from("photos").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const url = sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
      const ins = await sb.from("media").insert({ place_id: subject.placeId, url, uploaded_by: st.user.id, visibility: "public" });
      if (ins.error) throw ins.error;
    } else {
      // person photos are member-tier → PRIVATE bucket; store only the path, mint a
      // signed URL at display time so the file is never publicly reachable.
      const path = key + "/" + Date.now() + "_" + safe;
      const up = await sb.storage.from("photos-private").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const ins = await sb.from("media").insert({ person_id: subject.personId, private_path: path, url: "", uploaded_by: st.user.id, visibility: "member" });
      if (ins.error) throw ins.error;
    }
  }
  const uploadPhoto = (personId, file) => uploadMedia({ personId }, file);

  // Upload a photo chosen on the CONTRIBUTION form (the person doesn't exist yet, so we
  // can't insert a media row). Store the file in the public photos bucket and return its
  // URL; an editor links it to the new person on approval (see attachContribPhoto).
  async function uploadContributionPhoto(file) {
    const sb = Auth.client(), st = Auth.state();
    if (!sb || !st.user) throw new Error("Sign in to upload a photo.");
    file = await downscaleImage(file);
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const path = "contrib/" + st.user.id + "/" + Date.now() + "_" + safe;
    const up = await sb.storage.from("photos").upload(path, file, { upsert: false });
    if (up.error) throw up.error;
    return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
  }
  window.uploadContributionPhoto = uploadContributionPhoto;

  // Anonymous contributors can't write to storage (RLS), so embed the downscaled photo as
  // a data URL inside the contribution payload. Contributions are admin-only to READ, so
  // the unvetted image is never publicly reachable; the editor uploads it on approval.
  async function fileToContribImage(file) {
    const small = await downscaleImage(file, 1280, 0.8);
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(small);
    });
  }
  window.fileToContribImage = fileToContribImage;

  // Bridge for the contribution form's "Pick on map": switch to the map, run the shared
  // picker (search + drop pin), then return to the form. Resolves {lat,lng} or null.
  async function contribPickLocation(opts) {
    show("map");
    const coords = await MapView.pickLocation({ name: (opts && opts.name) || (I18N.t("f_pin_new")) });
    show("contribute");
    return coords;
  }
  window.contribPickLocation = contribPickLocation;

  // On approval, link a contributed photo to the (now-created) person as an approved media
  // row so it shows on the tree/drawer. `photo` is either an http(s) URL (signed-in
  // contributor uploaded it at submit) or a data: URL (anonymous contributor embedded it),
  // which the admin now uploads to storage. Best-effort: a photo hiccup must not undo an
  // otherwise-good approval, so failures warn rather than throw.
  async function attachContribPhoto(personId, photo, visibility) {
    if (!photo) return;
    const sb = Auth.client(), st = Auth.state();
    if (!sb || !st.user) return;
    const tier = visibility || "member";
    try {
      // Get the image bytes whether it arrived as a data: URL (anonymous embed) or an
      // http URL pointing at the pending file in the public bucket (signed-in upload).
      const toBlob = async () => {
        if (/^data:/.test(photo) || /^https?:\/\//.test(photo)) return await (await fetch(photo)).blob();
        return null;
      };
      if (tier === "member") {
        // member-tier → store in the PRIVATE bucket, keep only the path
        const blob = await toBlob();
        if (!blob) return;
        const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
        const path = personId + "/" + Date.now() + "_contrib." + ext;
        const up = await sb.storage.from("photos-private").upload(path, blob, { upsert: false, contentType: blob.type });
        if (up.error) throw up.error;
        // remove the pending public-bucket copy if this came from a signed-in upload
        if (/^https?:\/\//.test(photo)) {
          const pub = decodeURIComponent((String(photo).split("/photos/")[1] || "").split("?")[0]);
          if (pub) sb.storage.from("photos").remove([pub]).catch(() => {});
        }
        const { error } = await sb.from("media").insert({
          person_id: personId, private_path: path, url: "", uploaded_by: st.user.id,
          approved: true, visibility: "member"
        });
        if (error) throw error;
      } else {
        // public tier (e.g. a deceased ancestor's portrait) → public bucket, public URL
        let url = photo;
        if (/^data:/.test(photo)) {
          const blob = await (await fetch(photo)).blob();
          const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
          const path = personId + "/" + Date.now() + "_contrib." + ext;
          const up = await sb.storage.from("photos").upload(path, blob, { upsert: false, contentType: blob.type });
          if (up.error) throw up.error;
          url = sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
        } else if (!/^https?:\/\//.test(photo)) {
          return;   // not a URL or data URL — ignore
        }
        const { error } = await sb.from("media").insert({
          person_id: personId, url, uploaded_by: st.user.id, approved: true, visibility: "public"
        });
        if (error) throw error;
      }
    } catch (e) { console.warn("contrib photo link failed", e); }
  }

  // On approval, save the person's own private contact details (phone / WeChat / email)
  // into the `contacts` table — a family directory gated by RLS to admins + the linked
  // member. Only provided fields are written, so a blank field never wipes an existing one.
  async function attachContribContact(personId, payload) {
    const row = { person_id: personId };
    if (payload.personPhone)  row.phone  = payload.personPhone;
    if (payload.personWechat) row.wechat = payload.personWechat;
    if (payload.personEmail)  row.email  = payload.personEmail;
    if (Object.keys(row).length === 1) return;   // nothing but the id → skip
    const sb = Auth.client();
    const { error } = await sb.from("contacts").upsert(row);
    if (error) console.warn("contrib contact save failed", error);
  }

  async function approvePhoto(mediaId) {
    const sb = Auth.client();
    const { error } = await sb.from("media").update({ approved: true }).eq("id", mediaId);
    if (error) { alert("Failed: " + error.message); return; }
    await loadLiveData();
  }
  // Remove a photo: best-effort delete of the storage object (the owner may delete
  // it per RLS; an admin removing someone else's only deletes the row), then the
  // media row (uploader or admin, per the media_delete policy).
  async function deletePhoto(m) {
    const sb = Auth.client();
    try {
      if (m.private_path) {
        await sb.storage.from("photos-private").remove([m.private_path]);
      } else {
        const path = decodeURIComponent((String(m.url).split("/photos/")[1] || "").split("?")[0]);
        if (path) await sb.storage.from("photos").remove([path]);
      }
    } catch (e) { console.warn("storage remove failed", e); }
    const { error } = await sb.from("media").delete().eq("id", m.id);
    if (error) throw error;
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

  // Map a person onto the contribution form's field names so "Suggest a correction"
  // opens pre-filled instead of blank. Place fields are stored as ids, so resolve them
  // to the human place name the freetext input expects.
  function personPrefill(p) {
    const placeName = pid => { const pl = pid && placeById(pid); return pl ? pl.name : ""; };
    return {
      action: "edit",
      relatedTo: p.id,
      name: p.name || "",
      pinyin: p.pinyin || "",
      ritualName: p.ritualName || "",
      milkName: p.milkName || "",
      aka: p.aka || "",
      gender: p.gender === "f" ? "f" : "m",
      gen: p.gen != null ? p.gen : "",
      living: p.living ? "true" : "false",
      birth: p.birthYear || "",
      place: placeName(p.birthPlace) || placeName(p.residencePlace) || "",
      bio: p.bio || "",
      lat: p.lat != null ? p.lat : "",
      lng: p.lng != null ? p.lng : "",
      // private contact directory — prefilled so an edit keeps phone/WeChat/email
      personPhone: (p.contact && p.contact.phone) || "",
      personWechat: (p.contact && p.contact.wechat) || "",
      personEmail: (p.contact && p.contact.email) || ""
    };
  }

  // Snapshot an in-memory (seed) person into a live persons-table row. Used whenever a
  // seed-only ancestor first needs a DB row — approved edits and admin verification.
  // undefined fields are dropped so we never send columns the row doesn't have a value for.
  // Generation implied by an add: child → one below the parent, spouse → level with
  // them. Falls back to the submitted number only when the relative has none.
  function relGen(action, relatedTo, submitted) {
    const rel = relatedTo ? personById(relatedTo) : null;
    if (rel && rel.gen != null) return action === "add_spouse" ? rel.gen : rel.gen + 1;
    return submitted ? parseInt(submitted, 10) : null;
  }

  function seedPersonRow(p) {
    const row = {
      id: p.id, name: p.name, gen: p.gen, pinyin: p.pinyin,
      ritual_name: p.ritualName, formal_name: p.formalName, hao: p.hao,
      milk_name: p.milkName, aka: p.aka,
      gender: p.gender, father_id: p.father, spouse_of: p.spouseOf,
      birth_year: p.birthYear, death_year: p.deathYear, lifespan: p.lifespan,
      religion: p.religion, relation: p.relation, bio: p.bio,
      birth_place: p.birthPlace, residence_place: p.residencePlace,
      burial_place: p.burialPlace, lat: p.lat, lng: p.lng, living: !!p.living,
      visibility: p.living ? "member" : "public",
      confidence: p.confidence || "low", source: "contribution"
    };
    Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
    return row;
  }

  /* ---- Admin person tools: move · merge · archive -------------------------
   * These exist because corrections kept landing on the wrong ancestor and the
   * only repair was hand-written SQL. All three write through writePerson(),
   * which updates a live row if there is one and otherwise inserts a snapshot of
   * the seed person with the change on top — the same update-or-insert the
   * approve path uses, so people who live only in data/lineage.js are editable.
   * ------------------------------------------------------------------------ */

  // Update-or-insert one person's fields. Returns nothing; throws on failure.
  async function writePerson(id, fields) {
    const sb = Auth.client(); if (!sb) throw new Error("not connected");
    const { data, error } = await sb.from("persons").update(fields).eq("id", id).select();
    if (error) throw error;
    if (data && data.length) return;
    const p = personById(id);
    if (!p) throw new Error("Unknown person: " + id);
    const row = seedPersonRow(p);
    Object.assign(row, fields);
    const { error: insErr } = await sb.from("persons").upsert(row);
    if (insErr) throw insErr;
  }

  // Everyone descending from id, nearest first. Blood links only (spouses carry
  // their partner's generation and are handled where they are written).
  function descendantsOf(id) {
    const out = [], queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      LINEAGE.persons.filter(p => p.father === cur && !p.spouseOf).forEach(k => {
        out.push(k); queue.push(k.id);
      });
    }
    return out;
  }

  // After a move, every descendant's generation shifts by the same amount, and so
  // does each of their spouses. Returns how many rows were rewritten.
  async function cascadeGen(rootId, delta) {
    if (!delta) return 0;
    const kin = descendantsOf(rootId);
    LINEAGE.persons.forEach(sp => {
      if (sp.spouseOf && (sp.spouseOf === rootId || kin.some(k => k.id === sp.spouseOf))) kin.push(sp);
    });
    let n = 0;
    for (const k of kin) {
      if (k.gen == null) continue;
      await writePerson(k.id, { gen: k.gen + delta });
      n++;
    }
    return n;
  }

  // A <select> of everyone, generation-ordered, for the move / merge pickers.
  function personPickerOptions(excludeId) {
    return LINEAGE.persons
      .filter(p => p.id !== excludeId)
      .slice()
      .sort((a, b) => (a.gen || 0) - (b.gen || 0) || String(a.name).localeCompare(String(b.name)))
      .map(p => `<option value="${p.id}">${p.gen != null ? "第" + p.gen + "世 · " : ""}${esc(p.name)}${p.pinyin ? " " + esc(p.pinyin) : ""}</option>`)
      .join("");
  }

  // Fill every {placeholder} in a phrase — String.replace() only does the first.
  function fill(str, vals) {
    return Object.keys(vals).reduce((out, k) => out.split("{" + k + "}").join(vals[k]), String(str));
  }

  // Generation implied by a relationship, or null when it can't be worked out.
  function genFor(relationship, target) {
    if (!target || target.gen == null) return null;
    if (relationship === "child") return target.gen + 1;
    if (relationship === "parent") return target.gen - 1;
    return target.gen;                                  // spouse and sibling sit level
  }

  // Panel shown inside the drawer by the three admin buttons.
  function adminToolPanel(mode, p) {
    const T = I18N.t;
    if (mode === "move") {
      return `<div class="admin-tool" id="admin-tool">
        <div class="field-section">${T("at_move_h")}</div>
        <p class="muted">${fill(T("at_move_intro"), { name: esc(p.name) })}</p>
        <label>${T("at_rel")}
          <select id="at-rel">
            <option value="child">${T("at_rel_child")}</option>
            <option value="spouse">${T("at_rel_spouse")}</option>
            <option value="sibling">${T("at_rel_sibling")}</option>
          </select>
        </label>
        <label>${T("at_person")}<select id="at-target">${personPickerOptions(p.id)}</select></label>
        <p class="at-preview" id="at-preview"></p>
        <div class="admin-tool-actions">
          <button class="action" id="at-apply">${T("at_apply")}</button>
          <button class="action ghost" id="at-cancel">${T("at_cancel")}</button>
        </div>
      </div>`;
    }
    if (mode === "merge") {
      return `<div class="admin-tool" id="admin-tool">
        <div class="field-section">${T("at_merge_panel_h")}</div>
        <p class="muted">${fill(T("at_merge_intro"), { name: esc(p.name) })}</p>
        <label>${fill(T("at_merge_pick"), { name: esc(p.name) })}<select id="at-target">${personPickerOptions(p.id)}</select></label>
        <p class="at-preview" id="at-preview"></p>
        <div class="admin-tool-actions">
          <button class="action" id="at-apply">${T("at_merge_apply")}</button>
          <button class="action ghost" id="at-cancel">${T("at_cancel")}</button>
        </div>
      </div>`;
    }
    const kids = LINEAGE.persons.filter(x => (x.father === p.id || x.spouseOf === p.id));
    return `<div class="admin-tool" id="admin-tool">
      <div class="field-section">${T("at_arch_panel_h")}</div>
      <p class="muted">${fill(T("at_arch_intro"), { name: esc(p.name) })}</p>
      ${kids.length ? `<p class="at-warn">${fill(T("at_arch_warn"), { n: kids.length })}<br>${kids.slice(0, 8).map(k => esc(k.name)).join("、")}${kids.length > 8 ? "…" : ""}</p>` : ""}
      <label>${T("at_arch_reason")}<input id="at-reason" placeholder="${T("at_arch_reason_ph")}"></label>
      <div class="admin-tool-actions">
        <button class="action danger" id="at-apply">${T("at_arch_apply")}</button>
        <button class="action ghost" id="at-cancel">${T("at_cancel")}</button>
      </div>
    </div>`;
  }

  function openAdminTool(mode, id) {
    const p = personById(id); if (!p) return;
    const T = I18N.t;
    const host = $("#drawer-body");
    const existing = $("#admin-tool"); if (existing) existing.remove();
    host.insertAdjacentHTML("beforeend", adminToolPanel(mode, p));
    const panel = $("#admin-tool");
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const sel = $("#at-target"), rel = $("#at-rel"), prev = $("#at-preview");

    function refresh() {
      if (!prev) return;
      const t = personById(sel.value);
      if (!t) { prev.textContent = ""; return; }
      if (mode === "move") {
        // Refuse a move that would put someone under their own descendant before the
        // admin commits to it, rather than only failing on apply.
        if (descendantsOf(p.id).some(d => d.id === t.id)) {
          prev.innerHTML = `<span class="at-warn-inline">${T("at_err_loop")}</span>`;
          return;
        }
        const g = genFor(rel.value, t);
        if (g == null) { prev.textContent = T("at_prev_nogen"); return; }
        const delta = p.gen == null ? 0 : g - p.gen;
        const kin = descendantsOf(p.id).length;
        prev.innerHTML = fill(T("at_prev_move"), { name: esc(p.name), gen: g, was: p.gen == null ? "—" : p.gen })
          + (delta && kin ? "<br>" + fill(T("at_prev_cascade"), { n: kin, d: delta > 0 ? "+" + delta : delta }) : "");
      } else if (mode === "merge") {
        const moving = LINEAGE.persons.filter(x => x.father === t.id || x.spouseOf === t.id).length;
        prev.innerHTML = fill(T("at_prev_merge"), { dup: esc(t.name), keep: esc(p.name), n: moving });
      }
    }
    if (sel) sel.onchange = refresh;
    if (rel) rel.onchange = refresh;
    refresh();

    $("#at-cancel").onclick = () => panel.remove();
    $("#at-apply").onclick = async () => {
      const btn = $("#at-apply"); btn.disabled = true; btn.textContent = T("at_working");
      try {
        if (mode === "move") await applyMove(p, rel.value, sel.value);
        else if (mode === "merge") await applyMerge(p, sel.value);
        else await applyArchive(p, ($("#at-reason") || {}).value || null);
        await loadLiveData();
        if (mode === "archive") { closeDrawer(); }
        else openPerson(p.id);
      } catch (e) {
        alert(T("at_failed") + (e.message || e));
        btn.disabled = false; btn.textContent = T("at_apply");
      }
    };
  }

  async function applyMove(p, relationship, targetId) {
    const t = personById(targetId);
    if (!t) throw new Error("pick someone first");
    if (descendantsOf(p.id).some(d => d.id === targetId))
      throw new Error(I18N.t("at_err_loop"));
    const g = genFor(relationship, t);
    const fields = { gen: g };
    if (relationship === "child")        { fields.father_id = t.id; fields.spouse_of = null; }
    else if (relationship === "spouse")  { fields.spouse_of = t.id; fields.father_id = null; }
    else if (relationship === "sibling") { fields.father_id = t.father || null; fields.spouse_of = null; }
    const delta = (g == null || p.gen == null) ? 0 : g - p.gen;
    await writePerson(p.id, fields);
    if (delta) await cascadeGen(p.id, delta);
  }

  // Fold `dupId` into `keep`: everything hanging off the duplicate is re-pointed
  // at the survivor, then the duplicate is archived (never deleted — if the merge
  // was wrong, restoring it brings the record back).
  async function applyMerge(keep, dupId) {
    const sb = Auth.client(); if (!sb) throw new Error("not connected");
    const dup = personById(dupId);
    if (!dup) throw new Error("pick someone first");
    if (keep.id === dupId) throw new Error("same person");
    for (const k of LINEAGE.persons.filter(x => x.father === dupId && !x.spouseOf))
      await writePerson(k.id, { father_id: keep.id });
    for (const sp of LINEAGE.persons.filter(x => x.spouseOf === dupId))
      await writePerson(sp.id, { spouse_of: keep.id });
    // carry photos, private details and contacts across; ignore what isn't there
    for (const tbl of [["media", "person_id"], ["person_details", "person_id"], ["contacts", "person_id"]]) {
      try { await sb.from(tbl[0]).update({ [tbl[1]]: keep.id }).eq(tbl[1], dupId); } catch (_) { /* table absent or nothing to move */ }
    }
    await applyArchive(dup, "merged into " + keep.id + " (" + keep.name + ")");
  }

  async function applyArchive(p, reason) {
    const me = Auth.state();
    await writePerson(p.id, {
      archived: true,
      archived_at: new Date().toISOString(),
      archived_by: me.user ? me.user.id : null,
      archived_reason: reason || null
    });
  }

  async function restorePerson(id) {
    try {
      await writePerson(id, { archived: false, archived_at: null, archived_by: null, archived_reason: null });
      await loadLiveData();
      await buildArchivedList();
    } catch (e) { alert(I18N.t("at_failed") + (e.message || e)); }
  }

  // Archived people are filtered out of the tree, so read them straight from the
  // table (RLS returns them to admins only).
  async function buildArchivedList() {
    const host = $("#archived-list"); if (!host) return;
    const sb = Auth.client();
    if (!sb) { host.innerHTML = ""; return; }
    const [{ data }, mem] = await Promise.all([
      sb.from("persons").select("*").eq("archived", true),
      sb.from("members_admin").select("id, email, full_name")
    ]);
    const byId = {};
    (mem && mem.data || []).forEach(m => { byId[m.id] = m.full_name || m.email || m.id; });
    const rows = data || [];
    host.innerHTML = rows.length
      ? rows.map(r => {
          // Who removed this, and when — the same accountability the review log has.
          const who = r.archived_by ? esc(byId[r.archived_by] || r.archived_by.slice(0, 8) + "…") : null;
          const when = r.archived_at ? new Date(r.archived_at).toLocaleDateString() : null;
          const trail = who || when
            ? `<br><span class="muted">${fill(I18N.t("at_arch_by"), { who: who || "—", when: when || "—" })}</span>`
            : "";
          return `<div class="arch-row">
            <span><b>${esc(r.name)}</b> ${r.pinyin ? esc(r.pinyin) : ""} ${r.gen != null ? "· 第" + r.gen + "世" : ""}
            ${r.archived_reason ? `<br><span class="muted">${esc(r.archived_reason)}</span>` : ""}${trail}</span>
            <button class="action" data-restore="${r.id}">${I18N.t("at_restore")}</button>
          </div>`;
        }).join("")
      : `<p class="muted">${I18N.t("at_none")}</p>`;
    $$("#archived-list [data-restore]").forEach(b => b.onclick = () => restorePerson(b.dataset.restore));
  }

  // Clear a person's ⚠ "needs verification" badge by lifting confidence to "high".
  // Works in both admin modes: a signed-in Supabase admin writes it to the live DB
  // (update-or-insert, same as approved edits); ?admin=1 records it into the committed
  // overrides.js export, matching the existing candidate-pick flow.
  async function markVerified(id) {
    const p = personById(id); if (!p) return;
    const me = Auth.state();
    if (me.isAdmin && Auth.LIVE && Auth.client()) {
      const sb = Auth.client();
      try {
        const { data, error } = await sb.from("persons")
          .update({ confidence: "high" }).eq("id", id).select();
        if (error) throw error;
        if (!data || data.length === 0) {              // seed-only person: insert a snapshot
          const row = seedPersonRow(p); row.confidence = "high";
          const { error: insErr } = await sb.from("persons").upsert(row);
          if (insErr) throw insErr;
        }
        await loadLiveData();                          // re-renders the tree, refreshes the count
        openPerson(id);                                // rebuild drawer → badge + button gone
      } catch (e) { alert(I18N.t("d_verify_fail") + (e.message || e)); }
      return;
    }
    if (ADMIN) {
      pending[id] = Object.assign(pending[id] || {}, { confidence: "high" });
      applyOverride(id, { confidence: "high" });
      Tree.setOptions({});                             // redraw without the low-confidence styling
      openPerson(id);
      refreshAdminBar();                               // enable the overrides.js download
      updateVerifyCount();
      if ($("#verify-panel").classList.contains("open")) buildVerifyList();
    }
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
          ${(me.isAdmin || (me.user && m.uploaded_by === me.user.id)) ? `<button class="del" data-del-photo="${m.id}" title="${T("d_remove")}">✕</button>` : ""}
          ${m.cover ? `<span class="cover-badge" title="${T("d_cover")}">★</span>` : ""}
          ${!m.approved
            ? `<figcaption class="pending">${me.isAdmin ? `<button data-approve-photo="${m.id}">${T("d_approve")}</button>` : T("d_pending")}</figcaption>`
            : (me.isAdmin && !m.cover ? `<figcaption class="setcover"><button data-cover="${m.id}">${T("d_setcover")}</button></figcaption>` : "")}
        </figure>`).join("") + `</div>`;
    }
    // private contact directory — present only when RLS let this viewer load it
    let contactHtml = "";
    if (p.contact && (p.contact.phone || p.contact.wechat || p.contact.email)) {
      const cr = [];
      if (p.contact.phone)  cr.push(`<div class="row"><span class="k">${T("d_phone")}</span><span>${esc(p.contact.phone)}</span></div>`);
      if (p.contact.wechat) cr.push(`<div class="row"><span class="k">${T("d_wechat")}</span><span>${esc(p.contact.wechat)}</span></div>`);
      if (p.contact.email)  cr.push(`<div class="row"><span class="k">${T("d_email")}</span><span>${esc(p.contact.email)}</span></div>`);
      contactHtml = `<div class="field-section">${T("d_contact")}</div>${cr.join("")}`;
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
      ${contactHtml}
      ${(p.confidence === "low" && (ADMIN || me.isAdmin)) ? `<button class="action verify-action" data-verify="${p.id}">${T("d_verify")}</button>` : ""}
      <button class="action" data-edit="${p.id}">${T("d_suggest")}</button>
      ${me.isAdmin ? `
        <div class="field-section">${T("at_section")}</div>
        <div class="admin-tools">
          <button class="action" data-tool="move" data-id="${p.id}">${T("at_move")}</button>
          <button class="action" data-tool="merge" data-id="${p.id}">${T("at_merge")}</button>
          <button class="action danger" data-tool="archive" data-id="${p.id}">${T("at_arch")}</button>
        </div>` : ""}
    `;
    $$("#drawer-body [data-go]").forEach(a => a.onclick = () => { openPerson(a.dataset.go); Tree.focus(a.dataset.go); });
    const vBtn = $("#drawer-body [data-verify]");
    if (vBtn) vBtn.onclick = () => markVerified(p.id);
    $$("#drawer-body [data-tool]").forEach(b =>
      b.onclick = () => openAdminTool(b.dataset.tool, b.dataset.id));
    $("#drawer-body [data-edit]").onclick = () => {
      Contribute.prefill(personPrefill(p));   // carry this person's data into the form
      closeDrawer();
      show("contribute");
    };
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
    if (me.user) $$("#drawer-body [data-del-photo]").forEach(b =>
      b.onclick = async () => {
        if (!confirm(I18N.t("d_delconfirm"))) return;
        const m = photos.find(x => String(x.id) === b.dataset.delPhoto);
        b.disabled = true;
        try { await deletePhoto(m); openPerson(p.id); }
        catch (err) { alert(I18N.t("d_delfail") + (err.message || err)); b.disabled = false; }
      });
    $("#drawer").classList.add("open");
    $("#drawer-scrim").classList.add("open");
    pushNav();
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

    const hasCoords = typeof pl.lat === "number" && typeof pl.lng === "number"
      && !isNaN(pl.lat) && !isNaN(pl.lng);
    const photos = mediaByPlace[pl.id] || [];
    let photoHtml = "";
    if (photos.length) {
      photoHtml = `<div class="field-section">${T("pl_photos")}</div><div class="photo-grid">` +
        photos.map(m => `<figure class="photo"><img src="${m.url}" alt="" loading="lazy">
          ${(me.isAdmin || (me.user && m.uploaded_by === me.user.id)) ? `<button class="del" data-del-photo="${m.id}" title="${T("d_remove")}">✕</button>` : ""}
          ${!m.approved ? `<figcaption class="pending">${me.isAdmin ? `<button data-approve-photo="${m.id}">${T("d_approve")}</button>` : T("d_pending")}</figcaption>` : ""}
        </figure>`).join("") + `</div>`;
    }

    $("#drawer-body").innerHTML = `
      <h2>${pl.name}</h2>
      <div class="pin-name">${pl.nameEn || ""}</div>
      <div>${!hasCoords
        ? `<span class="badge low">${T("pl_noloc")}</span>`
        : pl.approximate
          ? `<span class="badge low">${T("pl_approx_warn")}</span>`
          : `<span class="badge verified">${T("pl_verified")}</span>`}</div>
      ${!hasCoords ? `<p class="muted">${T("pl_noloc_hint")}</p>` : ""}
      ${pl.note ? `<div class="bio">${pl.note}</div>` : ""}
      ${rows.join("")}
      ${photoHtml}
      <button class="action" id="place-pin">${T("pl_suggest_loc")}</button>
      ${me.user
        ? (photos.length >= 5
            ? `<p class="muted">${T("d_maxphotos")}</p>`
            : `<button class="action" id="place-photo">${T("pl_addphoto")}</button><input type="file" id="place-file" accept="image/*" hidden>`)
        : ""}
      ${hasCoords ? `<button class="action" id="place-map">${T("pl_view_map")}</button>` : ""}
    `;
    $$("#drawer-body [data-go]").forEach(a => a.onclick = () => { openPerson(a.dataset.go); Tree.focus(a.dataset.go); });
    if (me.isAdmin) $$("#drawer-body [data-approve-photo]").forEach(b =>
      b.onclick = async () => { await approvePhoto(b.dataset.approvePhoto); openPlace(pl.id); });
    if (me.user) $$("#drawer-body [data-del-photo]").forEach(b =>
      b.onclick = async () => {
        if (!confirm(I18N.t("d_delconfirm"))) return;
        const m = photos.find(x => String(x.id) === b.dataset.delPhoto);
        b.disabled = true;
        try { await deletePhoto(m); openPlace(pl.id); }
        catch (err) { alert(I18N.t("d_delfail") + (err.message || err)); b.disabled = false; }
      });
    $("#place-pin").onclick = () => suggestLocation(pl);
    const mapBtn = $("#place-map");                 // absent when the spot is unknown
    if (mapBtn) mapBtn.onclick = () => { closeDrawer(); show("map"); };
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
    pushNav();
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

  /* ---- CSV export ----------------------------------------------------------
   * Exports exactly what the current viewer is already allowed to see. The rows are
   * built from LINEAGE.persons, which RLS has already filtered on the way in: an
   * anonymous visitor gets the deceased public tree, a signed-in member also gets
   * living relatives' names and positions, an approved member their birth years and
   * bios. Private contact details are admin-only and are left out unless the viewer
   * is an admin — a spreadsheet is easy to forward, so it should not be the one place
   * that quietly widens who can read a phone number.
   * ------------------------------------------------------------------------ */
  const CSV_COLS = [
    ["id",          p => p.id],
    ["generation",  p => p.gen],
    ["name",        p => p.name],
    ["romanization", p => p.pinyin],
    ["ritual_name", p => p.ritualName],
    ["formal_name", p => p.formalName],
    ["style_hao",   p => [p.style, p.hao].filter(Boolean).join(" / ")],
    ["milk_name",   p => p.milkName],
    ["also_known_as", p => p.aka],
    ["gender",      p => p.gender === "f" ? "female" : "male"],
    ["living",      p => p.living ? "yes" : "no"],
    ["relation",    p => p.relation],
    ["father_id",   p => p.father],
    ["father_name", p => { const f = p.father && personById(p.father); return f ? f.name : ""; }],
    ["spouse_of_id", p => p.spouseOf],
    ["spouse_of_name", p => { const f = p.spouseOf && personById(p.spouseOf); return f ? f.name : ""; }],
    ["spouse_name", p => { const sp = Tree.spouseFor(p.id); return sp ? sp.name : ""; }],
    ["children",    p => LINEAGE.persons.filter(k => k.father === p.id && !k.spouseOf)
                          .map(k => k.name).join("; ")],
    ["birth_year",  p => p.birthYear],
    ["death_year",  p => p.deathYear],
    ["lifespan",    p => p.lifespan],
    ["married_out", p => p.marriedOut],
    ["religion",    p => p.religion],
    ["birth_place", p => placeName(p.birthPlace)],
    ["residence_place", p => placeName(p.residencePlace)],
    ["burial_place", p => placeName(p.burialPlace)],
    ["confidence",  p => p.confidence],
    ["bio",         p => p.bio],
    ["note",        p => p.note]
  ];
  const CSV_CONTACT_COLS = [
    ["phone",  p => p.contact && p.contact.phone],
    ["wechat", p => p.contact && p.contact.wechat],
    ["email",  p => p.contact && p.contact.email],
    ["address", p => p.contact && p.contact.address]
  ];
  function placeName(id) { const pl = id && placeById(id); return pl ? pl.name : ""; }

  // Quote per RFC 4180, and defuse anything a spreadsheet would run as a formula:
  // a leading = + - @ turns the cell into an expression in Excel and Sheets.
  function csvCell(v) {
    let t = v == null ? "" : String(v);
    if (/^[=+\-@]/.test(t)) t = "'" + t;
    return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }
  function buildCsv() {
    const cols = Auth.state().isAdmin ? CSV_COLS.concat(CSV_CONTACT_COLS) : CSV_COLS;
    const rows = LINEAGE.persons.slice().sort((a, b) =>
      (a.gen || 0) - (b.gen || 0) || String(a.name).localeCompare(String(b.name)));
    const lines = [cols.map(c => csvCell(c[0])).join(",")];
    rows.forEach(p => lines.push(cols.map(c => {
      let v; try { v = c[1](p); } catch (_) { v = ""; }
      return csvCell(v);
    }).join(",")));
    return lines.join("\r\n");
  }
  function exportCsv() {
    // The BOM is what makes Excel read the Chinese as UTF-8 instead of mojibake.
    const blob = new Blob(["\uFEFF" + buildCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date(), pad = n => String(n).padStart(2, "0");
    a.href = url;
    a.download = `kong-zupu-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---- Search (live autocomplete dropdown) ----------------------------------
   * Stored romanisations are HAKKA — "Nyiap Len", "Fui Chung", "Yit Sin" — because
   * that is how the Sabah family spells its own names. A relative who only knows
   * Mandarin pinyin would type "ye" and find nothing, though 業 is right there. So
   * alongside the stored fields we index the Mandarin reading of every Chinese
   * character (data/pinyin.js, loaded on first keystroke) and match against that too.
   * Comparing both sides as pinyin also makes 业 find 業 without a
   * simplified↔traditional conversion table.
   * ------------------------------------------------------------------------- */
  const SEARCH_FIELDS = ["name", "pinyin", "ritualName", "ritualPinyin", "style", "formalName", "hao", "milkName", "aka"];
  const CN_FIELDS = ["name", "ritualName", "style", "formalName", "hao", "milkName", "aka"];
  const HAN = /[\u3400-\u9fff]/;
  const SEARCH_LIMIT = 20;
  let searchMatches = [], searchActive = -1;

  // char → [readings]. Null until data/pinyin.js has loaded; every pinyin path is a
  // no-op before then, so search keeps working on the stored fields alone.
  let pyChar = null, pyLoading = null;
  function loadPinyin() {
    if (pyChar || pyLoading) return pyLoading || Promise.resolve(pyChar);
    pyLoading = new Promise(resolve => {
      const el = document.createElement("script");
      el.src = "data/pinyin.js";
      el.onload = () => {
        const m = {};
        Object.keys(window.PY_GROUPS || {}).forEach(syl => {
          for (const ch of window.PY_GROUPS[syl]) (m[ch] = m[ch] || []).push(syl);
        });
        pyChar = m;
        pyCache = {};                       // index was built without readings — redo it
        if ($("#search") && $("#search").value.trim()) renderSearch($("#search").value);
        resolve(pyChar);
      };
      el.onerror = () => { pyChar = {}; resolve(pyChar); };   // degrade quietly
      document.head.appendChild(el);
    });
    return pyLoading;
  }

  // Per-person index, rebuilt whenever the live data reloads (clearPyCache()).
  //   join     first reading of each char, run together   → 惠良 "huiliang"
  //   bag      every reading of every char, space-delimited → " hui liang "
  //   initials first letters of the first readings          → "hl"
  //   display  first readings, spaced, for the dropdown     → "hui liang"
  let pyCache = {};
  function clearPyCache() { pyCache = {}; }
  function pyIndex(p) {
    if (pyCache[p.id]) return pyCache[p.id];
    const join = [], bag = new Set(), initials = [], display = [];
    // The stored romanisations are spaced ("Yik Liang", "Fui Leong"), so someone typing
    // them as one word found nothing. Index them stripped as well.
    const romanRaw = SEARCH_FIELDS.map(f => p[f] || "").join(" ");
    const roman = romanRaw.toLowerCase().replace(/[^a-z]/g, "");
    const foldTok = foldPhrase(romanRaw);          // ["matthew","fui","liong"]
    const fold = foldTok.join("");                 // "matthewfuiliong"
    if (pyChar) {
      for (const f of CN_FIELDS) {
        const v = p[f]; if (!v) continue;
        const parts = [];
        for (const ch of String(v)) {
          const rs = pyChar[ch];
          if (!rs || !rs.length) continue;
          rs.forEach(r => bag.add(r));
          parts.push(rs[0]);
          initials.push(rs[0][0]);
        }
        if (parts.length) { join.push(parts.join("")); if (f === "name") display.push(parts.join(" ")); }
      }
    }
    return (pyCache[p.id] = {
      roman, fold, foldTok,
      join: join.join(" "),
      bag: bag.size ? " " + [...bag].join(" ") + " " : "",
      initials: initials.join(""),
      display: display.join(" ")
    });
  }

  /* ---- Hakka spelling variants ---------------------------------------------
   * The same syllable is spelt a dozen ways across Malaysian family records —
   * Fui / Fooi, Siew / Siu / Xiu, Chung / Chong / Tsung, Nyuk / Ngiuk, Vun / Woon,
   * Yee / Yi. Nobody can be expected to guess which one an entry used, so both the
   * query and the stored spelling are folded to a rough phonetic key before they are
   * compared, and near-misses are allowed one typo on top of that.
   * The rules are deliberately loose: this is a 600-person family tree, so finding
   * cousins matters more than precision, and fuzzy hits rank below exact ones.
   * ------------------------------------------------------------------------ */
  function foldRoman(tok) {
    let s = String(tok).toLowerCase().replace(/[^a-z]/g, "");
    if (!s) return "";
    s = s.replace(/ch/g, "C");                     // protect ch before the c/k and s rules
    s = s.replace(/ph/g, "f").replace(/th/g, "t").replace(/kh/g, "k");
    s = s.replace(/zh|ts|tz|j|q/g, "C");           // tsun ↔ chun, pinyin ji/qi ↔ chi
    s = s.replace(/sh/g, "s").replace(/x/g, "s");  // shim ↔ sim, pinyin xiu ↔ siu
    s = s.replace(/ck/g, "k");
    s = s.replace(/v/g, "w");                      // vun ↔ wun
    s = s.replace(/ny|ngi/g, "ni");                // nyuk ↔ ngiuk
    s = s.replace(/oo/g, "u").replace(/ee|ea/g, "i");   // fooi → fui, yee → yi
    s = s.replace(/iew|ew/g, "iu").replace(/ei/g, "i"); // siew → siu, mei → mi
    s = s.replace(/eo|eu/g, "iu");                 // leong ↔ leung
    s = s.replace(/aw/g, "au").replace(/oy/g, "oi");
    s = s.replace(/h$/, "");                       // fah → fa, foh → fo
    s = s.replace(/(.)\1+/g, "$1");                // henn → hen
    return s.replace(/C/g, "ch");
  }
  function foldPhrase(str) {
    return String(str).toLowerCase().split(/[^a-z]+/i).filter(Boolean).map(foldRoman).filter(Boolean);
  }
  // One insertion, deletion or substitution apart — enough for chong/chung, kwok/kok,
  // yit/yet, without pulling in unrelated names.
  function nearMiss(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    if (a.length < 3 || b.length < 3) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length === b.length) { i++; j++; }
      else if (a.length > b.length) i++;
      else j++;
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }

  // A query may itself be Chinese (possibly the other script): read it as pinyin so it
  // can be compared with the index. Returns "" when nothing maps.
  function queryToPinyin(q) {
    if (!pyChar) return "";
    const out = [];
    for (const ch of q) {
      const rs = pyChar[ch];
      if (rs && rs.length) out.push(rs[0]);
    }
    return out.join("");
  }

  function searchHits(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    const latin = q.replace(/[^a-z]/g, "");          // "yong hong" / "yong-hong" → "yonghong"
    const qTok = foldPhrase(q);
    const qFold = { tok: qTok, join: qTok.join("") };
    const asPinyin = HAN.test(q) ? queryToPinyin(q) : "";
    const scored = [];
    for (const p of LINEAGE.persons) {
      let rank = 99;
      for (const f of SEARCH_FIELDS) {
        const v = p[f]; if (!v) continue;
        const idx = String(v).toLowerCase().indexOf(q);
        if (idx === 0) { rank = 0; break; }       // prefix match ranks first
        if (idx > 0) rank = Math.min(rank, 1);    // substring match
      }
      if (rank > 1 && latin) {
        const ix = pyIndex(p);
        if (ix.roman.startsWith(latin)) rank = 0;          // "yikliang" → "Yik Liang"
        else if (ix.roman.includes(latin)) rank = Math.min(rank, 1);
        else if (qFold.join) {
          // spelling variants: "fooi leong" → "Fui Leong"
          if (ix.fold.startsWith(qFold.join)) rank = Math.min(rank, 2);
          else if (ix.fold.includes(qFold.join)) rank = Math.min(rank, 3);
          else if (qFold.tok.length && qFold.tok.every(qt =>
                   ix.foldTok.some(ft => ft.startsWith(qt) || nearMiss(ft, qt))))
            rank = Math.min(rank, 4);               // every word matches one, a typo apart
        }
      }
      if (rank > 1 && pyChar) {
        const ix = pyIndex(p);
        const probe = asPinyin || latin;
        if (probe) {
          // 2 the name read in Mandarin starts with what was typed ("huiliang" → 惠良)
          // 3 one whole character is read that way ("ye" → 業 / 业 / 葉)
          // 4 it falls inside the reading but across syllables — a weaker, coincidental hit
          // 5 the initials spell it ("hl" → 惠良), only once it is unambiguous
          if (ix.join.startsWith(probe) || ix.join.includes(" " + probe)) rank = Math.min(rank, 2);
          else if (probe.length > 1 && ix.bag.includes(" " + probe + " ")) rank = Math.min(rank, 3);
          else if (ix.join.includes(probe)) rank = Math.min(rank, 5);
          else if (probe.length > 1 && ix.initials.startsWith(probe)) rank = Math.min(rank, 6);
        }
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
    const latin = ql.replace(/[^a-z]/g, "");
    box.innerHTML = searchMatches.map((p, i) => {
      const sub = [];
      if (p.pinyin) sub.push(hl(p.pinyin, q));
      ["ritualName", "style", "formalName", "hao", "milkName", "aka"].forEach(f => {
        if (p[f] && String(p[f]).toLowerCase().includes(ql)) sub.push(hl(p[f], q));
      });
      // The stored romanisation is Hakka, so when a Mandarin query is what matched,
      // say so — otherwise the row looks unrelated to what was typed.
      const ix = pyChar ? pyIndex(p) : null;
      if (ix && ix.display && latin && !String(p.pinyin || "").toLowerCase().includes(ql)
          && (ix.join.includes(latin) || ix.bag.includes(" " + latin) || ix.initials.startsWith(latin))) {
        sub.push(`<span class="sr-py">${I18N.t("search_mandarin")} ${hl(ix.display, latin)}</span>`);
      }
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
    $("#search").blur();   // dismiss the mobile keyboard so its close doesn't fight the zoom
    // suppress show()'s auto-fit (it would override the node-centred zoom), then focus
    // after a tick so the canvas is laid out and dims() is ready.
    show("tree", { noFit: true }); openPerson(id);
    setTimeout(() => Tree.focus(id), 60);
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

  /* ---- Sources — a museum-style exhibition (artifact left, label right) ---- */
  const CN_NUM = ["零","一","二","三","四","五","六","七","八","九","十"];
  function buildSources() {
    const T = I18N.t, st = Auth.state(), zh = I18N.getLang() === "zh";
    const list = (window.SOURCES || []);
    const signedIn = !!st.user;
    const anyGated = list.some(s => !s.localUrl);
    const lockBanner = (!signedIn && anyGated)
      ? `<div class="src-lock"><span>${T("src_locked")}</span><button class="src-signin" id="src-signin">${T("src_signin")}</button></div>`
      : "";

    const exhibits = list.map((s, i) => {
      const n = i + 1;
      const no = zh ? `${T("src_plate")}${CN_NUM[n] || n}件` : `${T("src_plate")} ${String(n).padStart(2, "0")}`;
      const heading   = zh ? s.title : (s.titleEn || s.title);
      const altTitle  = zh ? (s.titleEn || "") : s.title;
      const narrative = zh ? (s.narrative || s.desc) : (s.narrativeEn || s.descEn || s.desc);
      const medium = zh ? (s.medium || "") : (s.mediumEn || s.medium || "");
      const era    = zh ? (s.era || "") : (s.eraEn || s.era || "");
      const pages  = s.pages ? `${s.pages}${T("src_pages")}` : "";
      const caption = [medium, era, pages].filter(Boolean).join("　·　");
      const locked = !!s.key && !signedIn;   // a private scan needs sign-in
      const scanLabel = locked ? "🔒 " + T("src_signin") : T("src_view");
      // a source may carry a private scan (key), a public transcription (localUrl), and
      // a proofreader — each gets its own button
      const scanBtn  = s.key ? `<button class="plate-view${locked ? " locked" : ""}" data-doc="${s.id}" data-mode="scan">${scanLabel}</button>` : "";
      const readBtn  = s.localUrl ? `<button class="plate-read" data-doc="${s.id}" data-mode="local">${T("src_read")}</button>` : "";
      const proofBtn = s.proofread ? `<button class="plate-proofread" data-proof="${s.id}">${T("pf_open")}</button>` : "";

      const glyphOrImg = s.plateImg
        ? `<img class="plate-img" src="${s.plateImg}" alt="${esc(s.glyph || '')}" />`
        : `<div class="plate-glyph" aria-hidden="true">${esc(s.glyph || "卷")}</div>`;
      const plate = `<div class="exhibit-plate">
        <div class="plate-frame">
          ${glyphOrImg}
          <div class="plate-title">${esc(s.title)}</div>
          ${s.titleEn ? `<div class="plate-romaji">${esc(s.titleEn)}</div>` : ""}
          ${caption ? `<div class="plate-caption">${esc(caption)}</div>` : ""}
          ${scanBtn}${readBtn}${proofBtn}
        </div>
      </div>`;

      let excerptsHtml = "";
      if (Array.isArray(s.excerpts) && s.excerpts.length) {
        excerptsHtml = `<div class="exhibit-excerpts"><div class="excerpt-eyebrow">${T("src_excerpts")}</div>` +
          s.excerpts.map(x => `<div class="excerpt"><p class="ex-zh">${esc(x.zh)}</p><p class="ex-en">${esc(x.en)}</p></div>`).join("") +
          `</div>`;
      }
      const noteText = zh ? s.note : (s.noteEn || s.note);
      const noteHtml = noteText ? `<div class="exhibit-note"><span class="note-label">${T("src_note")}</span>${esc(noteText)}</div>` : "";

      const label = `<div class="exhibit-label">
        <div class="exhibit-no">${no}</div>
        <h3 class="exhibit-title">${esc(heading)}</h3>
        ${altTitle ? `<div class="exhibit-alt">${esc(altTitle)}</div>` : ""}
        <p class="exhibit-narrative">${esc(narrative)}</p>
        ${excerptsHtml}${noteHtml}
      </div>`;

      return `<article class="exhibit">${plate}${label}</article>`;
    }).join("");

    $("#sources-wrap").innerHTML =
      `<header class="exhibit-head"><h2>${T("src_h")}</h2><p class="exhibit-intro">${T("src_intro")}</p></header>` +
      lockBanner +
      `<div class="exhibits">${exhibits}</div>`;
    const signin = $("#src-signin"); if (signin) signin.onclick = openSignin;
    $$("#sources-wrap [data-doc]").forEach(b => b.onclick = () => openDoc(b.dataset.doc, b.dataset.mode));
    $$("#sources-wrap [data-proof]").forEach(b => b.onclick = () => openProofreader(b.dataset.proof));
  }

  // open the sign-in modal by reusing the header auth button (only when signed out)
  function openSignin() { const b = $("#auth-status"); if (b && !Auth.state().user) b.click(); }

  async function openDoc(id, which) {
    const s = (window.SOURCES || []).find(d => d.id === id);
    if (!s) return;
    // "local" = the public transcription HTML; otherwise the private scan (needs sign-in).
    // default to local only when the source has no scan at all.
    const useLocal = which === "local" || (which == null && s.localUrl && !s.key);
    if (!useLocal && !Auth.state().user) { openSignin(); return; }
    const sb = useLocal ? null : Auth.client();
    if (!useLocal && !sb) return;
    const title = I18N.getLang() === "zh" ? s.title : (s.titleEn || s.title);
    openDocview(title);
    try {
      let url;
      if (useLocal) {
        url = s.localUrl;
      } else {
        // Resolve against what's actually in the bucket so the exact upload name
        // doesn't have to match (tolerates Kong_Family_book_pt1.pdf vs the manifest key).
        const key = (await resolveDocKey(sb, s)) || s.key;
        const { data, error } = await sb.storage.from("documents").createSignedUrl(key, 3600);
        if (error || !data || !data.signedUrl) throw error || new Error("no url");
        url = data.signedUrl;
      }
      const open = $("#docview-open");
      open.href = url; open.textContent = I18N.t("src_open_new"); open.hidden = false;
      $("#docview-body").innerHTML = `<iframe class="docview-frame" src="${url}" title="${esc(title)}"></iframe>`;
    } catch (e) {
      console.error("openDoc failed for", s.key || s.localUrl, e);   // real error for diagnosis
      const notFound = e && /not found|does not exist|400|404/i.test(e.message || "");
      const msg = notFound ? I18N.t("src_unavailable") : I18N.t("src_err") + (e && e.message || "");
      $("#docview-body").innerHTML = `<p class="docview-msg">${msg}</p>`;
    }
  }
  // List the bucket and find the object that best matches this source, so the file
  // can be uploaded under any reasonable name (case / spaces / underscores ignored).
  // Searches the root and any one-level subfolder. Returns the full object path.
  const _docKeyCache = {};
  async function resolveDocKey(sb, s) {
    if (_docKeyCache[s.id]) return _docKeyCache[s.id];
    const norm = x => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
    const want = norm(s.key.replace(/\.pdf$/i, ""));
    try {
      let files = [];
      const top = await sb.storage.from("documents").list("", { limit: 1000 });
      const items = (top && top.data) || [];
      // direct files at root
      items.filter(o => o.id || /\.[a-z0-9]+$/i.test(o.name)).forEach(o => files.push(o.name));
      // one level of folders (Supabase lists folders as entries with no id)
      const folders = items.filter(o => !o.id && !/\.[a-z0-9]+$/i.test(o.name));
      for (const f of folders) {
        const sub = await sb.storage.from("documents").list(f.name, { limit: 1000 });
        ((sub && sub.data) || []).forEach(o => { if (o.id || /\.[a-z0-9]+$/i.test(o.name)) files.push(f.name + "/" + o.name); });
      }
      if (!files.length) return null;
      const base = p => p.split("/").pop().replace(/\.pdf$/i, "");
      let hit = files.find(p => norm(base(p)) === want)
             || files.find(p => norm(base(p)).includes(want))
             || files.find(p => want.includes(norm(base(p))));
      if (hit) _docKeyCache[s.id] = hit;
      return hit || null;
    } catch (e) { console.error("bucket list failed", e); return null; }
  }
  function openDocview(title) {
    $("#docview-title").textContent = title || "";
    $("#docview-open").hidden = true;
    $("#docview-body").innerHTML = `<p class="docview-msg">${I18N.t("src_loading")}</p>`;
    $("#docview").classList.add("open");
  }
  function closeDocview() {
    $("#docview").classList.remove("open");
    $("#docview-body").innerHTML = "";   // unload the iframe / stop the download
  }

  /* ---- Proofreader: scanned page (left) beside its transcription (right) ---- */
  let pfSource = null, pfPdf = null, pfPage = 1, pfTotal = 1, pfZoom = 1, pfLive = {}, pfEdits = {}, pfBaseline = "";

  // lazy-load pdf.js only when the proofreader is first opened (keeps the app light)
  function ensurePdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise((resolve, reject) => {
      const sc = document.createElement("script");
      sc.src = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js";
      sc.onload = () => {
        try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js"; } catch (e) { /* ignore */ }
        resolve(window.pdfjsLib);
      };
      sc.onerror = () => reject(new Error("pdf.js failed to load"));
      document.head.appendChild(sc);
    });
  }

  async function openProofreader(srcId) {
    const s = (window.SOURCES || []).find(d => d.id === srcId);
    if (!s || !s.proofread) return;
    if (!Auth.state().user) { openSignin(); return; }   // scans are family-only
    const T = I18N.t, st = Auth.state();
    pfSource = s; pfPage = 1; pfTotal = s.pageCount || 1; pfZoom = 1; pfPdf = null; pfLive = {}; pfEdits = {};

    $("#pf-title").textContent = I18N.getLang() === "zh" ? s.title : (s.titleEn || s.title);
    $("#pf-help").textContent = T("pf_help");
    $("#pf-textlabel").textContent = T("pf_textlabel");
    $("#pf-text").setAttribute("placeholder", T("pf_placeholder"));
    $("#pf-namelabel").textContent = T("pf_name");
    $("#pf-submit").textContent = T("pf_submit");
    $("#pf-zoom-reset").textContent = T("pf_zoomreset");
    $("#pf-name").value = (st.profile && st.profile.full_name) || "";
    $("#pf-msg").textContent = "";
    $("#proofreader").classList.add("open");

    // live (approved) corrections layered over the seed draft
    try {
      const sb = Auth.client();
      if (sb) {
        const { data } = await sb.from("transcriptions").select("page,text").eq("doc_id", s.id);
        (data || []).forEach(r => { pfLive[r.page] = r.text; });
      }
    } catch (e) { console.warn("transcription load failed", e); }
    pfShowText();
    pfUpdateNav();

    // the scanned PDF
    $("#pf-canvas").style.display = "none";   // hide the blank canvas until a page renders
    $("#pf-scan-msg").textContent = T("pf_loading");
    $("#pf-scan-msg").style.display = "";
    try {
      await ensurePdfJs();
      const sb = Auth.client();
      const key = (await resolveDocKey(sb, { id: s.id + "_scan", key: s.scanKey })) || s.scanKey;
      const { data, error } = await sb.storage.from("documents").createSignedUrl(key, 3600);
      if (error || !data || !data.signedUrl) throw error || new Error("no url");
      pfPdf = await window.pdfjsLib.getDocument(data.signedUrl).promise;
      pfTotal = pfPdf.numPages || pfTotal;
      pfUpdateNav();
      await pfRender();
      $("#pf-scan-msg").style.display = "none";
    } catch (e) {
      console.error("proofreader scan load failed", e);
      $("#pf-scan-msg").textContent = T("pf_loaderr") + (e && e.message || "");
    }
  }

  async function pfRender() {
    if (!pfPdf) return;
    const page = await pfPdf.getPage(pfPage);
    const wrap = $("#pf-canvas-wrap");
    const dpr = window.devicePixelRatio || 1;
    const vp1 = page.getViewport({ scale: 1 });
    const fitW = Math.max(280, wrap.clientWidth - 24);   // fit container, then multiply by zoom
    const cssW = fitW * pfZoom;
    const vp = page.getViewport({ scale: (cssW / vp1.width) * dpr });
    const canvas = $("#pf-canvas");
    canvas.width = vp.width; canvas.height = vp.height;
    canvas.style.width = (vp.width / dpr) + "px";
    canvas.style.height = (vp.height / dpr) + "px";
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    canvas.style.display = "block";
  }

  function pfSeedText() {
    const seed = (window.TRANSCRIPTION_SEED && window.TRANSCRIPTION_SEED[pfSource.id]) || {};
    // saved baseline = approved live text if any, else the seed draft
    return (pfLive[pfPage] != null) ? pfLive[pfPage] : (seed[pfPage] != null ? seed[pfPage] : "");
  }
  function pfShowText() {
    pfBaseline = pfSeedText();
    // keep in-session edits while flipping pages, even before they're submitted
    $("#pf-text").value = (pfEdits[pfPage] != null) ? pfEdits[pfPage] : pfBaseline;
  }
  function pfUpdateNav() {
    const T = I18N.t, zh = I18N.getLang() === "zh";
    $("#pf-pageind").textContent = zh
      ? `${T("pf_page")} ${pfPage} ${T("pf_of")} ${pfTotal} 頁`
      : `${T("pf_page")} ${pfPage} ${T("pf_of")} ${pfTotal}`;
    $("#pf-prev").disabled = pfPage <= 1;
    $("#pf-next").disabled = pfPage >= pfTotal;
  }
  async function pfGo(delta) {
    const next = Math.min(pfTotal, Math.max(1, pfPage + delta));
    if (next === pfPage) return;
    pfEdits[pfPage] = $("#pf-text").value;   // remember current edit
    pfPage = next;
    $("#pf-msg").textContent = "";
    pfShowText();
    pfUpdateNav();
    $("#pf-canvas-wrap").scrollTop = 0; $("#pf-canvas-wrap").scrollLeft = 0;
    await pfRender();
  }
  async function pfSetZoom(z) {
    pfZoom = Math.min(4, Math.max(0.5, z));
    await pfRender();
  }
  async function pfSubmit() {
    if (!pfSource) return;
    const text = $("#pf-text").value;
    const T = I18N.t;
    if (text === pfBaseline) { $("#pf-msg").textContent = T("pf_nochange"); $("#pf-msg").className = "pf-msg warn"; return; }
    const sb = Auth.client(), st = Auth.state();
    const btn = $("#pf-submit"); btn.disabled = true;
    const payload = {
      action: "fix_transcription",
      doc_id: pfSource.id, page: pfPage,
      original: pfBaseline, text,
      contributor: $("#pf-name").value || null,
      submittedAt: new Date().toISOString(), status: "pending"
    };
    try {
      const { error } = await sb.from("contributions").insert({ payload, status: "pending" });
      if (error) throw error;
      pfBaseline = text;                       // sent; don't re-warn for the same text
      $("#pf-msg").textContent = T("pf_sent"); $("#pf-msg").className = "pf-msg ok";
    } catch (e) {
      console.error("transcription submit failed", e);
      $("#pf-msg").textContent = T("pf_failed") + (e && e.message || ""); $("#pf-msg").className = "pf-msg warn";
    } finally { btn.disabled = false; }
  }
  function closeProofreader() {
    $("#proofreader").classList.remove("open");
    if (pfPdf && pfPdf.cleanup) { try { pfPdf.cleanup(); } catch (e) { /* ignore */ } }
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

  /* ---- Welcome card ----
   * First-touch onboarding, so it is intentionally BILINGUAL (中文 + English shown
   * together) rather than following the language toggle — a new visitor hasn't picked
   * a language yet. Shows once automatically (localStorage), and is reopenable any time
   * via the header "?" button. */
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
      <button id="intro-close" class="drawer-close" aria-label="Close">×</button>
      <span class="intro-seal">江</span>
      <h2 class="intro-title">歡迎 · Welcome</h2>
      <p class="intro-sub">
        <span class="zh">江氏家族三十世 — 自福建寧化石壁，歷廣東，遠至沙巴。</span>
        <span class="en">Thirty generations of the Kong (江) family — from 寧化石壁 in Fujian, through 廣東, to 沙巴.</span>
      </p>
      <ul class="intro-tips">
        <li><span class="zh"><b>點選</b>任何卡片，查看該人的詳情、相片與地點。</span><span class="en"><b>Click</b> any card to open a person's details, photos and places.</span></li>
        <li><span class="zh">點卡片下方的 <b>⊕</b> 標記，展開該支系的子女。</span><span class="en">Tap the <b>⊕</b> badge under a card to reveal that branch's children.</span></li>
        <li><span class="zh">在上方<b>搜尋</b>姓名，即可直接跳至任何人。</span><span class="en"><b>Search</b> a name up top to jump straight to anyone.</span></li>
      </ul>
      <div class="intro-actions">
        <button class="primary" id="intro-start">從始祖開始 · Start at the founder</button>
        <button id="intro-expand">顯示整個族譜 · Show whole tree</button>
        <button id="intro-skip">知道了 · Got it</button>
      </div>`;
    document.body.appendChild(scrim);
    document.body.appendChild(card);
    $("#intro-start").onclick = () => { closeIntro(); Tree.home(); };
    $("#intro-expand").onclick = () => { closeIntro(); Tree.expandAll(); };
    $("#intro-skip").onclick = () => closeIntro();
    $("#intro-close").onclick = () => closeIntro();
    scrim.onclick = () => closeIntro();
  }
  function showIntro() {
    $("#intro-scrim").classList.add("open");
    $("#intro-card").classList.add("open");
  }
  function maybeShowIntro() {
    let seen = false;
    try { seen = localStorage.getItem(INTRO_SEEN_KEY) === "1"; } catch (e) { /* ignore */ }
    if (!seen) showIntro();
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
      renderVisitCount();   // re-label "👁 N" in the new language
      if (window.MapView && MapView.relabel) MapView.relabel();   // rebuild map popups in the new language
      if ($("#verify-panel").classList.contains("open")) buildVerifyList();
      if ($("#view-review").classList.contains("active")) buildReview();
      if ($("#view-members").classList.contains("active")) buildMembers();
      if ($("#view-sources").classList.contains("active")) buildSources();
      if ($("#drawer").classList.contains("open") && currentPersonId) openPerson(currentPersonId);
      if ($("#drawer").classList.contains("open") && currentPlaceId) openPlace(currentPlaceId);
      if (currentPersonId && !$("#tree-breadcrumb").hidden) renderBreadcrumb(currentPersonId);
    });

    $$(".tab").forEach(t => t.onclick = () => {
      // Clicking the Contribute tab directly is a fresh start — drop any stale
      // correction prefill left over from a previous "Suggest a correction".
      if (t.dataset.view === "contribute") Contribute.reset();
      show(t.dataset.view);
    });
    // hint that the tab strip scrolls (mobile): show a chevron on whichever edge has hidden tabs
    const tabsEl = $(".tabs"), tabsWrap = $(".tabs-scroll");
    const updateTabFades = () => {
      if (!tabsEl || !tabsWrap) return;
      const max = tabsEl.scrollWidth - tabsEl.clientWidth;
      tabsWrap.classList.toggle("more-left", tabsEl.scrollLeft > 4);
      tabsWrap.classList.toggle("more-right", max > 4 && tabsEl.scrollLeft < max - 4);
    };
    if (tabsEl) { tabsEl.addEventListener("scroll", updateTabFades, { passive: true }); window.addEventListener("resize", updateTabFades); setTimeout(updateTabFades, 60); }
    $("#drawer-close").onclick = closeDrawer;
    $("#drawer-scrim").onclick = closeDrawer;
    $("#toggle-daughters").onchange = e => Tree.setOptions({ daughters: e.target.checked });
    $("#toggle-pinyin").onchange = e => Tree.setOptions({ pinyin: e.target.checked });
    $("#toggle-photos").onchange = e => Tree.setOptions({ photos: e.target.checked });
    $("#toggle-swim").onchange = e => Tree.setOptions({ swim: e.target.checked });
    // map layer filters (祖籍 / 遷居 / 墓 / 祠堂 / 教會墳場 / 沙巴)
    $$(".layer-toggle").forEach(c => c.onchange = () => MapView.setLayer(c.dataset.group, c.checked));
    // collapse/expand the toolbar option controls (phones) — resize the canvas after
    $$(".tb-options-btn").forEach(btn => btn.onclick = () => {
      const tb = btn.closest(".tree-toolbar, .map-toolbar");
      const open = tb.classList.toggle("opts-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      sizeCanvas();
    });
    $("#help-intro").onclick = () => showIntro();
    $("#btn-home").onclick = () => { Tree.home(); hideBreadcrumb(); };
    $("#btn-expand").onclick = () => Tree.expandAll();
    $("#btn-fit").onclick = () => Tree.fit();
    // Guarded: a returning visitor can hold a cached index.html while picking up fresh
    // JS, and an unguarded assignment here would throw and abandon the rest of init().
    const exportBtn = $("#btn-export");
    if (exportBtn) exportBtn.onclick = exportCsv;
    $("#btn-verify").onclick = openVerify;
    $("#verify-close").onclick = closeVerify;
    updateVerifyCount();
    const sEl = $("#search");
    // The pinyin table is ~73 KB, so it is fetched the moment someone shows intent to
    // search rather than on every page load. Results render immediately from the stored
    // fields and re-render once it arrives.
    sEl.addEventListener("focus", loadPinyin, { once: true });
    sEl.addEventListener("input", e => { loadPinyin(); renderSearch(e.target.value); });
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
    // person links from map dots → jump to them on the tree and open the drawer
    document.addEventListener("click", e => {
      const a = e.target.closest("[data-person]");
      if (a) { e.preventDefault(); show("tree", { noFit: true }); openPerson(a.dataset.person); Tree.focus(a.dataset.person); }
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
    // document viewer (family-only source scans)
    $("#docview-close").onclick = closeDocview;
    document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#docview").classList.contains("open")) closeDocview(); });

    // proofreader
    $("#pf-close").onclick = closeProofreader;
    $("#pf-prev").onclick = () => pfGo(-1);
    $("#pf-next").onclick = () => pfGo(1);
    $("#pf-zoom-in").onclick = () => pfSetZoom(pfZoom * 1.25);
    $("#pf-zoom-out").onclick = () => pfSetZoom(pfZoom / 1.25);
    $("#pf-zoom-reset").onclick = () => pfSetZoom(1);
    $("#pf-text").addEventListener("input", () => { if (pfSource) { pfEdits[pfPage] = $("#pf-text").value; $("#pf-msg").textContent = ""; } });
    $("#pf-submit").onclick = pfSubmit;
    document.addEventListener("keydown", e => {
      if (!$("#proofreader").classList.contains("open")) return;
      if (e.key === "Escape") closeProofreader();
      else if (e.target === $("#pf-text") || e.target === $("#pf-name")) return;   // don't page while typing
      else if (e.key === "ArrowLeft") pfGo(-1);
      else if (e.key === "ArrowRight") pfGo(1);
    });

    window.addEventListener("resize", () => { sizeCanvas(); Tree.onResize(); positionBreadcrumb(); if ($("#proofreader").classList.contains("open")) pfRender(); });
    sizeCanvas();
    window.addEventListener("orientationchange", () => setTimeout(sizeCanvas, 200));

    // Browser Back/Forward replays the stored view + drawer state.
    window.addEventListener("popstate", e => applyNav(e.state || { view: "tree", personId: null, placeId: null }));
    history.replaceState(navSnapshot(), "");   // seed the initial (tree, no drawer) entry

    setupAuth();
    Auth.init().then(() => { loadLiveData(); loadVisitorCount(); });
  }

  window.openPerson = openPerson;
  window.openPlace = openPlace;
  // Contribute reuses this so switching the "person you are correcting" reloads that
  // person's real values instead of keeping whatever was typed for someone else.
  window.personPrefill = personPrefill;
  document.addEventListener("DOMContentLoaded", init);
})();
