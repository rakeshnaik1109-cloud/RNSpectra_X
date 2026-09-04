/* ═══════════════════════════════════════════════════════════
   COMPREHENSIVE PEAK SEPARATION ENGINE (COMMON VS DISTINCT)
═══════════════════════════════════════════════════════════ */
function runComprehensiveComparisonEngine(mode) {
  analyzedCommonPeaks = []; analyzedDistinctPeaks = [];
  let peakCollections = []; let totalTraces = 0;

  if (mode === 'ocean') {
    const activeSpectra = spectra.filter(s => s != null);
    totalTraces = activeSpectra.length;
    if (totalTraces < 2) { alert("Please load at least 2 files to enable multi-file sorting comparisons."); return; }
    activeSpectra.forEach((spec, sIdx) => {
      const { xx, yy } = processSpec(spec);
      runPeakDetectionAlgorithm(xx, yy).forEach(i => {
        peakCollections.push({ x: xx[i], y: yy[i], traceLabel: document.getElementById("label" + spec.gIdx)?.value || `File ${sIdx + 1}` });
      });
    });
    const tolerance = parseFloat(document.getElementById("oceanTolerance").value) || 5;
    sortPeaksClusteringData(peakCollections, tolerance, totalTraces);
    renderComparisonTableUI('ocean');
  } else {
    const datasets = gatherXYDatasets();
    totalTraces = datasets.length;
    if (totalTraces < 2) { alert("Please load at least 2 data channels to enable comparative operations."); return; }
    datasets.forEach(ds => {
      let yy = applySmoothing([...ds.y], document.getElementById("xySmoothType").value, parseInt(document.getElementById("xySmP1").value) || 5, 2, 2);
      yy = normalizeData(yy, document.getElementById("xyNorm").value);
      runPeakDetectionAlgorithm(ds.x, yy).forEach(i => { peakCollections.push({ x: ds.x[i], y: yy[i], traceLabel: ds.name }); });
    });
    const tolerance = parseFloat(document.getElementById("xyTolerance").value) || 5;
    sortPeaksClusteringData(peakCollections, tolerance, totalTraces);
    renderComparisonTableUI('xy');
  }
}


function sortPeaksClusteringData(flatPeaks, tolerance, totalCount) {
  let matchedIndices = new Set();
  for (let i = 0; i < flatPeaks.length; i++) {
    if (matchedIndices.has(i)) continue;
    let cluster = [flatPeaks[i]]; matchedIndices.add(i);
    for (let j = i + 1; j < flatPeaks.length; j++) {
      if (matchedIndices.has(j)) continue;
      let currentMean = cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length;
      if (Math.abs(flatPeaks[j].x - currentMean) <= tolerance) { cluster.push(flatPeaks[j]); matchedIndices.add(j); }
    }
    let avgX = cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length;
    let avgY = cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length;
    let uniqueSources = new Set(cluster.map(p => p.traceLabel));
    let node = { x: avgX, y: avgY, matchCount: uniqueSources.size, sourceTraces: Array.from(uniqueSources).join(", ") };
    if (uniqueSources.size === totalCount) analyzedCommonPeaks.push(node); else analyzedDistinctPeaks.push(node);
  }
}


function switchComparisonSubTab(targetTab, mode) {
  activeComparisonSubTab = targetTab;
  document.getElementById(`${mode}CommonTabBtn`).classList.toggle('active', targetTab === 'common');
  document.getElementById(`${mode}DistinctTabBtn`).classList.toggle('active', targetTab === 'distinct');
  renderComparisonTableUI(mode);
}


function renderComparisonTableUI(mode) {
  const section = document.getElementById(mode === 'ocean' ? 'oceanComparisonSection' : 'xyComparisonSection');
  const tbody = document.getElementById(mode === 'ocean' ? 'oceanComparisonTableBody' : 'xyComparisonTableBody');
  const headerRow = document.getElementById(mode === 'ocean' ? 'oceanCompTableHeader' : 'xyCompTableHeader');
  
  tbody.innerHTML = ""; 
  section.style.display = "block";
  
  let targetData = (activeComparisonSubTab === 'common') ? analyzedCommonPeaks : analyzedDistinctPeaks;
  
  // Clean, lab-standard terminology
  if (activeComparisonSubTab === 'common') {
      headerRow.innerHTML = `<th>Target Peak (cm⁻¹)</th><th>Avg Intensity</th><th>Detection Status</th>`;
  } else {
      headerRow.innerHTML = `<th>Target Peak (cm⁻¹)</th><th>Local Intensity</th><th>Found In (Files)</th>`;
  }

  // Clean empty state
  if (!targetData.length) { 
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--muted);">No matching peaks found in this category.</td></tr>`; 
      return; 
  }
  
  // Clean table data generation
  targetData.sort((a, b) => a.x - b.x).forEach(pk => {
    tbody.innerHTML += `<tr>
      <td><b>${pk.x.toFixed(1)}</b></td>
      <td>${pk.y.toFixed(4)}</td>
      <td><span style="font-weight:600; color:${activeComparisonSubTab === 'common' ? 'var(--success)' : 'var(--danger)'};">
        ${activeComparisonSubTab === 'common' ? 'Found in ALL loaded files' : pk.sourceTraces}
      </span></td>
    </tr>`;
  });
  
  if (mode === 'ocean') replotWithModifiedPeaks(); else replotWithModifiedXyPeaks();
}