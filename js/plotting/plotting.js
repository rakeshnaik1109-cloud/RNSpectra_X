/* Add this utility function at the top of plotting.js (moved from index.html) */
function showPlotArea(mode) {
  if (mode === 'ocean') {
    document.getElementById('oceanEmptyState').style.display = 'none';
    document.getElementById('plot-wrapper').style.display = 'block';
    const tb = document.getElementById('oceanAnnotToolbar'); if (tb) tb.style.display = 'flex';
  } else {
    document.getElementById('xyEmptyState').style.display = 'none';
    document.getElementById('xy-plot-wrapper').style.display = 'block';
    const tb = document.getElementById('xyAnnotToolbar'); if (tb) tb.style.display = 'flex';
  }
}




function plotSpectrum() {
  const activeSpectra = spectra.filter(s => s != null);
  if (!activeSpectra.length) { alert("Please load files first."); return; }
  const doPeaks = document.getElementById("showPeaks").checked;
  const font = resolveFont("", "boldTick");
  const wrapper = document.getElementById("plot-wrapper");
  const yDiv = getYDivisor("");
  const lw = parseFloat(document.getElementById("linewidth").value);
  const yOff = parseFloat(document.getElementById("yOffset").value) || 0;
  const xOff = parseFloat(document.getElementById("xOffset").value) || 0;
  const cascade = document.getElementById("cascadeOffset").checked;
  const errStyle = document.getElementById("errBarStyle").value;
  const bandOpacity = parseFloat(document.getElementById("bandOpacity").value);
  const yErrMode = document.getElementById("errBarY").value;
  const xErrMode = document.getElementById("errBarX").value;
  const avgMode = document.getElementById("avgMode").value;

  const traces = []; let detectedPeaks = []; lastPlottedSeries = [];

 const pushSeries = (name, x, y, color, eY, eX, baseline = null, raw = null, shift = 0, kind = "file", idx = 0) => {

    // Manual Y-axis scale divisor (e.g. show 5000 as 5, with the axis label
    // annotated accordingly) — applied uniformly at the single funnel point.
    if (yDiv !== 1) {
        y = y.map(v => v / yDiv);
        if (eY) eY = eY.map(v => v / yDiv);
        if (baseline) baseline = baseline.map(v => v / yDiv);
        if (raw) raw = raw.map(v => v / yDiv);
    }

    const displayName = getDisplayName('ocean', kind, idx, name);
    const seriesGroup = `${kind}-${idx}`;

    lastPlottedSeries.push({
        name: displayName,
        x: x.slice(),
        y: y.slice(),
        eY: eY ? eY.slice() : null,
        eX: eX ? eX.slice() : null
    });

    const tr = {
        x,
        y,
        mode: "lines",
        line: {
            width: lw,
            color
        },
        name: displayName,
        legendgroup: seriesGroup,
        meta: { editable: true, kind, idx }
    };

    if (eY) {

        const eyObj = buildErrorBarObj("y", eY);
        const exObj = buildErrorBarObj("x", eX);

        // X Error Bars
        if (exObj)
            tr.error_x = exObj;

        // -----------------------------
        // Error Visualization
        // -----------------------------

        if (errStyle === "bars") {

            if (eyObj)
                tr.error_y = eyObj;

        }

        else if (errStyle === "band") {

            const band = buildErrorBandTrace(
                x,
                y,
                eY,
                color,
                bandOpacity,
                name
            );

            if (band) { band.legendgroup = seriesGroup; traces.unshift(band); }

        }

        else if (errStyle === "both") {

            if (eyObj)
                tr.error_y = eyObj;

            const band = buildErrorBandTrace(
                x,
                y,
                eY,
                color,
                bandOpacity,
                name
            );

            if (band) { band.legendgroup = seriesGroup; traces.unshift(band); }

        }

        // errStyle === "none"
        // do nothing

    }
    
    // Original spectrum
if (
    document.getElementById("showOriginal").checked &&
    raw
) {

    traces.push({

        x: x,

        y: raw.map(v => v + shift),

        mode: "lines",

        line: {
            color: "#9ca3af",
            width: 1.2
        },

        opacity: 0.6,

        name: name + " Original",

        showlegend: false,
        legendgroup: seriesGroup

    });

}


// --- Baseline overlay (inherits the trace's own color) ---
    if (document.getElementById("showBaseline").checked && baseline) {
        traces.push({
            x: x,
            y: baseline.map(v => v + shift),
            mode: "lines",
            line: {
                color: color,
                width: parseFloat(document.getElementById("baselineWidth").value) || 1.5,
                dash: document.getElementById("baselineDash").value || "dash"
            },
            opacity: parseFloat(document.getElementById("baselineOpacity").value) || 0.8,
            name: name + " Baseline",
            showlegend: false,
            legendgroup: seriesGroup,
            hovertemplate: "<b>Estimated Baseline</b><br>X: %{x:.2f}<br>Y: %{y:.4f}<extra></extra>"
        });
    }

    traces.push(tr);

    if (doPeaks && y.length > 2) {

        runPeakDetectionAlgorithm(x, y).forEach(i =>

            detectedPeaks.push({

                x: x[i],
                y: y[i]

            })

        );

    }

};

  if (avgMode === "grandavg") {

    const agg = averageSpecs(activeSpectra);
    if (!agg) return;

    const eY =
        yErrMode === "sd" ? agg.sd :
        yErrMode === "sem" ? agg.sem :
        null;

    const avgNameField = (document.getElementById("avgLegendName")?.value || "").trim();
    pushSeries(
        avgNameField || `Grand Average (n=${agg.n})`,
        agg.x,
        agg.mean,
        document.getElementById("avgColor").value,
        eY,
        null,
        null, null, 0,
        "avg", 0
    );

}
    

   else if (avgMode === "groups") {
    // bucket by group name
    const groups = {};
    activeSpectra.forEach(spec => {
      const g = (document.getElementById("group" + spec.gIdx)?.value || "Group 1").trim() || "Group 1";
      (groups[g] = groups[g] || []).push(spec);
    });
    const gNames = Object.keys(groups);
    gNames.forEach((g, gi) => {
      const agg = averageSpecs(groups[g]); if (!agg) return;
      const color = GROUP_COLORS[gi % GROUP_COLORS.length];
      const eY = yErrMode === 'sd' ? agg.sd : yErrMode === 'sem' ? agg.sem : null;
      const shift = cascade ? gi * yOff : yOff;
      const xshift = cascade ? gi * xOff : xOff;
      const y = agg.mean.map(v => v + shift);
      const x = agg.x.map(v => v + xshift);
      pushSeries(`${g} (n=${agg.n})`, x, y, color, eY, null, null, null, 0, "group", gi);
    });

  } else { // individual
    activeSpectra.forEach((spec, idx) => {
      const { xx, yy, baseline,raw} = processSpec(spec); const gIdx = spec.gIdx ?? idx;
      const color = document.getElementById("color" + gIdx).value; const label = document.getElementById("label" + gIdx).value;
      const shift = cascade ? idx * yOff : yOff;
      const xshift = cascade ? idx * xOff : xOff;
      const y = yy.map(v => v + shift); const x = xx.map(v => v + xshift);
      pushSeries(label, x, y, color, null, null, baseline, raw, shift, "file", gIdx);
    });
  }

 lastPeaksData = filterPeakAnnotations(

    detectedPeaks.map(pk => {

        const match = lookUpDefaultBiomolecularAssignment(pk.x);

        return {

            x: pk.x,
            y: pk.y,
            mode: match.mode,
            assign: match.assign

        };

    }),

    parseFloat(document.getElementById("labelSpacing").value),

    parseInt(document.getElementById("maxPeakLabels").value)

);
  renderCanvasTracesAndLayout(traces, lastPeaksData, font, wrapper, 'ocean');
  if (doPeaks && lastPeaksData.length) buildOceanPeakTableHTML(); else document.getElementById("peakTableSection").style.display = "none";
}






function renderCanvasTracesAndLayout(traces, peakDataMatrix, font, wrapper, mode) {
  // 1. PREVENT DUPLICATION: Strip old UI traces before injecting new ones 
  // so the legend doesn't multiply every time you click update.
  let cleanTraces = traces.filter(t => 
      !t.isGuide && 
      !t.isPeakMarker && 
      !t.isCommonLegend &&
      !t.isInsetClone &&
      t.name !== "Common Peaks" // Catches any old remnants
  );

  showPlotArea(mode);
  const isOcean = (mode === 'ocean');
  const W = isOcean ? Math.max(300, parseInt(document.getElementById("figWidth").value) || 1000) : Math.max(300, parseInt(document.getElementById("xyFigWidth").value) || 1000);
  const H = isOcean ? Math.max(200, parseInt(document.getElementById("figHeight").value) || 600) : Math.max(200, parseInt(document.getElementById("xyFigHeight").value) || 600);

  wrapper.style.width = W + "px"; 
  wrapper.style.height = H + "px"; 
  Plotly.purge(wrapper);

  const showPeakGuides = document.getElementById("showPeakGuides").checked;
  const guideLineColor = document.getElementById("guideLineColor").value;
  const guideLineWidth = parseFloat(document.getElementById("guideLineWidth").value);
  const guideLineOpacity = parseFloat(document.getElementById("guideLineOpacity").value);
  const guideLineDash = document.getElementById("guideLineDash").value;

  // --- Peak Guides (Dropdown Lines) ---
  if (showPeakGuides && document.getElementById(isOcean ? "showPeaks" : "xyShowPeaks").checked) {
    peakDataMatrix.forEach(pk => {
        cleanTraces.unshift({
            x: [pk.x, pk.x], y: [0, pk.y], mode: "lines",
            line: { color: guideLineColor, width: guideLineWidth, dash: guideLineDash },
            opacity: guideLineOpacity, hoverinfo: "skip", showlegend: false,
            isGuide: true // Tagged for cleanup
        });
    });
  }

  // --- Red Peak Markers ---
  if (document.getElementById(isOcean ? "showPeaks" : "xyShowPeaks").checked && peakDataMatrix.length > 0) {
    cleanTraces.push({
        x: peakDataMatrix.map(p => p.x), y: peakDataMatrix.map(p => p.y),
        mode: "markers", marker: { color: "#dc2626", size: 6, symbol: "circle" },
        showlegend: false, hoverinfo: "x+y",
        isPeakMarker: true // Tagged for cleanup
    });
  }

  const annotations = [];
  const shapes = []; // Used for drawing full-height background lines

  // --- PROFESSIONAL COMMON PEAKS (Full-Height Bands) ---
  if (analyzedCommonPeaks.length > 0) {
      
    analyzedCommonPeaks.forEach(pk => {
        // 1. Draw the dotted line behind the spectra
        // Fix: Lowered opacity to 0.35 and width to 1.5 for a subtle background look
        shapes.push({
            type: 'line', xref: 'x', yref: 'paper', 
            x0: pk.x, x1: pk.x, y0: 0, y1: 1,
            line: { color: 'rgba(22, 163, 74, 0.35)', width: 1.5, dash: 'dot' },
            layer: 'below'
        });
        
        // 2. The top text annotations have been DELETED here to prevent the "barcode" overlapping.
        // Your primary red markers will handle labeling the significant wavenumber values.
    });

    // 3. Keep the single dummy trace so the Legend stays pristine
    cleanTraces.push({
        x: [null], y: [null], mode: "lines",
        line: { color: "rgba(22, 163, 74, 0.7)", width: 2, dash: "dot" },
        name: "Universal Common Peak", showlegend: true, hoverinfo: "none",
        isCommonLegend: true 
    });
  }

  // --- Standard Peak Annotations ---
  if (document.getElementById(isOcean ? "showPeaks" : "xyShowPeaks").checked) {
    peakDataMatrix.forEach(pk => {
        annotations.push({
            x: pk.x, y: pk.y, text: String(Math.round(pk.x)),
            showarrow: true, arrowhead: 0, arrowsize: 1, arrowwidth: 1, arrowcolor: "#555",
            ax: 0, ay: -25, font: { family: font, size: 10, color: "#111" }
        });
    });
  }

  // --- Layout Assembly ---
  const prefix = isOcean ? "" : "xy";
  const legX = parseFloat(document.getElementById(isOcean ? "legendX" : "xyLegendX").value);
  const legY = parseFloat(document.getElementById(isOcean ? "legendY" : "xyLegendY").value);
  const titleFontSize = isOcean ? parseInt(document.getElementById("titleSize").value) : parseInt(document.getElementById("xyTitleSize").value);

  // Independent per-element font family + bold — Font Family is shared (one
  // consistent typeface across the figure, as journals expect), but Bold is
  // now genuinely independent per element instead of one global toggle.
  const familyOnly = resolveFont(prefix, '__none__'); // bold always false here -> just the chosen family, unmodified
  const boldTitleOn = $chk(fid(prefix, 'BoldTitle'), false);
  const boldAxisOn = $chk(fid(prefix, 'BoldAxisLabel'), false);
  const tickFont = resolveFont(prefix, fid(prefix, 'BoldTick'));
  const legendFont = resolveFont(prefix, fid(prefix, 'BoldLegend'));

  const titleText = boldWrapText(document.getElementById(isOcean ? "title" : "xyTitle").value, boldTitleOn);
  const xLabelText = boldWrapText(document.getElementById(isOcean ? "xlabel" : "xyXlabel").value || "", boldAxisOn);
  const yLabelText = boldWrapText(document.getElementById(isOcean ? "ylabel" : "xyYlabel").value || "", boldAxisOn);

  const legendCfg = computeLegendLayout(prefix);
  const xExtra = computeAxisExtras(prefix, 'x');
  const yExtra = computeAxisExtras(prefix, 'y');
  const scaleBar = buildScaleBarShapesAndAnnotations(prefix, cleanTraces);

  const layout = {
    annotations: annotations.concat(scaleBar.annotations),
    shapes: shapes.concat(scaleBar.shapes),
    width: W, height: H, autosize: false,
    title: { text: titleText, font: { size: titleFontSize, family: familyOnly } },
    plot_bgcolor: "white", paper_bgcolor: "white", margin: { l: 70, r: 30, t: 60, b: 70 },
    xaxis: Object.assign({
      title: { text: xLabelText, font: { size: parseInt(document.getElementById(isOcean ? "labelSize" : "xyLabelSize").value), family: familyOnly } },
      tickfont: { size: parseInt(document.getElementById(isOcean ? "tickSize" : "xyTickSize").value), family: tickFont },
      range: isOcean ? [parseFloat(document.getElementById("xmin").value), parseFloat(document.getElementById("xmax").value)] : undefined
    }, xExtra),
    yaxis: Object.assign({
      title: { text: yLabelText, font: { size: parseInt(document.getElementById(isOcean ? "labelSize" : "xyLabelSize").value), family: familyOnly } },
      tickfont: { size: parseInt(document.getElementById(isOcean ? "tickSize" : "xyTickSize").value), family: tickFont }
    }, yExtra),
    legend: Object.assign({ x: legX, y: legY, xanchor: legX > 0.8 ? "right" : "left", yanchor: "top", font: { size: parseInt(document.getElementById(isOcean ? "legendSize" : "xyLegendSize").value), family: legendFont } }, legendCfg)
  };

  // Plotly expects axis label standoff nested under axis.title, not top-level
  if (layout.xaxis.standoff !== undefined) { layout.xaxis.title.standoff = layout.xaxis.standoff; delete layout.xaxis.standoff; }
  if (layout.yaxis.standoff !== undefined) { layout.yaxis.title.standoff = layout.yaxis.standoff; delete layout.yaxis.standoff; }

  // Y-axis range: auto (default, blank fields) or manual, for both modes
  const yRange = getManualYRange(prefix);
  if (yRange) layout.yaxis.range = yRange;

  if (!isOcean && document.getElementById("xyXmin").value !== "" && document.getElementById("xyXmax").value !== "") layout.xaxis.range = [parseFloat(document.getElementById("xyXmin").value), parseFloat(document.getElementById("xyXmax").value)];
  if (!isOcean && document.getElementById("xyInvertX").checked) layout.xaxis.autorange = 'reversed';
  if (!isOcean && document.getElementById("xyBarMode").checked) layout.barmode = 'group';

  // --- Inset (zoomed sub-region) ---
  const inset = buildInset(prefix, cleanTraces);
  let finalTraces = cleanTraces;
  if (inset.traces.length) {
    finalTraces = cleanTraces.concat(inset.traces);
    layout.xaxis2 = inset.xaxis2;
    layout.yaxis2 = inset.yaxis2;
    layout.shapes = layout.shapes.concat(inset.shapes);
    layout.annotations = layout.annotations.concat(inset.annotations);
  }

  // --- User-added text/arrows/shapes (freeform annotation tool) ---
  // Everything above this point was generated by us; mark the split so we
  // know where "the user's own additions" start when re-syncing after drags/edits.
  const genAnnCount = layout.annotations.length;
  const genShapeCount = layout.shapes.length;
  layout.annotations = layout.annotations.concat(customAnnotations[mode] || []);
  layout.shapes = layout.shapes.concat(customShapesStore[mode] || []);

  try {
    Plotly.newPlot(wrapper, finalTraces, layout, {
      displaylogo: false,
      modeBarButtonsToAdd: ['drawline', 'drawrect', 'drawcircle', 'eraseshape'],
      edits: {
        annotationPosition: true, annotationTail: true, annotationText: true,
        legendText: true, legendPosition: true, titleText: true, axisTitleText: true
      }
    }).then(gd => {
      bindNativeEditSync(gd, mode);
      bindAnnotationSync(gd, mode, genAnnCount, genShapeCount);
    });
  } catch (err) {
    console.error("Plotly ERROR:", err);
  }
}



function triggerInteractiveReplotStyleOnly(mode) {
  const isOcean = mode === 'ocean';
  const font = resolveFont(isOcean ? "" : "xy", isOcean ? "boldTick" : "xyBoldTick");
  const wrapper = document.getElementById(isOcean ? "plot-wrapper" : "xy-plot-wrapper");
  if (!wrapper.data) return;
  const traces = wrapper.data.filter(t => t.name !== undefined || t.mode === "markers+text" || t.symbol === "star");
  renderCanvasTracesAndLayout(traces, isOcean ? lastPeaksData : lastXYPeaks, font, wrapper, mode);
}