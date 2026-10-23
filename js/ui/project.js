/* ═══════════════════════════════════════════════════════════
   PROJECT FILES (.rnsx) AND METHODS TEXT
   A project file is plain JSON holding every loaded spectrum / dataset,
   the labels, colours and groups typed on the file cards, every control
   setting, legend renames and annotations — enough to rebuild a figure
   exactly, months later or on a collaborator's computer. Nothing is sent
   anywhere: saving downloads the file, opening reads it in this tab.
═══════════════════════════════════════════════════════════ */

const RNSX_VERSION = 1;

function projectCollectSettings() {
  const out = {};
  document.querySelectorAll("input[id], select[id], textarea[id]").forEach(el => {
    if (!el.id || el.type === "file" || el.type === "button" || el.type === "submit") return;
    if (/^(label|color|group|pk-|xy-pk-|cmp-|xyFile)/.test(el.id)) return;   // per-file, stored with the file
    if (el.hasAttribute("data-mirror") || el.closest("#spectrumControls") || el.closest("#xyFileCards")) return;
    out[el.id] = (el.type === "checkbox" || el.type === "radio") ? el.checked : el.value;
  });
  return out;
}

function projectApplySettings(values) {
  let n = 0;
  Object.keys(values || {}).forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const v = values[id];
    if (el.type === "checkbox" || el.type === "radio") { if (el.checked === v) return; el.checked = !!v; }
    else { if (el.value === v) return; el.value = v; }
    n++;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  document.querySelectorAll("[data-mirror]").forEach(m => { const src = document.getElementById(m.getAttribute("data-mirror")); if (!src) return; if (m.type === "checkbox") m.checked = src.checked; else m.value = src.value; });
  return n;
}

function saveProject() {
  rxTrack("project-save");
  // keep what was typed on the XY file cards
  if (typeof renderXYFileCards === "function" && Object.keys(xyFileNames).length) renderXYFileCards();
  const raman = spectra.filter(s => s != null).map(s => ({
    name: oceanFileNames[s.gIdx], x: Array.from(s.x), y: Array.from(s.y), meta: s.meta,
    label: document.getElementById("label" + s.gIdx)?.value, color: document.getElementById("color" + s.gIdx)?.value, group: document.getElementById("group" + s.gIdx)?.value
  }));
  const xy = Object.keys(xyFileNames).map(g => xyFiles[g]).filter(Boolean).map(f => ({
    x: Array.from(f.x), y: Array.from(f.y), ey: f.ey ? Array.from(f.ey) : null, ex: f.ex ? Array.from(f.ex) : null,
    info: f.info, name: f.name, autoName: f.autoName, quantity: f.quantity, quantityLabel: f.quantityLabel,
    include: f.include, color: f.color, group: f.group, y2: f.y2, filename: f.filename
  }));
  const project = {
    app: "RNSpectraX", format: "rnsx", version: RNSX_VERSION, saved: new Date().toISOString(),
    mode: currentMode, xyTab: (document.querySelector(".xy-tab.active")?.id || "tabCSV").replace(/^tab/, "").toLowerCase(),
    settings: projectCollectSettings(), raman, xy,
    legendNames: legendNameOverrides, annotations: customAnnotations, shapes: customShapesStore
  };
  downloadBlob(JSON.stringify(project), `RNSpectraX_project_${new Date().toISOString().slice(0, 10)}.rnsx`, "application/json");
  rxNotify(`Project saved: ${raman.length} spectra, ${xy.length} XY datasets, all settings and annotations.`);
}

function openProjectDialog() { document.getElementById("projectFileInput").click(); }

function openProjectFile(e) {
  const file = e.target.files && e.target.files[0]; e.target.value = "";
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    let p;
    try { p = JSON.parse(r.result); } catch (err) { alert("This is not a RNSpectraX project file (it is not valid JSON)."); return; }
    if (!p || p.format !== "rnsx") { alert("This is not a RNSpectraX project file."); return; }
    loadProject(p);
  };
  r.readAsText(file);
}

function loadProject(p) {
  rxTrack("project-open");
  if ((spectra.some(s => s) || Object.keys(xyFileNames).length) && !confirm("Opening a project replaces the spectra and settings now loaded. Continue?")) return;
  clearAllOceanFiles();
  clearAllXYFiles();
  // extra paste-in datasets: recreate the ones the project used
  document.getElementById("extraXYDatasets").innerHTML = ""; extraDatasetCount = 0;
  const extra = Object.keys(p.settings || {}).map(k => (k.match(/^xyXvals(\d+)$/) || [])[1]).filter(Boolean).map(Number);
  const maxExtra = extra.length ? Math.max(...extra) : 0;
  for (let i = 1; i <= maxExtra; i++) addXYDataset();
  for (let i = 1; i <= maxExtra; i++) if (!extra.includes(i)) document.getElementById("extraDS" + i)?.remove();

  // Raman spectra and their cards
  (p.raman || []).forEach(s => {
    const idx = oceanGlobalIdx++;
    ingestParsedSpectrum({ x: s.x, y: s.y, meta: s.meta || { format: "Project", points: s.x.length } }, s.name || `Spectrum ${idx + 1}`, idx);
    if (s.label != null) document.getElementById("label" + idx).value = s.label;
    if (s.color) document.getElementById("color" + idx).value = s.color;
    if (s.group != null) document.getElementById("group" + idx).value = s.group;
  });
  if ((p.raman || []).length) {
    refreshOceanStatus();
    document.getElementById("spectraPanel").style.display = "block";
    document.getElementById("oceanFileList").style.display = "block";
  }
  // XY datasets
  (p.xy || []).forEach(f => {
    const idx = xyGlobalIdx++;
    xyFiles[idx] = Object.assign({}, f, { gIdx: idx });
    xyFileNames[idx] = f.filename || f.name;
  });
  renderXYFileCards();

  projectApplySettings(p.settings);
  if (p.legendNames) legendNameOverrides = { ocean: p.legendNames.ocean || {}, xy: p.legendNames.xy || {} };
  if (p.annotations) customAnnotations = { ocean: p.annotations.ocean || [], xy: p.annotations.xy || [] };
  if (p.shapes) customShapesStore = { ocean: p.shapes.ocean || [], xy: p.shapes.xy || [] };
  annotHistory.ocean = []; annotHistory.xy = [];

  if (p.xyTab) setXYTab(p.xyTab);
  setMode(p.mode === "xy" ? "xy" : "ocean");
  if (p.mode === "xy") { try { plotXY(); } catch (e) { /* nothing to plot yet */ } }
  else if ((p.raman || []).length) plotSpectrum();
  rxNotify(`Project opened (saved ${p.saved ? new Date(p.saved).toLocaleString() : "earlier"}): ${(p.raman || []).length} spectra, ${(p.xy || []).length} XY datasets.`);
}


/* ───────────────────────── METHODS TEXT ───────────────────────── */

function mtVal(id) { return document.getElementById(id)?.value; }
function mtNum(id) { const v = parseFloat(mtVal(id)); return Number.isFinite(v) ? v : null; }
function mtSel(id) { const el = document.getElementById(id); return el && el.selectedOptions[0] ? el.selectedOptions[0].text : ""; }
function mtPlural(n, w) { return `${n} ${w}${n === 1 ? "" : "s"}`; }

function smoothingSentence(type, w, poly, sigma) {
  if (type === "savgol") return { t: `smoothed with a Savitzky–Golay filter (window ${w} points, polynomial order ${poly})`, ref: "sg" };
  if (type === "moving_avg") return { t: `smoothed with a ${w}-point moving average` };
  if (type === "gaussian") return { t: `smoothed with a Gaussian kernel (σ = ${sigma} points)` };
  if (type === "median") return { t: `filtered with a ${w}-point median filter` };
  return null;
}

function normalisationSentence(type, scale) {
  const s = { max: "to their maximum intensity", minmax: "to the range 0–1 (min–max)", area: "to unit area (trapezoidal integral)", vector: "to unit vector length (Euclidean norm)", snv: "by standard normal variate (SNV: each spectrum centred on its own mean and divided by its own standard deviation)" }[type];
  if (type === "ref") return `normalised to the maximum of the reference band at ${mtNum("normRefX")} ± ${mtNum("normRefWin")} cm⁻¹`;
  if (!s) return null;
  return `normalised ${s}` + (scale && scale !== 1 ? `${type === "minmax" ? ` and scaled to 0–${scale}` : ` and multiplied by ${scale}`}` : "");
}

const RNSX_DOI = "10.5281/zenodo.23593680";
const RNSX_CITATION_APA = "Naik, R., & Srivastava, S. K. (2026). RNSpectraX (Spectral Plotter and Analytics Suite) (Version 3.4) [Computer software]. Zenodo. https://doi.org/10.5281/zenodo.23593680";
const RNSX_CITATION_BIB = `@software{naik_rnspectrax_2026,
  author    = {Naik, Rakesh and Srivastava, Sachin Kumar},
  title     = {{RNSpectraX (Spectral Plotter and Analytics Suite)}},
  version   = {3.4},
  year      = {2026},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.23593680},
  url       = {https://doi.org/10.5281/zenodo.23593680}
}`;

const MT_REFS = {
  rnsx: RNSX_CITATION_APA,
  als: "Eilers, P. H. C. & Boelens, H. F. M. (2005). Baseline correction with asymmetric least squares smoothing. Leiden University Medical Centre report.",
  modpoly: "Lieber, C. A. & Mahadevan-Jansen, A. (2003). Automated method for subtraction of fluorescence from biological Raman spectra. Applied Spectroscopy, 57(11), 1363–1367.",
  sg: "Savitzky, A. & Golay, M. J. E. (1964). Smoothing and differentiation of data by simplified least squares procedures. Analytical Chemistry, 36(8), 1627–1639.",
  wh: "Whitaker, D. A. & Hayes, K. (2018). A simple algorithm for despiking Raman spectra. Chemometrics and Intelligent Laboratory Systems, 179, 82–84.",
  lm: "Marquardt, D. W. (1963). An algorithm for least-squares estimation of nonlinear parameters. Journal of the Society for Industrial and Applied Mathematics, 11(2), 431–441.",
  welch: "Welch, B. L. (1947). The generalization of 'Student's' problem when several different population variances are involved. Biometrika, 34(1–2), 28–35.",
  ich: "ICH Q2(R1) (2005). Validation of analytical procedures: text and methodology. International Council for Harmonisation.",
  snv: "Barnes, R. J., Dhanoa, M. S. & Lister, S. J. (1989). Standard normal variate transformation and de-trending of near-infrared diffuse reflectance spectra. Applied Spectroscopy, 43(5), 772–777.",
  biolib: "RamanBiolib reference library (Open Database License): see the citation listed with each match."
};

function buildRamanMethods() {
  const act = spectra.filter(s => s);
  if (!act.length) return null;
  const refs = new Set(), parts = [];
  const groups = {};
  act.forEach(s => { const g = rtGroupOf(s); groups[g] = (groups[g] || 0) + 1; });
  const gNames = Object.keys(groups);
  const groupList = gNames.length > 1 ? ` (${gNames.map(g => `${g}, n = ${groups[g]}`).join("; ")})` : "";
  parts.push(act.length === 1 ? "1 Raman spectrum was processed in RNSpectraX v3.4 (Naik & Srivastava, 2026)." : `${act.length} Raman spectra${groupList} were processed in RNSpectraX v3.4 (Naik & Srivastava, 2026).`);
  const sh = mtNum("rsShift");
  if (sh) parts.push(`The Raman shift axis was corrected by ${sh > 0 ? "+" : ""}${sh} cm⁻¹ using the ${mtNum("rsCalRef")} cm⁻¹ band of a reference spectrum.`);
  const lo = mtNum("xmin"), hi = mtNum("xmax");
  if (lo != null && hi != null) parts.push(`The ${lo}–${hi} cm⁻¹ region was analysed${(mtVal("rsExclude") || "").trim() ? `, excluding ${parseRanges(mtVal("rsExclude")).map(r => `${r[0]}–${r[1]}`).join(", ")} cm⁻¹` : ""}.`);
  const steps = [];
  const ds = mtVal("despikeType");
  if (ds && ds !== "none") { steps.push(`cosmic-ray spikes were removed (${ds === "whitaker" ? "Whitaker–Hayes" : "modified z-score"} detection on the first difference, threshold ${mtNum("dsThresh")}, repair window ${mtNum("dsWin")} points)`); refs.add("wh"); }
  const bl = mtVal("baselineType");
  if (bl === "als") { steps.push(`the fluorescence background was removed by asymmetric least squares (λ = 10^${mtNum("blAlsLam")}, p = ${mtNum("blAlsP")})`); refs.add("als"); }
  else if (bl === "poly") { steps.push(`the fluorescence background was removed with an iterative modified polynomial fit (ModPoly, order ${mtNum("blParam1")})`); refs.add("modpoly"); }
  else if (bl === "rubberband") steps.push("the background was removed with a rubber-band (lower convex hull) baseline");
  else if (bl === "rolling_ball") steps.push(`the background was removed with a rolling-ball baseline (radius ${mtNum("blParam2")} points)`);
  else if (bl === "linear") steps.push(`a linear baseline between ${mtNum("blLinX1")} and ${mtNum("blLinX2")} cm⁻¹ was subtracted`);
  const sm = smoothingSentence(mtVal("smoothType"), mtNum("smParam1"), mtNum("smParam2"), mtNum("smParam3"));
  if (sm) { steps.push(`spectra were ${sm.t}`); if (sm.ref) refs.add(sm.ref); }
  const nm = normalisationSentence(mtVal("normType"));
  if (nm) { steps.push(`spectra were ${nm}`); if (mtVal("normType") === "snv") refs.add("snv"); }
  const dv = parseInt(mtVal("rsDeriv")) || 0;
  if (dv) { steps.push(`${dv === 1 ? "first" : "second"}-derivative spectra were computed with a Savitzky–Golay filter (window ${mtNum("rsDerivWin")} points, order ${mtNum("rsDerivOrder")})`); refs.add("sg"); }
  if (steps.length) parts.push(steps.map((s, i) => i === 0 ? s[0].toUpperCase() + s.slice(1) : s).join("; then ") + ", in that order.");
  const avg = mtVal("avgMode"), eb = mtVal("errBarY");
  if (avg === "groups" || avg === "grandavg") parts.push(`${avg === "groups" ? "Group" : "Grand"} mean spectra are shown${eb && eb !== "none" ? ` with ± ${eb === "sem" ? "standard error of the mean (SEM)" : "standard deviation (SD)"}` : ""}.`);
  if (document.getElementById("showPeaks")?.checked) parts.push(`Bands were located as local maxima with a topographic prominence of at least ${getPeakProminencePct()} % of the intensity range.`);
  if (lastRamanTool && lastRamanTool.methods) { parts.push(lastRamanTool.methods); (lastRamanTool.refs || []).forEach(r => refs.add(r)); }
  return { text: parts.join(" "), refs: [...refs] };
}

function buildXYMethods() {
  const ds = (() => { try { return gatherXYDatasets().filter(d => d.x.length); } catch (e) { return []; } })();
  if (!ds.length) return null;
  const refs = new Set(), parts = [];
  const groups = [...new Set(ds.map(d => d.group).filter(Boolean))];
  parts.push(`${mtPlural(ds.length, "dataset")}${groups.length ? ` in ${mtPlural(groups.length, "group")}` : ""} ${ds.length === 1 ? "was" : "were"} analysed in RNSpectraX v3.4 (Naik & Srivastava, 2026).`);
  const sm = smoothingSentence(mtVal("xySmoothType"), mtNum("xySmP1"), mtNum("xySmP2"), mtNum("xySmP1"));
  if (sm) { parts.push(`Data were ${sm.t}.`); if (sm.ref) refs.add(sm.ref); }
  const nm = normalisationSentence(mtVal("xyNorm"), mtNum("xyNormScale"));
  if (nm) { parts.push(`Each dataset was ${nm}.`); if (mtVal("xyNorm") === "snv") refs.add("snv"); }
  if (mtVal("xyGroupMode") === "groups" && groups.length) parts.push(`Replicates sharing a group name were averaged point by point and shown as mean ± ${mtVal("xyGroupErr") === "sem" ? "SEM" : "SD"}.`);
  const fm = mtVal("fitModel");
  if (fm && fm !== "none") { parts.push(`A ${mtSel("fitModel").toLowerCase()} model was fitted by ${/linear|poly/.test(fm) ? "weighted linear" : "non-linear (Levenberg–Marquardt)"} least squares; parameter uncertainties are 1σ standard errors from the covariance matrix scaled by the reduced χ².`); if (!/linear|poly/.test(fm)) refs.add("lm"); }
  if (typeof lastResonance !== "undefined" && lastResonance) {
    const R = lastResonance;
    const meth = { parabola: `the vertex of a least-squares parabola through the points within ±${mtVal("xyDipHalfWidth") || "1/10 of the window"} of the extreme point`, centroid: "the centroid of the part deeper than half its depth", min: "the extreme data point" }[mtVal("xyDipMethod")];
    parts.push(`The resonance ${R.type} was located in every replicate between ${mtVal("xyDipLo") || "the start"} and ${mtVal("xyDipHi") || "the end"} of the X axis as ${meth}; positions were averaged per group (mean ± ${mtVal("xyDipErr") === "sem" ? "SEM" : "SD"}).`);
    const ySel = mtVal("xyDipY");
    if (ySel === "fwhm" || ySel === "q" || ySel === "depth") parts.push(`The ${mtSel("xyDipY")} was taken at half the resonance depth, measured from the mean level at the window edges.`);
    if (R.fit) {
      const what = { shift: "resonance shift relative to the reference group", position: "resonance position", fwhm: "resonance FWHM", q: "Q factor (position / FWHM)", depth: "resonance depth" }[ySel] || "resonance position";
      parts.push(`The ${what} was plotted against concentration and fitted with a ${R.fit.label.toLowerCase()} model (R² = ${R.fit.r2.toFixed(4)}).`);
      if (R.fit.model === "linear") {
        if (R.lod != null) parts.push(`The limit of detection (LOD = 3σ/S) and quantification (LOQ = 10σ/S), with σ the standard deviation of the blank replicates and S the slope, were ${fmtNum(R.lod)} and ${fmtNum(R.loq)}${mtVal("xyDipUnit") ? " " + mtVal("xyDipUnit") : ""}.`);
        if (R.lodRes != null) { parts.push(`From the residual standard deviation of the calibration (ICH Q2), LOD = 3.3 s_y/x / S = ${fmtNum(R.lodRes)} and LOQ = 10 s_y/x / S = ${fmtNum(R.loqRes)}${mtVal("xyDipUnit") ? " " + mtVal("xyDipUnit") : ""}.`); refs.add("ich"); }
      }
    }
  }
  return { text: parts.join(" "), refs: [...refs] };
}

function showMethodsText() {
  rxTrack("methods-text");
  const m = currentMode === "xy" ? buildXYMethods() : buildRamanMethods();
  if (!m) { alert("Load and plot some data first: the text describes the settings used for it."); return; }
  // RNSpectraX itself is always cited first
  const refsTxt = "\n\nReferences\n" + ["rnsx"].concat(m.refs).map(r => "• " + MT_REFS[r]).join("\n");
  let ov = document.getElementById("methodsOverlay");
  if (!ov) {
    ov = document.createElement("div"); ov.id = "methodsOverlay"; ov.className = "rx-modal";
    ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "methodsTitle");
    ov.innerHTML = `<div class="rx-modal-card" style="width:min(760px,100%)">
      <div class="rx-modal-head"><h2 id="methodsTitle">📝 Methods text</h2><button class="rx-modal-close" onclick="closeMethodsText()" aria-label="Close">✕</button></div>
      <div class="rx-modal-body">
      <div style="font-size:12px;color:var(--muted);margin:6px 0 8px;">Generated from the current settings. Edit freely before pasting into your manuscript.</div>
      <textarea id="methodsTextBox" style="width:100%;min-height:280px;font-size:13px;line-height:1.55;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;">
        <button class="btn btn-outline btn-sm" onclick="downloadBlob(document.getElementById('methodsTextBox').value,'RNSpectraX_methods.txt','text/plain')">↓ .txt</button>
        <button class="btn btn-primary btn-sm" onclick="copyMethodsText()">⧉ Copy</button>
      </div></div></div>`;
    ov.addEventListener("click", ev => { if (ev.target === ov) closeMethodsText(); });
    document.body.appendChild(ov);
  }
  document.getElementById("methodsTextBox").value = m.text + refsTxt;
  ov.classList.add("is-open");
}
function closeMethodsText() { const ov = document.getElementById("methodsOverlay"); if (ov) ov.classList.remove("is-open"); }
function copyMethodsText() {
  const box = document.getElementById("methodsTextBox"); box.select();
  (navigator.clipboard ? navigator.clipboard.writeText(box.value) : Promise.reject()).then(() => rxNotify("Methods text copied"), () => { document.execCommand("copy"); rxNotify("Methods text copied"); });
}
document.addEventListener("keydown", e => { if (e.key === "Escape") closeMethodsText(); });


/* ───────────────────────── CITE RNSpectraX ───────────────────────── */

function showCitation() {
  rxTrack("cite-dialog");
  let ov = document.getElementById("citeOverlay");
  if (!ov) {
    ov = document.createElement("div"); ov.id = "citeOverlay"; ov.className = "rx-modal";
    ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "citeTitle");
    const esc = v => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    ov.innerHTML = `<div class="rx-modal-card" style="width:min(720px,100%)">
      <div class="rx-modal-head"><h2 id="citeTitle">📑 Cite RNSpectraX</h2><button class="rx-modal-close" onclick="closeCitation()" aria-label="Close">✕</button></div>
      <div class="rx-modal-body">
        <p style="font-size:13px;margin:8px 0 10px;">If RNSpectraX contributes to published work, please cite it. DOI:
          <a href="https://doi.org/${RNSX_DOI}" target="_blank" rel="noopener noreferrer">${RNSX_DOI}</a></p>
        <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px;">APA</div>
        <textarea id="citeApa" readonly style="width:100%;min-height:70px;font-size:13px;line-height:1.5;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);">${esc(RNSX_CITATION_APA)}</textarea>
        <div style="display:flex;justify-content:flex-end;margin:6px 0 12px;"><button class="btn btn-outline btn-sm" onclick="copyCitation('citeApa')">⧉ Copy APA</button></div>
        <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px;">BibTeX</div>
        <textarea id="citeBib" readonly style="width:100%;min-height:170px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);">${esc(RNSX_CITATION_BIB)}</textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
          <button class="btn btn-outline btn-sm" onclick="downloadBlob(RNSX_CITATION_BIB,'RNSpectraX.bib','application/x-bibtex')">↓ .bib</button>
          <button class="btn btn-primary btn-sm" onclick="copyCitation('citeBib')">⧉ Copy BibTeX</button>
        </div>
      </div></div>`;
    ov.addEventListener("click", ev => { if (ev.target === ov) closeCitation(); });
    document.body.appendChild(ov);
  }
  ov.classList.add("is-open");
}
function closeCitation() { const ov = document.getElementById("citeOverlay"); if (ov) ov.classList.remove("is-open"); }
function copyCitation(id) {
  const box = document.getElementById(id); box.select();
  (navigator.clipboard ? navigator.clipboard.writeText(box.value) : Promise.reject()).then(() => rxNotify("Citation copied"), () => { document.execCommand("copy"); rxNotify("Citation copied"); });
}
document.addEventListener("keydown", e => { if (e.key === "Escape") closeCitation(); });
