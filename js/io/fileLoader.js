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


const SPREADSHEET_RE = /\.(xlsx|xlsm|xls|ods)$/i;

// SheetJS is only needed for spreadsheets, so it is fetched on first use.
let sheetJsPromise = null;
function loadSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!sheetJsPromise) sheetJsPromise = new Promise((resolve, reject) => {
    const sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    sc.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error("Spreadsheet reader failed to load"));
    sc.onerror = () => { sheetJsPromise = null; reject(new Error("Could not load the spreadsheet reader — check your internet connection, or save the sheet as CSV")); };
    document.head.appendChild(sc);
  });
  return sheetJsPromise;
}

function readFileAs(file, kind) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result); r.onerror = () => reject(r.error);
    kind === "buffer" ? r.readAsArrayBuffer(file) : r.readAsText(file);
  });
}

// Every file becomes one or more datasets: a two-column or X/Y/error file
// gives one; a wide table (X then many Y columns, e.g. an Avantes export or
// an Excel sheet) gives one per column, all plotted together.
async function tablesFromFile(file) {
  const base = file.name.replace(/\.[^.]+$/, "");
  if (SPREADSHEET_RE.test(file.name)) {
    const XLSX = await loadSheetJS();
    const wb = XLSX.read(await readFileAs(file, "buffer"), { type: "array" });
    const tables = wb.SheetNames.map(sn => ({ sheet: sn, t: parseXYTable(XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: "" }), base) }))
      .filter(o => o.t.series.length);
    if (tables.length > 1) tables.forEach(o => o.t.series.forEach(s => { s.name = `${o.sheet} › ${s.name}`; }));
    return tables.map(o => o.t);
  }
  return [parseXYTable(textToRows(await readFileAs(file, "text")), base)];
}

async function readXYFiles(e) {
  const files = Array.from(e.target.files); e.target.value = ""; if (!files.length) return;
  let added = 0, xLabel = "", yLabel = "";
  for (const file of files) {
    try {
      const tables = await tablesFromFile(file);
      tables.forEach(t => {
        if (t.xLabel && !xLabel) xLabel = t.xLabel;
        if (t.yLabel && !yLabel) yLabel = t.yLabel;
        t.series.forEach(sr => {
          const myIdx = xyGlobalIdx++;
          xyFiles[myIdx] = { x: sr.x, y: sr.y, ey: sr.ey, ex: sr.ex, info: sr.info, name: sr.name, autoName: !!sr.autoName,
            quantity: sr.quantity || "", quantityLabel: sr.quantityLabel || "", include: sr.preferred === false ? false : undefined, color: GROUP_COLORS[myIdx % GROUP_COLORS.length], gIdx: myIdx, filename: file.name };
          xyFileNames[myIdx] = file.name; added++;
        });
      });
      if (!tables.some(t => t.series.length)) rxNotify(`"${file.name}": no numeric X/Y columns found.`);
    } catch (err) {
      rxNotify(`"${file.name}": ${err.message || err}`);
    }
  }
  // Take the X-axis title from the table header while the label is still the default
  const xl = document.getElementById("xyXlabel");
  if (xLabel && xl && (xl.value.trim() === "" || xl.value.trim() === "X")) xl.value = xLabel;
  const yl = document.getElementById("xyYlabel");
  if (yLabel && yl && (yl.value.trim() === "" || yl.value.trim() === "Y")) yl.value = yLabel;
  if (added) rxNotify(`Loaded ${added} dataset${added === 1 ? "" : "s"}`);
  renderXYFileCards();
}


function renderXYFileCards() {
  const chipsEl = document.getElementById("xyFileChips"); const cardsEl = document.getElementById("xyFileCards");
  // keep any label/colour the user has already edited before rebuilding the cards
  Object.keys(xyFileNames).forEach(gIdx => {
    const f = xyFiles[gIdx]; if (!f) return;
    const lab = document.getElementById("xyFileLabel" + gIdx), col = document.getElementById("xyFileColor" + gIdx);
    if (lab) f.name = lab.value; if (col) f.color = col.value;
    const use = document.getElementById("xyFileUse" + gIdx), grp = document.getElementById("xyFileGroup" + gIdx);
    if (use) f.include = use.checked; if (grp) f.group = grp.value;
  });
  chipsEl.innerHTML = ""; cardsEl.innerHTML = "";
  Object.keys(xyFileNames).forEach(gIdx => {
    const f = xyFiles[gIdx]; if (!f) return;
    const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    chipsEl.innerHTML += `<div class="file-chip"><span>${esc(f.name)}</span><button class="chip-remove" onclick="removeXYFile(${gIdx})">×</button></div>`;
    cardsEl.innerHTML += `
      <div class="spec-card" id="xyFileCard${gIdx}">
        <b>${esc(f.filename)}</b>
        <div class="spec-meta">${f.x.length} pts${f.ey ? " · Y-error column ✓" : ""}${f.ex ? " · X-error column ✓" : ""}${f.info ? " · " + esc(f.info) : ""}</div>
        <div class="grid" style="grid-template-columns:auto 1fr;gap:8px;align-items:end;">
          <label class="toggle-item" style="margin-bottom:6px;"><input type="checkbox" id="xyFileUse${gIdx}" ${f.include === false ? "" : "checked"}>Plot</label>
          <div class="field"><label>Group</label><input id="xyFileGroup${gIdx}" value="${esc(f.group || "")}" placeholder="none — plotted on its own"></div>
        </div>
        <div class="field"><label>Label</label><input id="xyFileLabel${gIdx}" value="${esc(f.name)}"></div>
        <div class="field"><label>Color</label><input type="color" id="xyFileColor${gIdx}" value="${f.color}"></div>
      </div>`;
  });
  const nSets = Object.keys(xyFileNames).length, nFiles = new Set(Object.values(xyFileNames)).size;
  document.getElementById("xyGroupPanel").style.display = nSets > 1 ? "block" : "none";
  // "Plot quantity" selector for files that hold several quantities per measurement
  const qs = [...new Set(Object.keys(xyFileNames).map(g => xyFiles[g]?.quantity).filter(Boolean))];
  const qWrap = document.getElementById("xyQuantityWrap"), qSel = document.getElementById("xyQuantity");
  if (qWrap && qSel) {
    qWrap.style.display = qs.length > 1 ? "flex" : "none";
    const ticked = Object.keys(xyFileNames).filter(g => xyFiles[g]?.quantity && xyFiles[g].include !== false).map(g => xyFiles[g].quantity);
    const current = new Set(ticked).size === 1 ? ticked[0] : "__mixed";
    const esc = v => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    qSel.innerHTML = qs.map(q => `<option value="${esc(q)}">${esc(q)}</option>`).join("") + `<option value="__all">All quantities</option>` + (current === "__mixed" ? `<option value="__mixed">(custom selection)</option>` : "");
    qSel.value = current;
  }
  document.getElementById("xyFileStatus").textContent = nSets ? `${nSets} dataset${nSets === 1 ? "" : "s"} from ${nFiles} file${nFiles === 1 ? "" : "s"}` : "No files";
}


// Tick only the datasets of one quantity (e.g. Reflectance) in files that hold
// several quantities per measurement; datasets without a quantity are untouched.
function setXYQuantity(q) {
  Object.keys(xyFileNames).forEach(g => {
    const f = xyFiles[g], el = document.getElementById("xyFileUse" + g);
    if (!f || !f.quantity || !el) return;
    el.checked = q === "__all" || f.quantity === q;
    f.include = el.checked;
  });
  const yl = document.getElementById("xyYlabel"), sample = Object.keys(xyFileNames).map(g => xyFiles[g]).find(f => f && f.quantity === q);
  if (yl && sample && sample.quantityLabel) yl.value = sample.quantityLabel;
}

// Tick or untick every uploaded dataset
function setAllXYIncluded(on) {
  Object.keys(xyFileNames).forEach(gIdx => { const el = document.getElementById("xyFileUse" + gIdx); if (el) el.checked = on; });
}

// Fill the Group boxes of the ticked datasets, in order:
//   "every" — consecutive blocks of N columns → G1, G2, …
//   "name"  — the label without a trailing _2 / -2 / " 2" (PBS, PBS_2 → PBS;
//             0.3125, 0.3125_2 → 0.3125)
//   "clear" — empty every Group box
function autoGroupXY(how) {
  const ids = Object.keys(xyFileNames).filter(g => document.getElementById("xyFileUse" + g)?.checked);
  const n = Math.max(1, parseInt(document.getElementById("xyGroupEveryN").value) || 1);
  let skipped = 0;
  // when every ticked dataset is the same quantity, groups are named by the
  // measurement alone ("mmt"), otherwise "mmt · Reflectance"
  const singleQuantity = new Set(ids.map(g => xyFiles[g]?.quantity || "")).size === 1;
  ids.forEach((g, k) => {
    const box = document.getElementById("xyFileGroup" + g); if (!box) return;
    if (how === "clear") box.value = "";
    else if (how === "every") box.value = "G" + (Math.floor(k / n) + 1);
    else if (how === "name") {
      const label = (document.getElementById("xyFileLabel" + g).value || "").trim();
      // columns that had no name in the file keep their own curve
      if (/ · column \d+$/.test(label)) { box.value = ""; skipped++; return; }
      // drop a replicate suffix only when a separator precedes it ("PBS_2",
      // "10-3", "Sample 2"); a bare number such as "0.3125" or "10" is the
      // name itself and is kept whole
      const qm = label.match(/^(.*?) · (.+)$/);            // "mmt_1 · Reflectance"
      if (qm) {
        const base = qm[1].replace(/[\s_\-]+\d+$/, "") || qm[1];
        box.value = singleQuantity ? base : `${base} · ${qm[2]}`;
      } else box.value = label.replace(/[\s_\-]+\d+$/, "") || label;
    }
  });
  if (skipped) rxNotify(`${skipped} column${skipped === 1 ? " has" : "s have"} no name in the file and ${skipped === 1 ? "was" : "were"} left ungrouped — type a Group for ${skipped === 1 ? "it" : "them"} if needed.`);
  if (how !== "clear") document.getElementById("xyGroupMode").value = "groups";
  const groups = new Set(ids.map(g => document.getElementById("xyFileGroup" + g)?.value).filter(Boolean));
  if (how !== "clear") rxNotify(`${groups.size} group${groups.size === 1 ? "" : "s"} set — press Plot`);
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
  if (tab === 'tabFile') return Object.keys(xyFileNames)
    .filter(gi => document.getElementById("xyFileUse" + gi)?.checked !== false)
    .map(gi => ({ x: xyFiles[gi].x, y: xyFiles[gi].y, ey: xyFiles[gi].ey, ex: xyFiles[gi].ex, name: document.getElementById("xyFileLabel" + gi).value, color: document.getElementById("xyFileColor" + gi).value, group: (document.getElementById("xyFileGroup" + gi)?.value || "").trim() }));
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