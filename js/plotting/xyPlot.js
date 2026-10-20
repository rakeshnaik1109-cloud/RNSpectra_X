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

// Combine datasets that share a Group name into one mean curve with its SD and
// SEM. Members are put on the X grid of the first member (linear interpolation)
// over the X range they all cover; when they already share the same X values,
// as columns of one spectrometer file do, no interpolation happens.
// Datasets without a group pass through unchanged.
function buildXYGroups(processed, errKind) {
  const order = [], buckets = {};
  processed.forEach(ds => {
    if (!ds.group) { order.push({ single: ds }); return; }
    if (!buckets[ds.group]) { buckets[ds.group] = []; order.push({ group: ds.group }); }
    buckets[ds.group].push(ds);
  });
  return order.map(o => {
    if (o.single) return o.single;
    const members = buckets[o.group].map(ds => {
      const idx = ds.x.map((_, i) => i).sort((a, b) => ds.x[a] - ds.x[b]);
      return { x: idx.map(i => ds.x[i]), y: idx.map(i => ds.y[i]) };
    });
    const n = members.length;
    const sameX = members.every(m => m.x.length === members[0].x.length && m.x.every((v, i) => v === members[0].x[i]));
    let grid = members[0].x;
    if (!sameX) {
      const lo = Math.max(...members.map(m => m.x[0])), hi = Math.min(...members.map(m => m.x[m.x.length - 1]));
      grid = grid.filter(v => v >= lo && v <= hi);
    }
    const mean = [], sd = [], sem = [];
    grid.forEach((gx, i) => {
      const vals = members.map(m => sameX ? m.y[i] : interpolate(m.x, m.y, gx));
      const mu = vals.reduce((a, b) => a + b, 0) / n;
      const s = n > 1 ? Math.sqrt(vals.reduce((a, v) => a + (v - mu) ** 2, 0) / (n - 1)) : 0;
      mean.push(mu); sd.push(s); sem.push(n > 1 ? s / Math.sqrt(n) : 0);
    });
    const first = buckets[o.group][0];
    return {
      // a one-member group has no spread to show
      x: grid, y: mean, ey: n < 2 ? null : errKind === 'sem' ? sem : errKind === 'sd' ? sd : null, ex: null,
      name: `${o.group} (n=${n})`, color: first.color, isGroup: true, n, members: buckets[o.group].map(d => d.name)
    };
  });
}

// Show an error bar every N points: the "Error bars every" field, or, when it
// is blank, every point for up to 60 points and about 40 bars otherwise.
function errorBarStride(n) {
  const v = parseInt(document.getElementById("xyErrEvery")?.value);
  if (v >= 1) return v;
  return n <= 60 ? 1 : Math.ceil(n / 40);
}

function plotXY() {
  const raw = gatherXYDatasets().filter(ds => ds.x.length && ds.y.length);
  if (!raw.length) { alert("No XY data to plot yet — paste values, add columns or upload a file first (and tick at least one dataset)."); return; }
  const traces = []; lastXYSeries = []; lastFitResults = [];
  const traceMode = document.getElementById("xyTraceStyle")?.value || "lines";
  const scatter = traceMode === "markers";
  const markerSize = parseFloat(document.getElementById("xyMarkerSize")?.value) || 7;
  const symbolSel = document.getElementById("xyMarkerSymbol")?.value || "auto";
  const SYMBOLS = ["circle", "square", "diamond", "triangle-up", "cross", "x", "triangle-down", "star", "pentagon", "hexagon"];
  const showOriginal = document.getElementById("xyShowOriginal")?.checked && document.getElementById("xySmoothType").value !== "none";
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

  // Smoothing and normalisation act on every column first; groups are then
  // averaged from the processed columns (the same order as Raman mode).
  const processed = raw.map(ds => ({ ...ds, y: normalizeData(xySmooth(ds.y), normSel, ds.x) }));
  // the same pipeline without smoothing, for the optional "original" overlay
  const unsmoothed = showOriginal ? raw.map(ds => ({ ...ds, y: normalizeData([...ds.y], normSel, ds.x) })) : null;
  const tab = document.querySelector('.xy-tab.active')?.id;
  const groupMode = tab === 'tabFile' && document.getElementById("xyGroupMode")?.value === 'groups';
  const errKind = document.getElementById("xyGroupErr")?.value || 'sd';
  const errStyle = document.getElementById("xyGroupStyle")?.value || 'band';
  const bandOpacity = parseFloat(document.getElementById("xyGroupBandOpacity")?.value) || 0.22;
  const datasets = groupMode ? buildXYGroups(processed, errKind) : processed;
  const originals = unsmoothed ? (groupMode ? buildXYGroups(unsmoothed, errKind) : unsmoothed) : null;
  if (groupMode && !datasets.some(d => d.isGroup)) rxNotify('No Group names set — plotting each column. Fill the Group boxes or use Quick grouping.');

  datasets.forEach((ds, di) => {
    const yy = ds.y;
    const shiftY = di * yOff, shiftX = di * xOff;
    const xv = ds.x.map(v => v + shiftX);
    let yv = yy.map(v => v + shiftY);
    let dsEy = ds.ey, dsEx = ds.ex;
    if (yDiv !== 1) { yv = yv.map(v => v / yDiv); if (dsEy) dsEy = dsEy.map(v => v / yDiv); }

    const displayName = getDisplayName('xy', 'dataset', di, ds.name);
    const tr = barMode
      ? { type: "bar", x: xv, y: yv, name: displayName, marker: { color: ds.color, line: { width: 0 } }, legendgroup: 'dataset-' + di, meta: { editable: true, kind: 'dataset', idx: di } }
      : { x: xv, y: yv, name: displayName, mode: traceMode, line: { width: lw, color: ds.color }, marker: { color: ds.color, size: markerSize, symbol: symbolSel === "auto" ? SYMBOLS[di % SYMBOLS.length] : symbolSel }, legendgroup: 'dataset-' + di, meta: { editable: true, kind: 'dataset', idx: di } };
    if (originals && originals[di] && !barMode) {
      let oy = originals[di].y.map(v => v + shiftY); if (yDiv !== 1) oy = oy.map(v => v / yDiv);
      traces.push({ x: originals[di].x.map(v => v + shiftX), y: oy, name: displayName + " (original)", mode: "lines", line: { width: Math.max(0.8, lw * 0.6), color: ds.color }, opacity: 0.3, showlegend: false, legendgroup: 'dataset-' + di, hoverinfo: "skip" });
    }
    if (document.getElementById("xyFill").checked && !scatter && !barMode) tr.fill = "tozeroy";
    const groupBars = ds.isGroup && dsEy && (errStyle === 'bars' || errStyle === 'both');
    const groupBand = ds.isGroup && dsEy && (errStyle === 'band' || errStyle === 'both');
    const wantYBars = (showErr && dsEy && !ds.isGroup) || groupBars;
    const wantXBars = showErr && dsEx;
    if (groupBand && !barMode) {
      const band = buildErrorBandTrace(xv, yv, dsEy, ds.color, bandOpacity, displayName);
      if (band) { band.legendgroup = 'dataset-' + di; traces.push(band); }
    }
    // On dense data (a spectrum has thousands of points) bars at every point
    // merge into a smear, so they are drawn on a separate trace of evenly
    // spaced points (with the mean marked) while the curve keeps every point.
    const every = errorBarStride(xv.length);
    const errOn = { thickness: 1.5, width: 4, color: hexToRgba(ds.color, 0.9) };
    if ((wantYBars || wantXBars) && (every > 1 || traceMode === 'lines') && !barMode) {
      const idx = []; for (let i = Math.floor((xv.length % every) / 2); i < xv.length; i += every) idx.push(i);
      const pts = { x: idx.map(i => xv[i]), y: idx.map(i => yv[i]), name: displayName + " (error bars)", mode: "markers",
        marker: { color: ds.color, size: Math.max(5, markerSize - 1), symbol: symbolSel === "auto" ? SYMBOLS[di % SYMBOLS.length] : symbolSel },
        showlegend: false, legendgroup: 'dataset-' + di, hovertemplate: "%{x}<br>%{y} ± %{error_y.array}<extra></extra>" };
      if (wantYBars) pts.error_y = Object.assign({ type: "data", array: idx.map(i => dsEy[i]), visible: true }, errOn);
      if (wantXBars) pts.error_x = Object.assign({ type: "data", array: idx.map(i => dsEx[i]), visible: true }, errOn);
      traces.push(tr, pts);
    } else {
      if (wantYBars) tr.error_y = Object.assign({ type: "data", array: dsEy, visible: true }, errOn);
      if (wantXBars) tr.error_x = Object.assign({ type: "data", array: dsEx, visible: true }, errOn);
      traces.push(tr);
    }

    lastXYSeries.push({ name: displayName + (ds.isGroup && dsEy ? (errKind === 'sem' ? ' [mean, SEM]' : ' [mean, SD]') : ''), x: xv.slice(), y: yv.slice(), eY: dsEy ? dsEy.slice() : null, eX: dsEx ? dsEx.slice() : null });

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
