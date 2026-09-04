/* ═══════════════════════════════════════════════════════════
   XY MODE — DATASETS, FILES, FITTING, ERROR BARS
═══════════════════════════════════════════════════════════ */
let XY_HINTS = { general:{ badge:"General XY", xlabel:"X Matrix" }, ftir:{ badge:"FTIR Spectrum", xlabel:"Wavenumber (cm⁻¹)" }, uv:{ badge:"UV-Vis Spectrum", xlabel:"Wavelength (nm)" }, xrd:{ badge:"XRD Pattern", xlabel:"2θ (degrees)" }, fluorescence:{ badge:"Fluorescence", xlabel:"Wavelength (nm)" }, custom:{ badge:"Custom", xlabel:"" } };


/* ═══════════════════════════════════════════════════════════
   XY PLOT (scatter, lines, error bars, offsets, fitting overlay)
═══════════════════════════════════════════════════════════ */
function plotXY() {
  const datasets = gatherXYDatasets(); if (!datasets.length) { alert("Staging layout is empty."); return; }
  const traces = []; let localPeakList = []; lastXYSeries = []; lastFitResults = [];
  const scatter = document.getElementById("xyScatter").checked;
  const showErr = document.getElementById("xyShowErr").checked;
  const yOff = parseFloat(document.getElementById("xyYOffset").value) || 0;
  const xOff = parseFloat(document.getElementById("xyXOffset").value) || 0;
  const lw = parseFloat(document.getElementById("xyLinewidth").value);
  const fitModelSel = document.getElementById("fitModel").value;
  const fitAll = document.getElementById("fitAll").checked;
  const showEq = document.getElementById("fitShowEq").checked;
  const fitOrder = parseInt(document.getElementById("fitOrder").value) || 2;

  const yDiv = getYDivisor("xy");

  datasets.forEach((ds, di) => {
    let yy = applySmoothing([...ds.y], document.getElementById("xySmoothType").value, parseInt(document.getElementById("xySmP1").value) || 5, parseInt(document.getElementById("xySmP2").value) || 2, 2);
    yy = normalizeData(yy, document.getElementById("xyNorm").value);
    const shiftY = di * yOff, shiftX = di * xOff;
    const xv = ds.x.map(v => v + shiftX);
    let yv = yy.map(v => v + shiftY);
    let dsEy = ds.ey, dsEx = ds.ex;
    if (yDiv !== 1) { yv = yv.map(v => v / yDiv); if (dsEy) dsEy = dsEy.map(v => v / yDiv); }

    const displayName = getDisplayName('xy', 'dataset', di, ds.name);
    const tr = { x: xv, y: yv, name: displayName, mode: scatter ? "markers" : "lines", line: { width: lw, color: ds.color }, marker: { color: ds.color, size: scatter ? 7 : 4 }, legendgroup: 'dataset-' + di, meta: { editable: true, kind: 'dataset', idx: di } };
    if (document.getElementById("xyFill").checked && !scatter) tr.fill = "tozeroy";
    if (showErr && dsEy) tr.error_y = { type: "data", array: dsEy, visible: true, thickness: 1.2, width: 3, color: hexToRgba(ds.color, 0.6) };
    if (showErr && dsEx) tr.error_x = { type: "data", array: dsEx, visible: true, thickness: 1.2, width: 3, color: hexToRgba(ds.color, 0.6) };
    traces.push(tr);

    lastXYSeries.push({ name: displayName, x: xv.slice(), y: yv.slice(), eY: dsEy ? dsEy.slice() : null, eX: dsEx ? dsEx.slice() : null });

    // fitting
    if (fitModelSel !== 'none' && (fitAll || di === 0)) {
      const fit = fitModel(ds.x, yy, fitModelSel, fitOrder);
      if (fit) {
        const xs = ds.x.slice().sort((a, b) => a - b);
        const fineX = []; const steps = 300; const lo = xs[0], hi = xs[xs.length - 1];
        for (let s = 0; s <= steps; s++) fineX.push(lo + (hi - lo) * s / steps);
        let fineY = fineX.map(fit.predict).map(v => v + shiftY);
        if (yDiv !== 1) fineY = fineY.map(v => v / yDiv);

        // Dynamic Fit Color Logic
       const traceColor = fitAll ? ds.color : "#475569";

        const fitDefaultName = `Fit: ${ds.name} (R²=${fit.r2.toFixed(4)})`;
        const fitDisplayName = getDisplayName('xy', 'fit', di, fitDefaultName);
        traces.push({ x: fineX.map(v => v + shiftX), y: fineY, mode: "lines", line: { width: lw, color: traceColor, dash: "dash" }, name: fitDisplayName, meta: { editable: true, kind: 'fit', idx: di } });
        
        fit.datasetName = ds.name;
        lastFitResults.push(fit);
      }
    }
    if (document.getElementById("xyShowPeaks").checked && yy.length > 2) runPeakDetectionAlgorithm(xv, yv).forEach(i => localPeakList.push({ x: xv[i], y: yv[i], note: "Target band" }));
  });

  renderFitResultsBox(showEq);
  lastXYPeaks = localPeakList;
  renderCanvasTracesAndLayout(traces, lastXYPeaks, resolveFont("xy", "xyBoldTick"), document.getElementById("xy-plot-wrapper"), 'xy');
  if (document.getElementById("xyShowPeaks").checked && lastXYPeaks.length) buildXyPeakTableHTML(); else document.getElementById("xyPeakTableSection").style.display = "none";
}