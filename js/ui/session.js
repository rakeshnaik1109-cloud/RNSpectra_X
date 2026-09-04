/* ═══════════════════════════════════════════════════════════
   RNSpectraX™ — session memory
   Remembers every processing and styling control between visits so a
   analysis recipe survives a reload. Spectrum files are NOT stored:
   they never leave the machine and are never written to disk.

   Cards created per file (label0, color0, group0 …) are skipped, since
   their ids only exist while that file is loaded.
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var KEY = 'rnspx_session_v1';
  var SAVE_DELAY = 400;
  var timer = null;
  var ready = false;

  // Ids that belong to a loaded file rather than to the recipe.
  var TRANSIENT = /^(label|color|group|pk-|xy-pk-|cmp-)/;

  function isPersistable(el) {
    if (!el.id || TRANSIENT.test(el.id)) return false;
    if (el.type === 'file' || el.type === 'button' || el.type === 'submit') return false;
    if (el.closest && el.closest('#spectrumControls')) return false;
    return true;
  }

  function collect() {
    var out = {};
    document.querySelectorAll('input[id], select[id], textarea[id]').forEach(function (el) {
      if (!isPersistable(el)) return;
      out[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
    });
    return out;
  }

  function save() {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), v: collect() })); } catch (e) {}
  }

  function scheduleSave() {
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY);
  }

  function restore() {
    var raw;
    try { raw = localStorage.getItem(KEY); } catch (e) { return 0; }
    if (!raw) return 0;

    var data;
    try { data = JSON.parse(raw).v || {}; } catch (e) { return 0; }

    var restored = 0;
    Object.keys(data).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !isPersistable(el)) return;
      var val = data[id];
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked === val) return;
        el.checked = val;
      } else {
        if (el.value === val) return;
        el.value = val;
      }
      restored++;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return restored;
  }

  window.clearWorkspaceSession = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    if (window.rxToast) window.rxToast('Saved settings cleared — reload for defaults');
  };

  document.addEventListener('DOMContentLoaded', function () {
    // Let the app finish its own DOMContentLoaded wiring first.
    setTimeout(function () {
      var n = restore();
      ready = true;
      document.addEventListener('input', scheduleSave, true);
      document.addEventListener('change', scheduleSave, true);
      if (n && window.rxToast) window.rxToast('Restored ' + n + ' settings from your last session');
    }, 80);
  });
})();
