/* ═══════════════════════════════════════════════════════════
   RNSpectraX™ — bridge.js
   "→ RNBeamX": hand the plot on screen to RNBeamX, the optical
   setup designer, so a spectrum can sit next to its setup as
   panel b of one figure.

   Both apps live on the same site, so the plot is passed through
   this browser's storage (nothing is uploaded). If RNBeamX runs
   from elsewhere, use "↓ Plotted CSV" and import that file in
   RNBeamX instead: it reads the same format.
═══════════════════════════════════════════════════════════ */
window.RNSPX_BEAMX_URL = window.RNSPX_BEAMX_URL || "https://rakeshnaik1109-cloud.github.io/RNBeamX/";

function sendToRNBeamX(wrapperId) {
  var gd = document.getElementById(wrapperId);
  if (!gd || !gd.data || !gd.data.length) { alert("Plot something first, then send it to RNBeamX."); return; }
  var fl = gd._fullLayout || {};
  var title = function (ax) { return ax && ax.title ? (ax.title.text || "") : ""; };
  var series = [];
  gd.data.forEach(function (t, i) {
    // keep the visible data curves; skip SD/SEM bands and helper traces
    if (!t.x || !t.y || t.visible === false || t.fill === "toself" || t.fill === "tonexty" || t.showlegend === false) return;
    var full = (gd._fullData && gd._fullData[i]) || t;
    var line = full.line || {}, marker = full.marker || {};
    series.push({
      name: t.name || ("Series " + (series.length + 1)),
      x: Array.prototype.slice.call(t.x).map(Number),
      y: Array.prototype.slice.call(t.y).map(Number),
      color: line.color || marker.color || null,
      dash: line.dash === "dash" || line.dash === "longdash" ? "dash" : line.dash === "dot" ? "dot" : "solid"
    });
  });
  if (!series.length) { alert("No data curves found in this plot."); return; }
  var payload = {
    app: "RNSpectraX", time: Date.now(), title: (fl.title && fl.title.text) || "",
    xlabel: title(fl.xaxis), ylabel: title(fl.yaxis),
    xreverse: !!(fl.xaxis && fl.xaxis.autorange === "reversed"),
    series: series
  };
  try { localStorage.setItem("rnfamily_handoff", JSON.stringify(payload)); }
  catch (e) { alert("This browser could not store the plot (" + e.message + "). Use ↓ Plotted CSV and import the file in RNBeamX."); return; }
  window.open(window.RNSPX_BEAMX_URL + "?from=rnspectrax", "rnbeamx");
}
