function downloadPlottedData() {
  if (!lastPlottedSeries.length) { alert("Plot something first, then download its data."); return; }
  // Build a unified CSV: X of each series + Y (+ errors) columns. Series may share X grids.
  let header = [], cols = [];
  lastPlottedSeries.forEach(s => {
    header.push(`${s.name}__X`, `${s.name}__Y`);
    cols.push(s.x, s.y);
    if (s.eY) { header.push(`${s.name}__Yerr`); cols.push(s.eY); }
    if (s.eX) { header.push(`${s.name}__Xerr`); cols.push(s.eX); }
  });
  const maxLen = Math.max(...cols.map(c => c.length));
  let csv = header.join(",") + "\n";
  for (let i = 0; i < maxLen; i++) {
    csv += cols.map(c => (i < c.length ? c[i] : "")).join(",") + "\n";
  }
  downloadBlob(csv, "RNSpectraX_PlottedData.csv", "text/csv");
}


/* Downloads one CSV per loaded spectrum, with a column for every processing
   stage: Raw, Despiked, Baseline, Baseline-Corrected, Smoothed, Normalized (final).
   Lets a user hand a reviewer exactly what was done to the data at each step. */
function downloadProcessingStages() {
  const activeSpectra = spectra.filter(s => s != null);
  if (!activeSpectra.length) { alert("Load and process files first."); return; }
  activeSpectra.forEach((spec, idx) => {
    const gIdx = spec.gIdx ?? idx;
    const label = (document.getElementById("label" + gIdx)?.value || spec.name || `Spectrum_${idx + 1}`).replace(/[^\w\-]+/g, "_");
    const p = processSpec(spec);
    let csv = "X,Raw,Despiked,Baseline,BaselineCorrected,Smoothed,Normalized_Final\n";
    for (let i = 0; i < p.xx.length; i++) {
      csv += [
        p.xx[i],
        p.raw[i] ?? "",
        p.despiked ? p.despiked[i] ?? "" : "",
        p.baseline ? p.baseline[i] ?? "" : "",
        p.corrected ? p.corrected[i] ?? "" : "",
        p.smoothed ? p.smoothed[i] ?? "" : "",
        p.yy[i] ?? ""
      ].join(",") + "\n";
    }
    downloadBlob(csv, `RNSpectraX_Stages_${label}.csv`, "text/csv");
  });
}

function downloadPlot() {
  const dpi = parseInt(document.getElementById("exportDPI")?.value) || 300;
  exportWrapperAsImage("plot-wrapper", "RamanPlot", document.getElementById("downloadFormat").value,
    parseInt(document.getElementById("figWidth").value), parseInt(document.getElementById("figHeight").value), dpi);
}



function downloadPeaksTxt() {
  syncOceanTableToMemory(); let txt = `Raman Band Report\nPlot: ${document.getElementById("title").value}\n\n#\tWavenumber\tIntensity\tMode\tAssignment\n` + "═".repeat(80) + "\n";
  lastPeaksData.forEach((r, i) => { txt += `${i + 1}\t${r.x.toFixed(1)}\t\t${r.y.toFixed(4)}\t\t${r.mode}\t\t${r.assign}\n`; });
  downloadBlob(txt, "Raman_Peaks.txt", "text/plain");
}


function downloadPeaksPdf() {
  syncOceanTableToMemory(); const { jsPDF } = window.jspdf; const doc = new jsPDF();
  let y = 35; doc.setFont("helvetica", "bold"); doc.text("Raman Assignments Matrix", 14, 20); doc.setFontSize(9);
  lastPeaksData.forEach((r, i) => { doc.text(`${i + 1}. ${r.x.toFixed(1)} cm-1 | Intensity: ${r.y} | Mode: ${r.mode} | Group: ${r.assign}`, 14, y); y += 8; });
  doc.save("RamanAssignments.pdf");
}


function downloadComparisonReport(format, mode) {
  const isOcean = (mode === 'ocean');
  const title = document.getElementById(isOcean ? 'title' : 'xyTitle').value;
  let content = `=====================================================\n`;
  content += `CROSS-FILE COMPARATIVE SPECTRAL PEAK ANALYSIS\nProject Target: ${title}\n`;
  content += `Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}\n`;
  content += `=====================================================\n\n`;
  content += `1. UNIVERSAL COMMON PEAKS (Present across all uploaded data arrays)\n-----------------------------------------------------------------\n`;
  if (analyzedCommonPeaks.length) analyzedCommonPeaks.forEach((p, i) => { content += `[Peak #${i + 1}] Coordinate: ${p.x.toFixed(1)}\tAvg Intensity: ${p.y.toFixed(4)}\n`; });
  else content += `No absolute universal common peaks isolated inside tolerance window bounds.\n`;
  content += `\n2. DISTINCT / UNIQUE SPECTRAL PEAKS (Trace-isolated specific anomalies)\n-----------------------------------------------------------------\n`;
  if (analyzedDistinctPeaks.length) analyzedDistinctPeaks.forEach((p, i) => { content += `[Unique #${i + 1}] Coordinate: ${p.x.toFixed(1)}\tIntensity: ${p.y.toFixed(4)}\tOrigins: ${p.sourceTraces}\n`; });
  else content += `No standalone un-shared distinct anomalies identified.\n`;
  if (format === 'txt') { downloadBlob(content, "Comparative_Peak_Analysis_Report.txt", "text/plain"); }
  else {
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.setFont("monospace", "normal"); doc.setFontSize(10);
    let splitLines = doc.splitTextToSize(content, 180); let yLoc = 20;
    splitLines.forEach(line => { if (yLoc > 275) { doc.addPage(); yLoc = 20; } doc.text(line, 14, yLoc); yLoc += 6; });
    doc.save("Comparative_Peak_Analysis_Report.pdf");
  }
}



function downloadXYPlot() {
  const dpi = parseInt(document.getElementById("xyExportDPI")?.value) || 300;
  exportWrapperAsImage("xy-plot-wrapper", "Plot", document.getElementById("xyDownloadFormat").value,
    parseInt(document.getElementById("xyFigWidth").value), parseInt(document.getElementById("xyFigHeight").value), dpi);
}


function downloadXYData() {
  if (!lastXYSeries.length) { alert("Plot something first, then download its data."); return; }
  let header = [], cols = [];
  lastXYSeries.forEach(s => {
    header.push(`${s.name}__X`, `${s.name}__Y`); cols.push(s.x, s.y);
    if (s.eY) { header.push(`${s.name}__Yerr`); cols.push(s.eY); }
    if (s.eX) { header.push(`${s.name}__Xerr`); cols.push(s.eX); }
  });
  const maxLen = Math.max(...cols.map(c => c.length));
  let csv = header.join(",") + "\n";
  for (let i = 0; i < maxLen; i++) csv += cols.map(c => (i < c.length ? c[i] : "")).join(",") + "\n";
  downloadBlob(csv, "RNSpectraX_XY_Data.csv", "text/csv");
}


function downloadFitParams() {
  const fits = lastFitResults.filter(f => !f.failed);
  if (!fits.length) { alert("Run a fit first (choose a Fit Model and press Plot)."); return; }
  let txt = `RNSpectraX — Curve Fit Parameters\nGenerated: ${new Date().toLocaleString()}\n`;
  txt += "Uncertainties are 1σ standard errors from the parameter covariance matrix.\n";
  txt += "=".repeat(60) + "\n\n";
  fits.forEach(fit => {
    txt += `Dataset: ${fit.datasetName}\nModel: ${fit.label}\nEquation: ${fit.eqText}\n`;
    txt += `R^2: ${fit.r2.toFixed(8)}\nAdjusted R^2: ${fit.adjR2.toFixed(8)}\nResidual SS: ${fit.ssRes.toExponential(6)}\n`;
    if (fit.redChi2 !== null && fit.redChi2 !== undefined) txt += `Reduced chi^2: ${fit.redChi2.toExponential(6)}\n`;
    txt += `n points: ${fit.n}   parameters: ${fit.k}${fit.weighted ? "   (weighted by 1/sigma^2)" : ""}${fit.converged ? "" : "   WARNING: not fully converged"}\n`;
    txt += `Parameters:\n`;
    fit.names.forEach((nm, j) => { txt += `   ${nm} = ${fit.values[j].toExponential(8)}  ±  ${Number.isFinite(fit.errors[j]) ? fit.errors[j].toExponential(4) : "n/a"}\n`; });
    fit.derived.forEach(d => { txt += `   ${d.name} = ${d.value.toExponential(8)}  ±  ${Number.isFinite(d.se) ? d.se.toExponential(4) : "n/a"}\n`; });
    txt += "\n" + "-".repeat(60) + "\n\n";
  });
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  let csv = "dataset,model,parameter,value,std_error\n";
  fits.forEach(fit => {
    const row = (k, v, e) => { csv += `${q(fit.datasetName)},${q(fit.label)},${q(k)},${v},${Number.isFinite(e) ? e : ""}\n`; };
    fit.names.forEach((nm, j) => row(nm, fit.values[j], fit.errors[j]));
    fit.derived.forEach(d => row(d.name, d.value, d.se));
    row("R2", fit.r2); row("adjR2", fit.adjR2); row("ssRes", fit.ssRes);
    if (fit.redChi2 !== null && fit.redChi2 !== undefined) row("reduced_chi2", fit.redChi2);
    row("n", fit.n);
  });
  downloadBlob(txt, "RNSpectraX_FitParameters.txt", "text/plain");
  setTimeout(() => downloadBlob(csv, "RNSpectraX_FitParameters.csv", "text/csv"), 150);
}
