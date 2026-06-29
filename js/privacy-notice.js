/* Privacy / access notice — shown to anonymous visitors; auto-hides on sign-in. */
(function () {
  const DISMISS_KEY = "zupu_pn_dismissed";

  function openSignin() {
    const scrim = document.getElementById("signin-scrim");
    const modal = document.getElementById("signin-modal");
    const msg   = document.getElementById("signin-msg");
    if (scrim)  scrim.classList.add("open");
    if (modal)  modal.classList.add("open");
    if (msg)    msg.textContent = "";
  }

  function init() {
    const notice = document.getElementById("privacy-notice");
    if (!notice) return;

    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch (e) { /* ignore */ }

    function update(st) {
      notice.hidden = !st.live || !!st.user || dismissed;
    }

    const closeBtn  = document.getElementById("pn-close");
    const signinBtn = document.getElementById("pn-signin");

    if (closeBtn) closeBtn.onclick = () => {
      dismissed = true;
      try { localStorage.setItem(DISMISS_KEY, "1"); } catch (e) { /* ignore */ }
      notice.hidden = true;
    };
    if (signinBtn) signinBtn.onclick = openSignin;

    if (window.Auth && window.Auth.onChange) Auth.onChange(update);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
