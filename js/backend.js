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
      if (isPhp()) {
        const rows = (await api("/api/review.php?status=" + encodeURIComponent(which))).contributions || [];
        // review.php answers in camelCase and decodes the payload for us; the
        // renderer was written against the raw PostgREST row. Translate here
        // rather than in the renderer, so one card template keeps serving both
        // backends. target / renameWarning / unprefilled have no Supabase
        // counterpart and are passed straight through — they are the mistargeting
        // guard, and dropping them to tidy the shape would drop the guard.
        return rows.map(r => ({
          id: r.id,
          status: r.status,
          payload: r.payload,
          created_at: r.createdAt,
          reviewed_by: r.reviewedBy,
          reviewed_at: r.reviewedAt,
          rejection_reason: r.reason,
          reviewer_name: r.reviewedByName || null,
          target: r.target,
          renameWarning: r.renameWarning,
          unprefilled: r.unprefilled
        }));
      }
      const qy = which === "pending"
        ? sb.from("contributions").select("*").eq("status", "pending").order("created_at", { ascending: false })
        : sb.from("contributions").select("*").neq("status", "pending").order("reviewed_at", { ascending: false }).limit(50);
      const { data, error } = await qy;
      // Throw rather than return []. A queue that failed to load and a queue with
      // nothing in it render identically, and the reviewer would read the second
      // one as "all caught up" — the PHP path throws on a bad response for the
      // same reason, so both backends fail loudly here.
      if (error) throw error;
      return data || [];
    },

    /** Approve or reject. On PHP the whole decision is one transaction, so a
     *  refusal leaves the tree untouched and the contribution still pending —
     *  the caller does not need to unpick a half-applied change. */
    async decideContribution(id, status, reason) {
      if (!isPhp()) throw new Error("decideContribution: Supabase path stays in app.js for now");
      return await api("/api/review.php", { method: "POST", body: JSON.stringify({ id, status, reason }) });
    },

    /**
     * The member roster. Both backends already answer with the same columns —
     * members_admin was built to be this list — so there is nothing to translate.
     * Both are admin-only server-side: the view's `where is_admin()` on Supabase,
     * the check in lib/members.php here.
     */
    async listMembers(sb) {
      if (isPhp()) return (await api("/api/members.php")).members || [];
      const { data, error } = await sb.from("members_admin").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    /** Approve or un-approve a member — the flag that gates living-member detail. */
    async setMemberApproved(sb, id, approve) {
      if (isPhp()) return await api("/api/members.php", { method: "POST", body: JSON.stringify({ id, approved: approve }) });
      const { error } = await sb.rpc("set_member_approved", { target_id: id, approve });
      if (error) throw error;
      return { ok: true };
    },

    /** Grant or remove reviewer rights. Both sides refuse self-demotion; the PHP
     *  side additionally refuses to remove the last reviewer. */
    async setMemberAdmin(sb, id, makeAdmin) {
      if (isPhp()) return await api("/api/members.php", { method: "POST", body: JSON.stringify({ id, isAdmin: makeAdmin }) });
      const { error } = await sb.rpc("set_member_admin", { target_id: id, make_admin: makeAdmin });
      if (error) throw error;
      return { ok: true };
    },

    /**
     * Upload a photo. It lands outside the web root and unapproved, which on
     * this backend already means admin-only.
     *
     * `staged: true` is the contribution form's case — a photo of somebody who
     * does not have an id yet. It is stored with no subject and claimed when the
     * reviewer approves the contribution that creates them.
     *
     * Note what is NOT sent: the tier. The server reads it off the subject, so a
     * client that asked for "public" on a living relative cannot get it.
     */
    async uploadPhoto(file, { personId, placeId, caption, staged } = {}) {
      if (!isPhp()) throw new Error("uploadPhoto: Supabase path stays in app.js");
      const fd = new FormData();
      fd.append("photo", file);
      if (personId) fd.append("personId", personId);
      if (placeId)  fd.append("placeId", placeId);
      if (caption)  fd.append("caption", caption);
      if (staged)   fd.append("staged", "1");
      return await api("/api/upload.php", { method: "POST", body: fd });
    },

    /** Approve a staged photo, or refuse it — on PHP a refusal deletes it. */
    async approvePhoto(sb, mediaId, approve = true) {
      if (isPhp()) return await api("/api/upload.php", { method: "PATCH", body: JSON.stringify({ mediaId, approve }) });
      const { error } = await sb.from("media").update({ approved: approve }).eq("id", mediaId);
      if (error) throw error;
      return { ok: true };
    },

    /**
     * Remove a photo. On PHP the row and the bytes go together in one call — the
     * Supabase path has to delete from the bucket and the table separately, and
     * a media table that has forgotten a file is how orphaned bytes accumulate.
     */
    async deletePhoto(sb, media) {
      if (isPhp()) return await api("/api/upload.php", { method: "DELETE", body: JSON.stringify({ mediaId: media.id }) });
      try {
        if (media.private_path) {
          await sb.storage.from("photos-private").remove([media.private_path]);
        } else {
          const path = decodeURIComponent((String(media.url).split("/photos/")[1] || "").split("?")[0]);
          if (path) await sb.storage.from("photos").remove([path]);
        }
      } catch (e) { console.warn("storage remove failed", e); }
      const { error } = await sb.from("media").delete().eq("id", media.id);
      if (error) throw error;
      return { ok: true };
    },

    /** Which approved photo is the tree avatar. Exclusive per person. */
    async setCover(sb, mediaId, personId) {
      if (isPhp()) return await api("/api/upload.php", { method: "PATCH", body: JSON.stringify({ mediaId, cover: true }) });
      await sb.from("media").update({ cover: false }).eq("person_id", personId).neq("id", mediaId);
      const { error } = await sb.from("media").update({ cover: true }).eq("id", mediaId);
      if (error) throw error;
      return { ok: true };
    },

    /** A photo's URL. The PHP side has exactly one, and it is the gate. */
    photoUrl(mediaId) {
      return isPhp() ? `${BASE}/photo.php?id=${encodeURIComponent(mediaId)}` : null;
    },

    /**
     * A reviewer's direct edit to a person — no queue, no proposer.
     *
     * `seed` is the person as the PUBLIC data/lineage.js has them, sent because
     * most people in the tree have no database row until somebody edits them.
     * The server takes only descriptive columns from it and asserts the privacy
     * ones, so what is sent here cannot decide who is visible.
     */
    async writePerson(id, fields, seed) {
      if (!isPhp()) throw new Error("writePerson: Supabase path stays in app.js");
      return await api("/api/person.php", {
        method: "POST", body: JSON.stringify({ id, action: "edit", fields, seed })
      });
    },

    /**
     * Take somebody out of the tree. Its own action rather than a field edit:
     * archiving carries who and when and why, and the server writes those
     * itself so they cannot be forged by whoever calls this.
     */
    async archivePerson(id, reason, seed) {
      if (!isPhp()) throw new Error("archivePerson: Supabase path stays in app.js");
      return await api("/api/person.php", {
        method: "POST", body: JSON.stringify({ id, action: "archive", reason, seed })
      });
    },

    async restorePerson(id) {
      if (!isPhp()) throw new Error("restorePerson: Supabase path stays in app.js");
      return await api("/api/person.php", {
        method: "POST", body: JSON.stringify({ id, action: "restore" })
      });
    },

    /**
     * Fold one person into another. One call, one transaction — the browser
     * version issued a request per child, per spouse and per table, so a merge
     * that failed midway left the tree half-rearranged with no record of how far
     * it got. `relink` carries the relatives that exist only in the public seed,
     * since the server cannot re-point rows it has never heard of.
     */
    async mergePerson(keepId, dupId, { keepSeed, dupSeed, relink } = {}) {
      if (!isPhp()) throw new Error("mergePerson: Supabase path stays in app.js");
      return await api("/api/person.php", {
        method: "POST",
        body: JSON.stringify({ action: "merge", keepId, dupId, keepSeed, dupSeed, relink })
      });
    },

    /** The archived list, already named by whoever archived each person. */
    async listArchived() {
      if (!isPhp()) throw new Error("listArchived: Supabase path stays in app.js");
      return (await api("/api/person.php?archived=1")).archived || [];
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
