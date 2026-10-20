/* ═══════════════════════════════════════════════════════════
   RAMAN/SPECTRAL FILE LOADING (with metadata + group cards)
═══════════════════════════════════════════════════════════ */


function addFiles(e) {
  const files = Array.from(e.target.files); e.target.value = ""; if (!files.length) return;
  const existingNames = new Set(Object.values(oceanFileNames));
  const newFiles = files.filter(f => !existingNames.has(f.name));
  let loaded = 0;
  newFiles.forEach(file => {
    const myIdx = oceanGlobalIdx++; const reader = new FileReader();
    const binary = /\.spc$/i.test(file.name);
    reader.onload = evt => {
      if (binary) ingestParsedSpectrum(parseSpcBinary(evt.target.result, file.name), file.name, myIdx);
      else ingestSpectrum(evt.target.result, file.name, myIdx);
      loaded++;
      if (loaded === newFiles.length) {
        refreshOceanStatus();
        document.getElementById("spectraPanel").style.display = "block";
        document.getElementById("oceanFileList").style.display = "block";
      }
    };
    if (binary) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  });
}


function ingestSpectrum(text, filename, index) {
  ingestParsedSpectrum(parseSpectralData(text, filename), filename, index);
}

function ingestParsedSpectrum({ x, y, meta }, filename, index) {
  spectra[index] = { x, y, gIdx: index, meta };
  oceanFileNames[index] = filename;

  // insertAdjacentHTML (not innerHTML +=) so labels/groups already typed on
  // other cards are not reset when another file is added
  document.getElementById("oceanFileChips").insertAdjacentHTML("beforeend",
    `<div class="file-chip" id="chip${index}"><span>${filename}</span><span class="fmt-tag">${meta.format}</span><button class="chip-remove" onclick="removeOceanFile(${index})">×</button></div>`);

  let metaHtml = `<div class="spec-meta"><b>${meta.format}</b> · ${meta.points} pts`;
  if (meta.xrange) metaHtml += ` · X ${meta.xrange[0].toFixed(0)}–${meta.xrange[1].toFixed(0)}`;
  if (!meta.points) metaHtml += ` · <span style="color:var(--danger,#dc2626)">no numeric X/Y data found</span>`;
  if (meta.note) metaHtml += ` · <span style="color:var(--danger,#dc2626)">${meta.note}</span>`;
  if (meta.pairs && meta.pairs.length) {
    metaHtml += `<br>` + meta.pairs.slice(0, 4).map(p => `${p[0]}: ${p[1]}`).join(" · ");
  }
  metaHtml += `</div>`;

  document.getElementById("spectrumControls").insertAdjacentHTML("beforeend", `
    <div class="spec-card" id="specCard${index}">
      <b>${filename}</b>
      ${metaHtml}
      <div class="grid" style="grid-template-columns:1fr 1fr; gap:8px;">
        <div class="field"><label>Label</label><input id="label${index}" value="${filename.replace(/\.[^.]+$/i, "")}"></div>
        <div class="field"><label>Color</label><input type="color" id="color${index}" value="${GROUP_COLORS[index % GROUP_COLORS.length]}"></div>
      </div>
      <div class="field" style="margin-top:8px"><label>Group / Species</label><input id="group${index}" value="Group 1" placeholder="e.g. Species A"></div>
    </div>`);
}


function removeOceanFile(index) {
  delete spectra[index]; delete oceanFileNames[index];
  document.getElementById(`chip${index}`)?.remove(); document.getElementById(`specCard${index}`)?.remove();
  refreshOceanStatus();
  if (Object.keys(oceanFileNames).length === 0) {
    document.getElementById("spectraPanel").style.display = "none";
    document.getElementById("oceanFileList").style.display = "none";
    document.getElementById("peakTableSection").style.display = "none";
    document.getElementById("oceanComparisonSection").style.display = "none";
    Plotly.purge(document.getElementById("plot-wrapper"));
  }
}

function clearAllOceanFiles() {
  spectra = []; oceanFileNames = {}; oceanGlobalIdx = 0;
  if (analyzedComparisonMode === 'ocean') { analyzedCommonPeaks = []; analyzedDistinctPeaks = []; analyzedComparisonMode = null; }
  lastPeaksData = [];
  document.getElementById("spectrumControls").innerHTML = ""; document.getElementById("oceanFileChips").innerHTML = "";
  document.getElementById("spectraPanel").style.display = "none"; document.getElementById("oceanFileList").style.display = "none";
  document.getElementById("peakTableSection").style.display = "none"; document.getElementById("oceanComparisonSection").style.display = "none";
  setStatus("No files loaded"); Plotly.purge(document.getElementById("plot-wrapper"));
}


function refreshOceanStatus() { const n = Object.keys(oceanFileNames).length; setStatus(`${n} spectrum${n === 1 ? "" : "s"} loaded`, n > 0 ? "ok" : ""); }


function readXYFiles(e) {
  const files = Array.from(e.target.files); e.target.value = ""; if (!files.length) return;
  let loaded = 0;
  files.forEach(file => {
    const myIdx = xyGlobalIdx++; const reader = new FileReader();
    reader.onload = evt => {
      const data = parseXYFile(evt.target.result);
      xyFiles[myIdx] = { ...data, name: file.name.replace(/\.[^.]+$/, ""), color: GROUP_COLORS[myIdx % GROUP_COLORS.length], gIdx: myIdx, filename: file.name };
      xyFileNames[myIdx] = file.name; loaded++; if (loaded === files.length) renderXYFileCards();
    };
    reader.readAsText(file);
  });
}


function renderXYFileCards() {
  const chipsEl = document.getElementById("xyFileChips"); const cardsEl = document.getElementById("xyFileCards");
  // keep any label/colour the user has already edited before rebuilding the cards
  Object.keys(xyFileNames).forEach(gIdx => {
    const f = xyFiles[gIdx]; if (!f) return;
    const lab = document.getElementById("xyFileLabel" + gIdx), col = document.getElementById("xyFileColor" + gIdx);
    if (lab) f.name = lab.value; if (col) f.color = col.value;
  });
  chipsEl.innerHTML = ""; cardsEl.innerHTML = "";
  Object.keys(xyFileNames).forEach(gIdx => {
    const f = xyFiles[gIdx]; if (!f) return;
    chipsEl.innerHTML += `<div class="file-chip"><span>${f.filename}</span><button class="chip-remove" onclick="removeXYFile(${gIdx})">×</button></div>`;
    cardsEl.innerHTML += `
      <div class="spec-card" id="xyFileCard${gIdx}">
        <b>${f.filename}</b>
        <div class="spec-meta">${f.x.length} pts${f.ey ? " · Y-error column ✓" : ""}${f.ex ? " · X-error column ✓" : ""}</div>
        <div class="field"><label>Label</label><input id="xyFileLabel${gIdx}" value="${f.name}"></div>
        <div class="field"><label>Color</label><input type="color" id="xyFileColor${gIdx}" value="${f.color}"></div>
      </div>`;
  });
  document.getElementById("xyFileStatus").textContent = `${Object.keys(xyFileNames).length} documents staged`;
}


function removeXYFile(gIdx) { delete xyFiles[gIdx]; delete xyFileNames[gIdx]; renderXYFileCards(); }
function clearAllXYFiles() { 
  // 1. Clear the internal data memory
  xyFiles = []; 
  xyFileNames = {}; 
  xyGlobalIdx = 0; 
  renderXYFileCards(); 

  // 2. Purge the Plotly canvas and hide it
  const wrapper = document.getElementById("xy-plot-wrapper");
  if (wrapper) {
      Plotly.purge(wrapper);
      wrapper.style.display = "none";
  }

  // 3. Bring back the original empty state graphic
  const emptyState = document.getElementById("xyEmptyState");
  if (emptyState) emptyState.style.display = "flex";

  // 4. Hide the data tables and fit results
  document.getElementById("xyComparisonSection").style.display = "none";
  document.getElementById("fitResultBox").innerHTML = "";

  // 5. Reset plot tracking variables
  lastXYSeries = [];
  lastFitResults = [];
}
// Blank tokens (e.g. a trailing comma or space) are dropped before conversion;
// Number("") is 0, which would otherwise append a spurious zero.
function parseCSVVals(str) { return (str || "").split(/[\s,;]+/).filter(t => t !== "").map(Number).filter(v => Number.isFinite(v)); }

// Pair X/Y (and optional error) lists from the paste boxes. Mismatched
// lengths are truncated to the shortest list instead of silently mis-pairing.
function pairXYLists(x, y, ey, ex, name) {
  const n = Math.min(x.length, y.length);
  if (x.length !== y.length) rxNotify(`"${name}": ${x.length} X values but ${y.length} Y values — using the first ${n} pairs.`);
  const trimErr = e => (e && e.length) ? (e.length >= n ? e.slice(0, n) : (rxNotify(`"${name}": error list shorter than the data — error bars ignored.`), null)) : null;
  return { x: x.slice(0, n), y: y.slice(0, n), ey: trimErr(ey), ex: trimErr(ex) };
}

function rxNotify(msg) { if (window.rxToast) window.rxToast(msg); else console.warn(msg); }



function gatherXYDatasets() {
  const tab = document.querySelector('.xy-tab.active').id;
  if (tab === 'tabFile') return Object.keys(xyFileNames).map(gi => ({ x: xyFiles[gi].x, y: xyFiles[gi].y, ey: xyFiles[gi].ey, ex: xyFiles[gi].ex, name: document.getElementById("xyFileLabel" + gi).value, color: document.getElementById("xyFileColor" + gi).value }));
  if (tab === 'tabCols') {
    const parsed = parseXYFile(document.getElementById("xyColText").value);
    return [{ x: parsed.x, y: parsed.y, ey: parsed.ey, ex: parsed.ex, name: document.getElementById("xyColName").value, color: "#2563eb" }];
  }
  const list = [];
  const x1 = parseCSVVals(document.getElementById("xyXvals").value);
  const y1 = parseCSVVals(document.getElementById("xyYvals").value);
  const ey1 = parseCSVVals(document.getElementById("xyYerr").value);
  const ex1 = parseCSVVals(document.getElementById("xyXerr").value);
  if (x1.length && y1.length) list.push(Object.assign(pairXYLists(x1, y1, ey1, ex1, document.getElementById("xyName1").value), { name: document.getElementById("xyName1").value, color: document.getElementById("xyColor1").value }));
  for (let i = 1; i <= extraDatasetCount; i++) {
    if (document.getElementById("xyXvals" + i)) {
      const ey = parseCSVVals(document.getElementById("xyYerr" + i)?.value);
      const ex = parseCSVVals(document.getElementById("xyXerr" + i)?.value);
      const nm = document.getElementById("xyName" + i).value;
      list.push(Object.assign(pairXYLists(parseCSVVals(document.getElementById("xyXvals" + i).value), parseCSVVals(document.getElementById("xyYvals" + i).value), ey, ex, nm), { name: nm, color: document.getElementById("xyColor" + i).value }));
    }
  }
  return list;
}


document.getElementById("fileInput").addEventListener("change", addFiles);

document.getElementById("xyFileInput").addEventListener("change", readXYFiles);