/* Sign-in, for whichever backend is configured.
 *
 * Exposes window.Auth. Safe no-op if nothing is configured.
 *
 * TWO DRIVERS, ONE SHAPE
 * Supabase keeps a JWT session in the browser; the PHP backend keeps a session
 * cookie the browser never shows us. Those are genuinely different mechanisms,
 * but everything downstream only ever reads `st.user.id`, `st.user.email`,
 * `st.profile.full_name` and `st.isAdmin` — so the PHP driver answers in that
 * same shape, built from /auth/me.php, and the ~15 places in app.js that read
 * auth state did not have to change.
 *
 * What DOES differ is client(): on PHP there is no query client to hand out, so
 * it returns null. That is the honest answer — a caller that still needs to run
 * a Supabase query has not been ported yet, and `if (!sb)` is how it finds out.
 * Callers must guard the sb-only STEP rather than bailing out of the whole
 * function, or a ported capability sitting further down never runs.
 *
 * Google OAuth is Supabase-only by design (see siteground/README.md): magic
 * link alone is the simpler thing to get right for elderly relatives. The UI
 * asks googleAvailable() rather than assuming.
 */
(function () {
  const cfg = window.APP_CONFIG || {};
  const PHP = !!(window.Backend && window.Backend.isPhp());
  // On PHP the API is same-origin and always there; on Supabase it takes a URL,
  // a key, and the SDK actually having loaded.
  const LIVE = PHP ? true : !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);

  let sb = null, session = null, profile = null, approved = false, notice = null;
  const subs = [];

  function state() {
    return { live: LIVE, mode: PHP ? "php" : "supabase",
             session, profile, user: session ? session.user : null,
             isAdmin: !!(profile && profile.is_admin),
             approved: !!approved };
  }
  function emit() { subs.forEach(fn => { try { fn(state()); } catch (e) { console.error(e); } }); }
  function onChange(fn) { subs.push(fn); fn(state()); }

  /* ---- Supabase driver ---------------------------------------------------- */

  async function loadProfile() {
    profile = null; approved = false;
    if (!session) return;
    try {
      const { data } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      profile = data || null;
      approved = !!(data && data.approved);
    } catch (e) { console.error("profile load failed", e); }
  }

  async function initSupabase() {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    try {
      const { data } = await sb.auth.getSession();
      session = data.session || null;
      if (location.hash.includes("access_token") || location.hash.includes("error_description")) {
        history.replaceState(null, "", location.pathname + location.search);
      }
      await loadProfile();
    } catch (e) { console.error("getSession failed", e); }
    sb.auth.onAuthStateChange(async (_evt, s) => {
      if (location.hash.includes("access_token")) {
        history.replaceState(null, "", location.pathname + location.search);
      }
      session = s || null; await loadProfile(); emit();
    });
  }

  /* ---- PHP driver --------------------------------------------------------- */

  /** Fold /auth/me.php into the same {session, profile} shape the app reads. */
  function applyMe(me) {
    if (!me || !me.signedIn) { session = null; profile = null; approved = false; return; }
    session = { user: { id: me.userId, email: me.email } };
    profile = { id: me.userId, email: me.email, full_name: me.fullName,
                is_admin: !!me.admin, approved: !!me.approved, person_id: me.personId };
    approved = !!me.approved;
  }

  /**
   * verify.php consumes the token and redirects back with ?signin=ok|expired —
   * deliberately, so the token itself never reaches this page's address bar,
   * history or Referer. Take the marker off the URL too; it is a one-time
   * message, not state, and a reloaded or bookmarked page should not repeat it.
   */
  function takeSigninNotice() {
    const params = new URLSearchParams(location.search);
    const n = params.get("signin");
    if (!n) return;
    notice = n;
    params.delete("signin");
    const qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }

  async function initPhp() {
    try { applyMe(await Backend.me()); }
    catch (e) { console.error("me.php failed", e); applyMe(null); }
  }

  /* ---- Common API --------------------------------------------------------- */

  async function init() {
    if (!LIVE) { emit(); return; }
    if (PHP) await initPhp(); else await initSupabase();
    emit();
  }

  const redirect = () => location.href.split("#")[0];

  /**
   * Both backends answer the same way whether or not the address has an
   * account, so the caller gets {error} rather than a throw and never learns
   * which it was.
   */
  async function sendMagicLink(email) {
    if (PHP) {
      try { await Backend.requestLink(email); return { error: null }; }
      catch (e) { return { error: e }; }
    }
    if (!sb) throw new Error("Auth not configured");
    return sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } });
  }

  const googleAvailable = () => !PHP;

  async function google() {
    if (PHP) throw new Error("Google sign-in is not available on this backend — use the email link.");
    if (!sb) throw new Error("Auth not configured");
    return sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect() } });
  }

  async function signOut() {
    if (PHP) { try { await Backend.signOut(); } catch (e) { console.error("logout failed", e); } }
    else if (sb) { await sb.auth.signOut(); }
    session = null; profile = null; approved = false; emit();
  }

  // Read at load, not inside init(): app.js wires the sign-in UI BEFORE it
  // awaits init(), so a notice collected in init() would arrive too late to be
  // shown. The marker is in the URL from the first byte and needs no network,
  // and taking it off early keeps it out of the address bar sooner.
  if (PHP) takeSigninNotice();

  window.Auth = { init, onChange, state, sendMagicLink, google, googleAvailable, signOut,
                  notice: () => notice, client: () => sb, LIVE };
})();
