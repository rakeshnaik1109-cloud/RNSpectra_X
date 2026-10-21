/* ═══════════════════════════════════════════════════════════
   RESULT TABS AND DROP-DOWN MENUS
   • The result panels under each plot (peak table, Identify, Analysis,
     comparison, resonance) are shown one at a time behind a row of tabs.
     The code that fills a panel still just sets its display to "block";
     a panel that appears (or is refilled by rxShowResult) becomes the
     active tab. Hiding is done with a class, so a panel's own display
     state — "has results" — is never touched.
   • Export / File menus (<details class="rx-menu">) close on an outside
     click or after an item is chosen.
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var TABS = {
    ocean: { bar: 'oceanResultTabs', items: [['peakTableSection', '🔬 Peaks'], ['idSection', '🧬 Identify'], ['rtSection', '📊 Analysis'], ['oceanComparisonSection', '⇄ Compare']] },
    xy:    { bar: 'xyResultTabs',    items: [['xyDipSection', '◎ Resonance'], ['xyComparisonSection', '⇄ Compare']] }
  };
  var active = { ocean: null, xy: null };

  function hasResults(el) { return !!el && el.style.display !== 'none'; }

  function modeOf(id) {
    return TABS.ocean.items.some(function (it) { return it[0] === id; }) ? 'ocean' : 'xy';
  }

  function render(mode) {
    var cfg = TABS[mode], bar = document.getElementById(cfg.bar); if (!bar) return;
    var avail = cfg.items.filter(function (it) { return hasResults(document.getElementById(it[0])); });
    if (!avail.some(function (it) { return it[0] === active[mode]; })) active[mode] = avail.length ? avail[avail.length - 1][0] : null;
    cfg.items.forEach(function (it) {
      var el = document.getElementById(it[0]); if (!el) return;
      el.classList.toggle('rx-tab-hidden', hasResults(el) && it[0] !== active[mode]);
    });
    // a single result needs no tab row
    bar.style.display = avail.length > 1 ? 'flex' : 'none';
    bar.innerHTML = avail.map(function (it) {
      return '<button type="button" role="tab" class="rx-tab' + (it[0] === active[mode] ? ' is-active' : '') + '" aria-selected="' + (it[0] === active[mode]) + '" data-target="' + it[0] + '">' + it[1] + '</button>';
    }).join('');
  }

  // Show one result panel (called when a tool produces new results)
  window.rxShowResult = function (id) {
    var mode = modeOf(id);
    active[mode] = id;
    render(mode);
  };

  function resizePlots(id) {
    var el = document.getElementById(id); if (!el || !window.Plotly) return;
    el.querySelectorAll('.js-plotly-plot').forEach(function (gd) {
      if (gd.offsetParent === null) return;   // a plot that is itself hidden
      try { Promise.resolve(Plotly.Plots.resize(gd)).catch(function () {}); } catch (e) {}
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    Object.keys(TABS).forEach(function (mode) {
      var cfg = TABS[mode];
      var first = document.getElementById(cfg.items[0][0]); if (!first) return;
      var bar = document.createElement('div');
      bar.id = cfg.bar; bar.className = 'rx-result-tabs'; bar.setAttribute('role', 'tablist'); bar.style.display = 'none';
      // the bar sits before whichever result panel comes first in the page
      var firstInDom = cfg.items.map(function (it) { return document.getElementById(it[0]); }).filter(Boolean)
        .sort(function (a, b) { return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; })[0];
      firstInDom.parentNode.insertBefore(bar, firstInDom);
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('.rx-tab'); if (!b) return;
        active[mode] = b.getAttribute('data-target'); render(mode); resizePlots(active[mode]);
      });
      // a panel switching from hidden to shown becomes the active tab
      cfg.items.forEach(function (it) {
        var el = document.getElementById(it[0]); if (!el) return;
        var was = hasResults(el);
        new MutationObserver(function () {
          var now = hasResults(el);
          if (now && !was) active[mode] = it[0];
          if (now !== was) { was = now; render(mode); }
        }).observe(el, { attributes: true, attributeFilter: ['style'] });
      });
      render(mode);
    });

    // drop-down menus: close on an outside click, and after choosing an item
    document.addEventListener('click', function (e) {
      document.querySelectorAll('details.rx-menu[open]').forEach(function (m) {
        if (!m.contains(e.target)) m.removeAttribute('open');
        else if (e.target.closest('.rx-menu-pop button')) m.removeAttribute('open');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') document.querySelectorAll('details.rx-menu[open]').forEach(function (m) { m.removeAttribute('open'); });
    });
  });
})();
