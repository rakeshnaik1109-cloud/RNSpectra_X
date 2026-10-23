/* ═══════════════════════════════════════════════════════════
   GUIDE LINKS
   A small ⓘ next to each processing / analysis section title opens the
   methods guide (guide.html) in a new tab at the matching explanation.
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var GUIDE = 'guide.html';
  // section title (start of its text) → guide anchor
  var MAP = [
    [/^Despiking/, 'despike'], [/^Baseline Correction/, 'baseline'], [/^Smoothing/, 'smoothing'],
    [/^Normalization/, 'normalisation'], [/^Calibration, Regions/, 'calibration'],
    [/^③ Averaging/, 'averaging'], [/^🧬 Identify/, 'identify'], [/^🔬 Analysis/, 'peakfit'],
    [/^③ Curve Fitting/, 'xyfit'], [/^⑤ Resonance/, 'resonance']
  ];
  window.rxGuideUrl = function (anchor) { return (window.RNSX_GUIDE_URL || GUIDE) + (anchor ? '#' + anchor : ''); };
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.collapsible-header .section-title').forEach(function (t) {
      var text = t.textContent.trim(), hit = MAP.find(function (m) { return m[0].test(text); });
      if (!hit) return;
      var a = document.createElement('a');
      a.className = 'rx-guide-link'; a.href = rxGuideUrl(hit[1]); a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.title = 'How this works — the physics and mathematics (opens the guide)'; a.setAttribute('aria-label', a.title);
      a.textContent = 'ⓘ';
      // the header toggles its section on click; the link must not
      a.addEventListener('click', function (e) { e.stopPropagation(); });
      t.appendChild(a);
    });
    // the Analysis tool selector points the ⓘ at the chosen tool
    var tool = document.getElementById('rtTool');
    if (tool) tool.addEventListener('change', function () {
      var link = document.querySelector('#oceanSecAnalysis .rx-guide-link');
      var to = { peakfit: 'peakfit', ratio: 'ratio', pca: 'pca', diff: 'difference' }[tool.value];
      if (link && to) link.href = rxGuideUrl(to);
    });
  });
})();
