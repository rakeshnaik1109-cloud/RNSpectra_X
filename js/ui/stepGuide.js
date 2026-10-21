/* ═══════════════════════════════════════════════════════════
   STEP GUIDE
   The quick-nav buttons at the top of each control panel get a ✓ once
   that step has been used (data loaded, a processing step chosen, a plot
   drawn, a result produced), and the next thing to do is highlighted:
   "① Data" before anything is loaded, then "▶ Plot" until a plot exists.
   Purely visual — it reads the controls, never changes them.
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var val = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
  var shown = function (id) { var el = document.getElementById(id); return !!el && el.style.display !== 'none'; };
  var plotted = function (id) { var el = document.getElementById(id); return !!(el && el.data && el.data.length); };

  var STEPS = {
    ocean: {
      panel: 'oceanControlPanel', plotWrap: 'plot-wrapper', plotFn: 'plotSpectrum()',
      steps: {
        oceanSecData: function () { var n = spectra.filter(Boolean).length; return n ? n + ' spectr' + (n === 1 ? 'um' : 'a') + ' loaded' : ''; },
        oceanSecProcess: function () {
          var used = [['despikeType', 'despiking'], ['baselineType', 'baseline'], ['smoothType', 'smoothing'], ['normType', 'normalisation']]
            .filter(function (p) { return val(p[0]) && val(p[0]) !== 'none'; }).map(function (p) { return p[1]; });
          if ((parseInt(val('rsDeriv')) || 0) > 0) used.push('derivative');
          if (parseFloat(val('rsShift'))) used.push('shift correction');
          if (val('rsExclude').trim()) used.push('excluded regions');
          return used.join(', ');
        },
        oceanSecAverage: function () { return val('avgMode') !== 'individual' ? (val('avgMode') === 'groups' ? 'group averages' : 'grand average') : ''; },
        oceanSecStyle: function () { return plotted('plot-wrapper') ? 'plot drawn' : ''; },
        oceanSecIdentify: function () { return shown('idSection') ? 'library match done' : ''; },
        oceanSecAnalysis: function () { return shown('rtSection') ? 'analysis run' : ''; }
      }
    },
    xy: {
      panel: 'xyControlPanel', plotWrap: 'xy-plot-wrapper', plotFn: 'plotXY()',
      steps: {
        xySecData: function () { try { var n = gatherXYDatasets().filter(function (d) { return d.x.length && d.y.length; }).length; return n ? n + ' dataset' + (n === 1 ? '' : 's') + ' ready' : ''; } catch (e) { return ''; } },
        xySecProcess: function () {
          var used = [];
          if (val('xySmoothType') && val('xySmoothType') !== 'none') used.push('smoothing');
          if (val('xyNorm') && val('xyNorm') !== 'none') used.push('normalisation');
          return used.join(', ');
        },
        xySecFit: function () { return val('fitModel') && val('fitModel') !== 'none' ? 'fit model chosen' : ''; },
        xySecStyle: function () { return plotted('xy-plot-wrapper') ? 'plot drawn' : ''; },
        xySecDip: function () { return shown('xyDipSection') ? 'resonances found' : ''; }
      }
    }
  };

  function update() {
    Object.keys(STEPS).forEach(function (mode) {
      var cfg = STEPS[mode], panel = document.getElementById(cfg.panel); if (!panel) return;
      var hasData = false;
      panel.querySelectorAll('.quick-nav-pill').forEach(function (pill) {
        var m = (pill.getAttribute('onclick') || '').match(/jumpToSection\('[^']+','([^']+)'\)/);
        var fn = m && cfg.steps[m[1]]; if (!fn) return;
        var done = '';
        try { done = fn(); } catch (e) { done = ''; }
        if (/SecData$/.test(m[1])) hasData = !!done;
        pill.classList.toggle('is-done', !!done);
        pill.title = done ? '✓ ' + done : '';
      });
      // what to do next: load data, then plot
      var dataPill = panel.querySelector('.quick-nav-pill[onclick*="SecData\'"]');
      if (dataPill) dataPill.classList.toggle('is-next', !hasData);
      var plotBtn = panel.querySelector('.panel-actions .btn-primary[onclick="' + cfg.plotFn + '"]');
      if (plotBtn) plotBtn.classList.toggle('is-next', hasData && !plotted(cfg.plotWrap));
    });
  }

  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(update, 120); }

  document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('change', schedule, true);
    document.addEventListener('input', schedule, true);
    // plots drawn, files added or removed, results shown
    var mo = new MutationObserver(schedule);
    ['plot-wrapper', 'xy-plot-wrapper', 'oceanFileChips', 'xyFileCards'].forEach(function (id) {
      var el = document.getElementById(id); if (el) mo.observe(el, { childList: true });
    });
    ['idSection', 'rtSection', 'xyDipSection'].forEach(function (id) {
      var el = document.getElementById(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['style'] });
    });
    setTimeout(update, 200);   // after the saved session has been restored
  });
})();
