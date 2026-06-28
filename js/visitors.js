/* Site-wide visitor counter. The running total lives in Supabase and is bumped
 * atomically by the bump_visit() RPC (see supabase/migration_v11.sql), so every
 * visitor sees the same number and concurrent hits never lose a tick. Counts
 * once per browser session (a sessionStorage guard avoids re-counting reloads).
 *
 * Degrades gracefully: with no Supabase configured (demo mode) — or if the
 * migration hasn't been applied yet — it falls back to a local per-browser
 * tally so the badge still shows something, and stays hidden only if even that
 * fails. Exposes window.Visitors. */
(function () {
  const cfg = window.APP_CONFIG || {};
  const LIVE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const SESSION_KEY = "zupu_visit_counted";   // "1" once this session is counted
  const LOCAL_KEY   = "zupu_visits_local";    // fallback per-browser tally

  const box = () => document.getElementById("visitor-counter");
  const num = () => document.getElementById("vc-num");

  function fmt(n) {
    try { return Number(n).toLocaleString(); } catch (e) { return String(n); }
  }
  function counted() {
    try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch (e) { return false; }
  }
  function markCounted() {
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) { /* ignore */ }
  }
  function show(n) {
    const b = box(), el = num();
    if (!b || !el || n == null) return;
    el.textContent = fmt(n);
    b.hidden = false;
  }

  // Server-backed: bump once per session, otherwise just read the current total.
  async function live() {
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY,
      { auth: { persistSession: false } });

    if (!counted()) {
      const { data, error } = await sb.rpc("bump_visit");
      if (!error && data != null) { markCounted(); return data; }
      // RPC missing/blocked (e.g. migration not run yet) → fall through to a read
    }
    const { data, error } = await sb
      .from("site_stats").select("count").eq("key", "visits").maybeSingle();
    if (error || !data) throw error || new Error("no site_stats row");
    return data.count;
  }

  // Local fallback: a per-browser count, incremented once per session.
  function local() {
    try {
      let n = parseInt(localStorage.getItem(LOCAL_KEY) || "0", 10) || 0;
      if (!counted()) {
        n += 1;
        localStorage.setItem(LOCAL_KEY, String(n));
        markCounted();
      }
      return n;
    } catch (e) { return null; }
  }

  async function init() {
    try {
      show(LIVE ? await live() : local());
    } catch (e) {
      console.warn("visitor counter: server unavailable, using local tally", e);
      show(local());   // last-ditch so the badge isn't left empty
    }
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else
    init();

  window.Visitors = { init };
})();
