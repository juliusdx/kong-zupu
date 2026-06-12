/* Supabase auth: email magic-link + Google OAuth, session + profile tracking.
 * Exposes window.Auth. Safe no-op if Supabase isn't configured. */
(function () {
  const cfg = window.APP_CONFIG || {};
  const LIVE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);

  let sb = null, session = null, profile = null;
  const subs = [];

  function state() {
    return { live: LIVE, session, profile, user: session ? session.user : null,
             isAdmin: !!(profile && profile.is_admin) };
  }
  function emit() { subs.forEach(fn => { try { fn(state()); } catch (e) { console.error(e); } }); }
  function onChange(fn) { subs.push(fn); fn(state()); }

  async function loadProfile() {
    profile = null;
    if (!session) return;
    try {
      const { data } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      profile = data || null;
    } catch (e) { console.error("profile load failed", e); }
  }

  async function init() {
    if (!LIVE) { emit(); return; }
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
    emit();
  }

  const redirect = () => location.href.split("#")[0];

  async function sendMagicLink(email) {
    if (!sb) throw new Error("Auth not configured");
    return sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } });
  }
  async function google() {
    if (!sb) throw new Error("Auth not configured");
    return sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect() } });
  }
  async function signOut() {
    if (sb) await sb.auth.signOut();
    session = null; profile = null; emit();
  }

  window.Auth = { init, onChange, state, sendMagicLink, google, signOut,
                  client: () => sb, LIVE };
})();
