/* ═══════════════════════════════════════════════════════════
   RNSpectraX™ — workspace theme
   Switches the chrome and control surfaces between light and dark.
   The figure canvas stays white in both modes on purpose: what you
   see is what the exported PNG/SVG will look like in a manuscript.
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var KEY = 'rnspx_theme';

  function apply(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function current() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function preferred() {
    var saved = stored();
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  window.toggleWorkspaceTheme = function () {
    var next = current() === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
    var btn = document.getElementById('themeToggle');
    if (btn) btn.setAttribute('aria-label', next === 'dark' ? 'Switch to light workspace' : 'Switch to dark workspace');
    if (window.rxToast) window.rxToast(next === 'dark' ? 'Dark workspace on' : 'Light workspace on');
    // Plotly reads computed styles at draw time; nudge it to re-measure.
    if (window.Plotly) {
      ['plot-wrapper', 'xy-plot-wrapper'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.data) { try { Plotly.Plots.resize(el); } catch (e) {} }
      });
    }
  };

  apply(preferred());
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('themeToggle');
    if (btn) btn.setAttribute('aria-label', current() === 'dark' ? 'Switch to light workspace' : 'Switch to dark workspace');
  });
})();
