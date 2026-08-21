/* ──────────────────────────────────────────────────────────────────────────
 * Backend adapter.
 *
 * The app talks to a backend through this file so that WHICH backend is a
 * setting rather than a rewrite. Set APP_CONFIG.BACKEND to "supabase" (the
 * default, and what is live today) or "php" to point it at the SiteGround API.
 *
 * WHY AN ADAPTER AND NOT A REWRITE
 * There are 77 Supabase call sites in js/ — .from(), storage, rpc and auth —
 * not the 14 an older note estimated, because the admin tools, the members tab
 * and the proofreader all arrived after that count was taken. Converting them
 * in one commit would be a change nobody could review and nothing could verify
 * halfway. It would also make it impossible to do what the deploy plan asks
 * for: run both backends side by side until the new one is dull.
 *
 * So this grows one capability at a time. Anything not yet listed here keeps
 * using Supabase directly, which is why the switch is safe to flip early: the
 * parts that have moved use the new API, the parts that have not carry on as
 * before, and both are exercised by the same UI.
 *
 * The PHP side returns the tree already filtered to the caller — one request
 * where Supabase needed three — so the shapes here are deliberately the shape
 * app.js already expects after camel(), not a generic query builder. A fake
 * PostgREST would be a much bigger surface to get subtly wrong.
 * ────────────────────────────────────────────────────────────────────────── */
window.Backend = (function () {
  const cfg  = window.APP_CONFIG || {};
  const MODE = cfg.BACKEND === "php" ? "php" : "supabase";
  const BASE = (cfg.PHP_API_BASE || "").replace(/\/$/, "");

  const isPhp = () => MODE === "php";

  /** Same-origin by default; cookies carry the PHP session, so credentials
   *  must be included or every request looks signed out. */
  async function api(path, opts = {}) {
    const res = await fetch(BASE + path, {
      credentials: "include",
      ...opts,
      headers: { ...(opts.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
                 ...(opts.headers || {}) }
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { /* non-JSON error page */ }
    if (!res.ok) throw new Error((data && data.error) || text.slice(0, 200) || ("HTTP " + res.status));
    return data;
  }

  return {
    mode: () => MODE,
    isPhp,

    /**
     * The whole tree, already filtered. On Supabase this is three reads plus a
     * fourth for the living-adults view when signed out; the PHP endpoint does
     * that server-side and returns one payload.
     *
     * Returns { persons, places, media, viewer } with snake_case rows, exactly
     * what the existing camel() expects — the caller's merge logic is unchanged.
     */
    async tree(sb) {
      if (isPhp()) return await api("/api/tree.php");
      const [pp, pl, md] = await Promise.all([
        sb.from("persons").select("*"),
        sb.from("places").select("*"),
        sb.from("media").select("*")
      ]);
      return { persons: pp.data || [], places: pl.data || [], media: md.data || [], viewer: null };
    },

    /** Living adults, for a signed-out visitor. Folded into tree() on PHP. */
    async publicSearch(sb) {
      if (isPhp()) return [];                       // already included above
      const { data } = await sb.from("persons_public_search").select("*");
      return data || [];
    },

    /** Submit a contribution. Open to signed-out visitors on both backends. */
    async submitContribution(payload) {
      if (isPhp()) return await api("/api/contribute.php", { method: "POST", body: JSON.stringify(payload) });
      const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/contributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Prefer: "return=minimal" },
        body: JSON.stringify({ payload, status: "pending" })
      });
      if (!res.ok) throw new Error(await res.text());
      return { ok: true };
    },

    /** The reviewer's queue. On PHP each pending item carries the target it
     *  would actually land on, and a renameWarning when approving it would
     *  swap someone's name for an unrelated one. */
    async listContributions(sb, which) {
      if (isPhp()) return (await api("/api/review.php?status=" + encodeURIComponent(which))).contributions;
      const qy = which === "pending"
        ? sb.from("contributions").select("*").eq("status", "pending").order("created_at", { ascending: false })
        : sb.from("contributions").select("*").neq("status", "pending").order("reviewed_at", { ascending: false }).limit(50);
      const { data } = await qy;
      return data || [];
    },

    /** Approve or reject. On PHP the whole decision is one transaction, so a
     *  refusal leaves the tree untouched and the contribution still pending —
     *  the caller does not need to unpick a half-applied change. */
    async decideContribution(id, status, reason) {
      if (!isPhp()) throw new Error("decideContribution: Supabase path stays in app.js for now");
      return await api("/api/review.php", { method: "POST", body: JSON.stringify({ id, status, reason }) });
    },

    /** Upload a photo. It lands outside the web root and unapproved, which on
     *  this backend already means admin-only. */
    async uploadPhoto(file, { personId, placeId, caption } = {}) {
      if (!isPhp()) throw new Error("uploadPhoto: Supabase path stays in app.js for now");
      const fd = new FormData();
      fd.append("photo", file);
      if (personId) fd.append("personId", personId);
      if (placeId)  fd.append("placeId", placeId);
      if (caption)  fd.append("caption", caption);
      return await api("/api/upload.php", { method: "POST", body: fd });
    },

    /** A photo's URL. The PHP side has exactly one, and it is the gate. */
    photoUrl(mediaId) {
      return isPhp() ? `${BASE}/photo.php?id=${encodeURIComponent(mediaId)}` : null;
    },

    /** Who the server thinks we are. */
    async me() {
      if (!isPhp()) throw new Error("me(): use Auth.state() on Supabase");
      return await api("/auth/me.php");
    },
    async requestLink(email) {
      if (!isPhp()) throw new Error("requestLink(): use Auth on Supabase");
      return await api("/auth/request.php", { method: "POST", body: JSON.stringify({ email }) });
    },
    async signOut() {
      if (!isPhp()) throw new Error("signOut(): use Auth on Supabase");
      return await api("/auth/logout.php", { method: "POST" });
    }
  };
})();
