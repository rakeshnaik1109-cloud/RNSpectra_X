/* ═══════════════════════════════════════════════════════════
   RNSpectraX™ — deployment config
   ───────────────────────────────────────────────────────────
   EDIT THIS ONE LINE if your homepage lives somewhere else.

   Typical values:
     "../index.html"                     app served from  yoursite.com/rnspectrax/
     "https://rakeshnaik.github.io/"     app served from a different domain
     "https://www.rakeshnaik.com/"       custom domain
═══════════════════════════════════════════════════════════ */
window.RNSPX_HOME_URL = "../index.html";

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-home-link]').forEach(function (a) {
    a.setAttribute('href', window.RNSPX_HOME_URL);
  });
});
