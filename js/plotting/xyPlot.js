/* ═══════════════════════════════════════════════════════════
   XY MODE — DATASETS, FILES, FITTING, ERROR BARS
═══════════════════════════════════════════════════════════ */
// Axis-label presets per data type. Choosing a type only pre-fills the labels
// (and the X direction where a field conventionally reverses it); the data
// itself is never interpreted differently.
let XY_HINTS = {
  general:      { badge:"General XY",         xlabel:"X",                       ylabel:"Y" },
  ftir:         { badge:"FTIR Spectrum",      xlabel:"Wavenumber (cm⁻¹)",       ylabel:"Transmittance (%)",   invertX:true },
  uv:           { badge:"UV-Vis Spectrum",    xlabel:"Wavelength (nm)",         ylabel:"Absorbance (a.u.)" },
  fluorescence: { badge:"Fluorescence / PL",  xlabel:"Wavelength (nm)",         ylabel:"Intensity (a.u.)" },
  xrd:          { badge:"XRD Pattern",        xlabel:"2θ (degrees)",            ylabel:"Intensity (counts)" },
  xps:          { badge:"XPS Spectrum",       xlabel:"Binding Energy (eV)",     ylabel:"Intensity (counts/s)", invertX:true },
  iv:           { badge:"I–V Curve",          xlabel:"Voltage (V)",             ylabel:"Current (A)" },
  time:         { badge:"Time Series",        xlabel:"Time (s)",                ylabel:"Signal (a.u.)" },
  thermal:      { badge:"Thermal Analysis",   xlabel:"Temperature (°C)",        ylabel:"Mass (%)" },
  calibration:  { badge:"Calibration Curve",  xlabel:"Concentration",           ylabel:"Response" },
  custom:       { badge:"Custom",             xlabel:"",                        ylabel:"" }
};


/* ═══════════════════════════════════════════════════════════
   XY PLOT (scatter, lines, error bars, offsets, fitting overlay)
═══════════════════════════════════════════════════════════ */
// XY smoothing with the panel's settings. For Gaussian smoothing the first
// field is σ (in points); for the other filters it is the window length.
function xySmooth(y) {
  const type = document.getElementById("xySmoothType").value;
  const p1 = parseFloat(document.getElementById("xySmP1").value) || 5;
  return applySmoothing([...y], type, p1, parseInt(document.getElementById("xySmP2").value) || 2, type === 'gaussian' ? p1 : 2);
}

function plotXY() {
  const datasets = gatherXYDatasets().filter(ds => ds.x.length && ds.y.length);
  if (!datasets.length) { alert("No XY data to plot yet — paste values, add columns or upload a file first."); return; }
  const traces = []; lastXYSeries = []; lastFitResults = [];
  const scatter = document.getElementById("xyScatter").checked;
  const barMode = document.getElementById("xyBarMode").checked;
  const showErr = document.getElementById("xyShowErr").checked;
  const yOff = parseFloat(document.getElementById("xyYOffset").value) || 0;
  const xOff = parseFloat(document.getElementById("xyXOffset").value) || 0;
  const lw = parseFloat(document.getElementById("xyLinewidth").value) || 2;
  const fitModelSel = document.getElementById("fitModel").value;
  const fitAll = document.getElementById("fitAll").checked;
  const showEq = document.getElementById("fitShowEq").checked;
  const fitOrder = parseInt(document.getElementById("fitOrder").value) || 2;
  const normSel = document.getElementById("xyNorm").value;

  const yDiv = getYDivisor("xy");

  datasets.forEach((ds, di) => {
    let yy = xySmooth(ds.y);
    yy = normalizeData(yy, normSel, ds.x);
    const shiftY = di * yOff, shiftX = di * xOff;
    const xv = ds.x.map(v => v + shiftX);
    let yv = yy.map(v => v + shiftY);
    let dsEy = ds.ey, dsEx = ds.ex;
    if (yDiv !== 1) { yv = yv.map(v => v / yDiv); if (dsEy) dsEy = dsEy.map(v => v / yDiv); }

    const displayName = getDisplayName('xy', 'dataset', di, ds.name);
    const tr = barMode
      ? { type: "bar", x: xv, y: yv, name: displayName, marker: { color: ds.color, line: { width: 0 } }, legendgroup: 'dataset-' + di, meta: { editable: true, kind: 'dataset', idx: di } }
      : { x: xv, y: yv, name: displayName, mode: scatter ? "markers" : "lines", line: { width: lw, color: ds.color }, marker: { color: ds.color, size: scatter ? 7 : 4 }, legendgroup: 'dataset-' + di, meta: { editable: true, kind: 'dataset', idx: di } };
    if (document.getElementById("xyFill").checked && !scatter && !barMode) tr.fill = "tozeroy";
    if (showErr && dsEy) tr.error_y = { type: "data", array: dsEy, visible: true, thickness: 1.2, width: 3, color: hexToRgba(ds.color, 0.6) };
    if (showErr && dsEx) tr.error_x = { type: "data", array: dsEx, visible: true, thickness: 1.2, width: 3, color: hexToRgba(ds.color, 0.6) };
    traces.push(tr);

    lastXYSeries.push({ name: displayName, x: xv.slice(), y: yv.slice(), eY: dsEy ? dsEy.slice() : null, eX: dsEx ? dsEx.slice() : null });

    // fitting — done on the processed data before any display offset/divisor,
    // so reported parameters are in the units of the data itself
    if (fitModelSel !== 'none' && (fitAll || di === 0)) {
      const fit = fitModel(ds.x, yy, fitModelSel, fitOrder, ds.ey);
      if (fit) {
        if (fit.weighted && normSel !== 'none') fit.redChi2 = null; // σ no longer in the units of the normalised Y
        const xs = ds.x.slice().sort((a, b) => a - b);
        const fineX = []; const steps = 400; const lo = xs[0], hi = xs[xs.length - 1];
        for (let s = 0; s <= steps; s++) fineX.push(lo + (hi - lo) * s / steps);
        let fineY = fineX.map(fit.predict).map(v => Number.isFinite(v) ? v + shiftY : null);
        if (yDiv !== 1) fineY = fineY.map(v => v === null ? null : v / yDiv);

        const traceColor = fitAll ? ds.color : "#475569";
        const fitDefaultName = `Fit: ${ds.name} (R²=${fit.r2.toFixed(4)})`;
        const fitDisplayName = getDisplayName('xy', 'fit', di, fitDefaultName);
        traces.push({ x: fineX.map(v => v + shiftX), y: fineY, mode: "lines", line: { width: lw, color: traceColor, dash: "dash" }, name: fitDisplayName, meta: { editable: true, kind: 'fit', idx: di } });

        fit.datasetName = ds.name;
        lastFitResults.push(fit);
      } else {
        lastFitResults.push({ failed: true, datasetName: ds.name, model: fitModelSel });
      }
    }
  });

  renderFitResultsBox(showEq);
  renderCanvasTracesAndLayout(traces, [], resolveFont("xy", "xyBoldTick"), document.getElementById("xy-plot-wrapper"), 'xy');
}
