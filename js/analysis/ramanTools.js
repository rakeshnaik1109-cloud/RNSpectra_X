/* ═══════════════════════════════════════════════════════════
   RAMAN ANALYSIS TOOLS (🔬 Analysis panel)
   All four tools work on the spectra exactly as processed for the plot
   (despike → baseline → smoothing → normalisation → derivative).
   • Peak fitting — a region as a sum of Gaussian / Lorentzian /
     pseudo-Voigt bands on a flat or sloping background (Levenberg–
     Marquardt), with standard errors on every parameter and area.
   • Band ratio / area — a band height or area (or a ratio of two) for
     every spectrum, per-group mean ± SD and a significance test.
   • PCA — score plot coloured by group with 95 % ellipses, and loadings.
   • Difference spectrum — mean(A) − mean(B) with its uncertainty band.
═══════════════════════════════════════════════════════════ */

let lastRamanTool = null;   // { kind, csv, title } of the last result shown

function rtEsc(v) { return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
function rtNum(id, dflt) { const v = parseFloat(document.getElementById(id)?.value); return Number.isFinite(v) ? v : dflt; }
function rtGroupOf(s) { return (document.getElementById("group" + s.gIdx)?.value || "Group 1").trim() || "Group 1"; }
function rtLabelOf(s) { return document.getElementById("label" + s.gIdx)?.value || oceanFileNames[s.gIdx] || `File ${s.gIdx + 1}`; }
function rtXLabel() { return document.getElementById("xlabel")?.value || "Raman shift (cm⁻¹)"; }
function rtYLabel() { return document.getElementById("ylabel")?.value || "Intensity (a.u.)"; }

// Every loaded spectrum, processed as for the plot
function rtProcessedSpectra() {
  return spectra.filter(s => s != null).map(s => {
    const p = processSpec(s);
    return { gIdx: s.gIdx, label: rtLabelOf(s), group: rtGroupOf(s), x: p.xx, y: p.yy };
  }).filter(s => s.x.length > 2);
}

// Option list shared by the tool selectors: files, group averages, grand average
function rtSpectrumOptions(withBatch) {
  const active = spectra.filter(s => s != null);
  const opts = [];
  if (withBatch && active.length > 1) opts.push(["batch", `Every file, one by one (n=${active.length})`]);
  active.forEach(s => opts.push([`file:${s.gIdx}`, rtLabelOf(s)]));
  const groups = {};
  active.forEach(s => { const g = rtGroupOf(s); (groups[g] = groups[g] || []).push(s); });
  Object.keys(groups).forEach(g => { if (groups[g].length > 1 || Object.keys(groups).length > 1) opts.push([`group:${g}`, `Group average — ${g} (n=${groups[g].length})`]); });
  if (active.length > 1) opts.push(["grand", `Grand average (n=${active.length})`]);
  return opts;
}

function rtFillSelect(id, withBatch, preferIdx) {
  const sel = document.getElementById(id); if (!sel) return;
  const prev = sel.value, opts = rtSpectrumOptions(withBatch);
  sel.innerHTML = opts.length ? opts.map(([v, t]) => `<option value="${rtEsc(v)}">${rtEsc(t)}</option>`).join("") : `<option value="">Load spectra first</option>`;
  if (opts.some(o => o[0] === prev)) sel.value = prev;
  else if (preferIdx != null && opts[preferIdx]) sel.value = opts[preferIdx][0];
}

function refreshRamanToolTargets() {
  rtFillSelect("rtFitTarget", true);
  const groupOpts = rtSpectrumOptions(false).filter(o => o[0].startsWith("group:"));
  const gi = k => { const all = rtSpectrumOptions(false); const g = all.findIndex(o => o[0] === (groupOpts[k] || [])[0]); return g >= 0 ? g : k; };
  rtFillSelect("rtDiffA", false, gi(0));
  rtFillSelect("rtDiffB", false, gi(1));
}

// Resolve a selector value to { x, y, sd, sem, n, label }
function rtResolveSpectrum(v) {
  const active = spectra.filter(s => s != null);
  if (!v || !active.length) return null;
  if (v.startsWith("file:")) {
    const s = active.find(sp => String(sp.gIdx) === v.slice(5)); if (!s) return null;
    const p = processSpec(s);
    return { x: p.xx, y: p.yy, sd: null, sem: null, n: 1, label: rtLabelOf(s) };
  }
  let members = active, label = "Grand average";
  if (v.startsWith("group:")) { const g = v.slice(6); label = g; members = active.filter(s => rtGroupOf(s) === g); }
  const agg = averageSpecs(members); if (!agg) return null;
  return { x: agg.x, y: agg.mean, sd: agg.sd, sem: agg.sem, n: agg.n, label: `${label} (n=${agg.n})` };
}

function switchRamanTool() {
  const t = document.getElementById("rtTool").value;
  ["peakfit", "ratio", "pca", "diff"].forEach(k => { const el = document.getElementById("rtPane_" + k); if (el) el.style.display = k === t ? "block" : "none"; });
  refreshRamanToolTargets();
}

function rtAxis(title, extra) {
  return Object.assign({ title: { text: title }, showline: true, mirror: true, ticks: "outside", zeroline: false, linecolor: "#334155", tickfont: { size: 12 } }, extra || {});
}

function rtShowSection(title) {
  const sec = document.getElementById("rtSection");
  sec.style.display = "block";
  if (window.rxShowResult) rxShowResult("rtSection");
  document.getElementById("rtTitle").textContent = title;
  document.getElementById("rtPlot2").style.display = "none";
  document.getElementById("rtDlLoadings").style.display = "none";
  Plotly.purge("rtPlot2");
  return sec;
}

function rtPlot(div, traces, layout) {
  const el = document.getElementById(div); el.style.display = "block";
  Plotly.newPlot(el, traces, Object.assign({ plot_bgcolor: "white", paper_bgcolor: "white", height: 440, margin: { l: 80, r: 30, t: 50, b: 65 },
    legend: { x: 0.01, y: 0.99, bgcolor: "rgba(255,255,255,0.85)", bordercolor: "#94a3b8", borderwidth: 1 } }, layout),
    { displaylogo: false, responsive: true, edits: { titleText: true, axisTitleText: true, legendPosition: true } });
}

function downloadRamanToolCSV() {
  if (!lastRamanTool) { alert("Run one of the analysis tools first."); return; }
  downloadBlob(lastRamanTool.csv, `RNSpectraX_${lastRamanTool.kind}.csv`, "text/csv");
}

function downloadRamanToolPlot(which) {
  const el = document.getElementById(which || "rtPlot");
  if (!el || !el.data) { alert("Run one of the analysis tools first."); return; }
  Plotly.downloadImage(el, { format: "png", scale: 3, filename: `RNSpectraX_${lastRamanTool ? lastRamanTool.kind : "analysis"}` });
}

const csvq = s => `"${String(s).replace(/"/g, '""')}"`;


/* ───────────────────────── PEAK FITTING ───────────────────────── */

const RT_GAUSS_AREA = Math.sqrt(Math.PI / (4 * Math.LN2));   // area = 1.0645·A·FWHM

function rtProfile(kind, x, A, c, w, eta) {
  const t = (x - c) / w;
  const G = Math.exp(-4 * Math.LN2 * t * t), L = 1 / (1 + 4 * t * t);
  return kind === "gaussian" ? A * G : kind === "lorentzian" ? A * L : A * (eta * L + (1 - eta) * G);
}
function rtArea(kind, A, w, eta) {
  const g = A * Math.abs(w) * RT_GAUSS_AREA, l = A * Math.abs(w) * Math.PI / 2;
  return kind === "gaussian" ? g : kind === "lorentzian" ? l : eta * l + (1 - eta) * g;
}
const rtSigmoid = q => 1 / (1 + Math.exp(-q));

// Parameter vector: per band [A, c, w (, q → η = sigmoid(q))], then background
function rtMakeModel(kind, nPk, bg, xMid) {
  const per = kind === "voigt" ? 4 : 3;
  const f = (x, p) => {
    let s = 0;
    for (let k = 0; k < nPk; k++) {
      const o = k * per, w = Math.abs(p[o + 2]) || 1e-9;
      s += rtProfile(kind, x, p[o], p[o + 1], w, per === 4 ? rtSigmoid(p[o + 3]) : 0);
    }
    const b = nPk * per;
    if (bg === "constant") s += p[b];
    else if (bg === "linear") s += p[b] + p[b + 1] * (x - xMid);
    return s;
  };
  return { f, per };
}

// Candidate band centres: minima of the 2nd derivative (they mark shoulders as
// well as resolved maxima), the deepest first
function rtAutoCentres(x, y, n) {
  const d2 = sgDerivative(x, applySmoothing(y.slice(), "savgol", Math.max(5, Math.round(x.length / 25) | 1), 2), 2, Math.max(7, Math.round(x.length / 20) | 1), 3);
  const cand = [];
  for (let i = 2; i < x.length - 2; i++) if (d2[i] < 0 && d2[i] <= d2[i - 1] && d2[i] <= d2[i + 1]) cand.push(i);
  cand.sort((a, b) => d2[a] - d2[b]);
  const chosen = [];
  const minSep = (x[x.length - 1] - x[0]) / (4 * n);
  for (const i of cand) { if (chosen.every(j => Math.abs(x[j] - x[i]) > minSep)) chosen.push(i); if (chosen.length >= n) break; }
  return chosen.map(i => x[i]).sort((a, b) => a - b);
}

function fitBandsToSpectrum(xFull, yFull, o) {
  const x = [], y = [];
  xFull.forEach((v, i) => { if (v >= o.lo && v <= o.hi && Number.isFinite(yFull[i])) { x.push(v); y.push(yFull[i]); } });
  const ord = x.map((_, i) => i).sort((a, b) => x[a] - x[b]);
  const xs = ord.map(i => x[i]), ys = ord.map(i => y[i]);
  const n = xs.length;
  if (n < 8) return { error: "fewer than 8 points inside the fit region" };
  let centres = o.centres && o.centres.length ? o.centres.slice() : rtAutoCentres(xs, ys, o.nAuto);
  centres = centres.filter(c => c >= xs[0] && c <= xs[n - 1]);
  if (!centres.length) return { error: "no band centres inside the region (type them, e.g. 1610, 1655)" };
  const xMid = (xs[0] + xs[n - 1]) / 2;
  // background start: straight line through the region's end points
  const e = Math.max(1, Math.round(n / 20));
  const yL = statMean(ys.slice(0, e)), yR = statMean(ys.slice(-e));
  const slope = (yR - yL) / ((xs[n - 1] - xs[0]) || 1);
  const bgAt = xv => o.bg === "none" ? 0 : o.bg === "constant" ? Math.min(yL, yR) : yL + slope * (xv - xs[0]);
  const { f, per } = rtMakeModel(o.kind, centres.length, o.bg, xMid);
  const p0 = [];
  const span = xs[n - 1] - xs[0];
  centres.forEach(c => {
    const i = nearestIdx(xs, c), h = Math.max(ys[i] - bgAt(c), (Math.max(...ys) - Math.min(...ys)) * 0.05);
    let w = o.width > 0 ? o.width : 0;
    if (!w) { // half-height walk
      let a = i, b = i; const half = bgAt(c) + h / 2;
      while (a > 0 && ys[a] > half) a--; while (b < n - 1 && ys[b] > half) b++;
      w = Math.min(Math.max(xs[b] - xs[a], span / (8 * centres.length)), span / centres.length);
    }
    p0.push(h, c, w); if (per === 4) p0.push(0);
  });
  if (o.bg === "constant") p0.push(Math.min(yL, yR));
  else if (o.bg === "linear") p0.push(yL + slope * (xMid - xs[0]), slope);
  const w8 = new Array(n).fill(1);
  const res = levenbergMarquardt(f, xs, ys, w8, p0, 500);
  if (!res) return { error: "the fit did not converge" };
  const p = res.p, k = p.length, dof = Math.max(1, n - k);
  const s2 = res.chi2 / dof;
  const J = fitJacobian(f, xs, p);
  const { A } = fitNormalEquations(J, w8, new Array(n).fill(0));
  const inv = fitInverse(A);
  const cov = inv ? inv.map(r => r.map(v => v * s2)) : null;
  const se = j => cov && cov[j][j] >= 0 ? Math.sqrt(cov[j][j]) : NaN;
  const ybar = statMean(ys), ssTot = ys.reduce((s, v) => s + (v - ybar) ** 2, 0);
  const bands = centres.map((_, b) => {
    const o0 = b * per, Aamp = p[o0], c = p[o0 + 1], w = Math.abs(p[o0 + 2]);
    const eta = per === 4 ? rtSigmoid(p[o0 + 3]) : (o.kind === "lorentzian" ? 1 : 0);
    const area = rtArea(o.kind, Aamp, w, eta);
    // area error by propagation through the covariance of (A, w, q)
    let areaErr = NaN;
    if (cov) {
      const idx = [o0, o0 + 2].concat(per === 4 ? [o0 + 3] : []);
      const g = idx.map(j => { const h = Math.abs(p[j]) * 1e-6 || 1e-9; const pp = p.slice(), pm = p.slice(); pp[j] += h; pm[j] -= h;
        const ar = q => rtArea(o.kind, q[o0], Math.abs(q[o0 + 2]), per === 4 ? rtSigmoid(q[o0 + 3]) : (o.kind === "lorentzian" ? 1 : 0));
        return (ar(pp) - ar(pm)) / (2 * h); });
      let v = 0; idx.forEach((a, ia) => idx.forEach((bb, ib) => { v += g[ia] * g[ib] * cov[a][bb]; }));
      areaErr = v >= 0 ? Math.sqrt(v) : NaN;
    }
    const etaErr = per === 4 && cov ? eta * (1 - eta) * se(o0 + 3) : NaN;
    return { centre: c, centreErr: se(o0 + 1), fwhm: w, fwhmErr: se(o0 + 2), height: Aamp, heightErr: se(o0), area, areaErr, eta, etaErr };
  });
  const tot = bands.reduce((s, b) => s + Math.max(0, b.area), 0) || 1;
  bands.forEach(b => { b.areaPct = 100 * Math.max(0, b.area) / tot; });
  const fitY = xs.map(v => f(v, p));
  const bgY = xs.map(v => { const b0 = centres.length * per; return o.bg === "constant" ? p[b0] : o.bg === "linear" ? p[b0] + p[b0 + 1] * (v - xMid) : 0; });
  const compsRaw = centres.map((_, b) => { const o0 = b * per; return xs.map((v, i) => bgY[i] + rtProfile(o.kind, v, p[o0], p[o0 + 1], Math.abs(p[o0 + 2]) || 1e-9, per === 4 ? rtSigmoid(p[o0 + 3]) : 0)); });
  // report bands (and their curves) in order of position
  const order = bands.map((_, i) => i).sort((a, b) => bands[a].centre - bands[b].centre);
  const comps = order.map(i => compsRaw[i]);
  bands.splice(0, bands.length, ...order.map(i => bands[i]));
  return { x: xs, y: ys, fitY, bgY, comps, bands, r2: ssTot > 0 ? 1 - res.chi2 / ssTot : NaN, rmse: Math.sqrt(res.chi2 / n), n, k, converged: res.converged, centresUsed: centres };
}

function rtFitOptions() {
  let lo = rtNum("rtFitLo", 1580), hi = rtNum("rtFitHi", 1720); if (lo > hi) [lo, hi] = [hi, lo];
  return { lo, hi, kind: document.getElementById("rtFitProfile").value, bg: document.getElementById("rtFitBg").value,
    centres: parseXList(document.getElementById("rtFitCentres").value), nAuto: Math.max(1, Math.min(12, rtNum("rtFitN", 2) | 0)), width: rtNum("rtFitWidth", 0) };
}

const rtPm = (v, e, d = 2) => Number.isFinite(v) ? (Number.isFinite(e) ? `${v.toFixed(d)} ± ${e.toFixed(d)}` : v.toFixed(d)) : "—";
const rtSig = v => Number.isFinite(v) ? fmtNum(v) : "—";

function runRamanPeakFit() {
  rxTrack("raman-peak-fit");
  if (!spectra.some(s => s)) { alert("Load spectra first."); return; }
  refreshRamanToolTargets();
  const o = rtFitOptions(), target = document.getElementById("rtFitTarget").value;
  const kindName = { gaussian: "Gaussian", lorentzian: "Lorentzian", voigt: "pseudo-Voigt" }[o.kind];
  rtShowSection(`Peak fitting — ${o.lo}–${o.hi} ${rtXLabel().match(/\(([^)]+)\)/)?.[1] || ""}`);
  const body = document.getElementById("rtBody");

  if (target === "batch") {
    const list = rtProcessedSpectra();
    // the first spectrum's fit seeds the band count and positions for the rest
    const first = fitBandsToSpectrum(list[0].x, list[0].y, o);
    if (first.error) { body.innerHTML = `<div class="fit-result" style="color:var(--danger,#dc2626)">${rtEsc(list[0].label)}: ${first.error}</div>`; return; }
    const seed = Object.assign({}, o, { centres: o.centres.length ? o.centres : first.bands.map(b => b.centre) });
    const results = list.map(s => ({ s, r: fitBandsToSpectrum(s.x, s.y, seed) }));
    const nb = seed.centres.length;
    let rows = "", csv = "file,group,band,centre,centre_se,fwhm,fwhm_se,height,height_se,area,area_se,area_pct,eta,R2\n";
    results.forEach(({ s, r }) => {
      if (r.error) { rows += `<tr><td>${rtEsc(s.label)}</td><td colspan="7" style="color:var(--danger)">${r.error}</td></tr>`; return; }
      r.bands.forEach((b, j) => {
        rows += `<tr><td>${j === 0 ? rtEsc(s.label) : ""}</td><td>${j === 0 ? rtEsc(s.group) : ""}</td><td>${j + 1}</td><td>${rtPm(b.centre, b.centreErr)}</td><td>${rtPm(b.fwhm, b.fwhmErr)}</td><td>${rtSig(b.area)}</td><td>${b.areaPct.toFixed(1)}</td><td>${j === 0 ? r.r2.toFixed(4) : ""}</td></tr>`;
        csv += [csvq(s.label), csvq(s.group), j + 1, b.centre, b.centreErr, b.fwhm, b.fwhmErr, b.height, b.heightErr, b.area, b.areaErr, b.areaPct, b.eta, r.r2].join(",") + "\n";
      });
    });
    // per-group summary of every band parameter
    const groups = {};
    results.forEach(({ s, r }) => { if (!r.error && r.bands.length === nb) (groups[s.group] = groups[s.group] || []).push(r); });
    let sum = "", sumCsv = "\ngroup,band,n,centre_mean,centre_sd,fwhm_mean,fwhm_sd,area_mean,area_sd,area_pct_mean,area_pct_sd\n";
    Object.entries(groups).forEach(([g, rs]) => {
      for (let j = 0; j < nb; j++) {
        const col = key => rs.map(r => r.bands[j][key]);
        const ms = key => { const a = col(key); return [statMean(a), a.length > 1 ? Math.sqrt(statVar(a)) : NaN]; };
        const [cm, cs] = ms("centre"), [wm, ws] = ms("fwhm"), [am, as] = ms("area"), [pm, ps] = ms("areaPct");
        sum += `<tr><td>${j === 0 ? rtEsc(g) : ""}</td><td>${j + 1}</td><td>${rs.length}</td><td>${rtPm(cm, cs)}</td><td>${rtPm(wm, ws)}</td><td>${rtSig(am)}${Number.isFinite(as) ? " ± " + rtSig(as) : ""}</td><td>${rtPm(pm, ps, 1)}</td></tr>`;
        sumCsv += [csvq(g), j + 1, rs.length, cm, cs, wm, ws, am, as, pm, ps].join(",") + "\n";
      }
    });
    body.innerHTML = `<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">${kindName} bands on a ${o.bg === "none" ? "zero" : o.bg} background, fitted to every file with the same starting positions (${seed.centres.map(c => c.toFixed(0)).join(", ")}). ± = 1σ standard error.</div>
      <h4 style="margin:6px 0">Per group (mean ± SD over files)</h4>
      <div style="overflow-x:auto"><table class="peak-table"><thead><tr><th>Group</th><th>Band</th><th>n</th><th>Centre</th><th>FWHM</th><th>Area</th><th>Area %</th></tr></thead><tbody>${sum}</tbody></table></div>
      <h4 style="margin:12px 0 6px">Per file</h4>
      <div style="overflow-x:auto"><table class="peak-table"><thead><tr><th>File</th><th>Group</th><th>Band</th><th>Centre</th><th>FWHM</th><th>Area</th><th>Area %</th><th>R²</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    lastRamanTool = { kind: "PeakFit_batch", csv: csv + sumCsv, refs: ["lm"],
      methods: `The ${o.lo}–${o.hi} cm⁻¹ region of every spectrum was fitted with ${nb} ${kindName} band${nb === 1 ? "" : "s"} on a ${o.bg === "none" ? "zero" : o.bg} background by Levenberg–Marquardt least squares; band centres, FWHM and areas are reported as group mean ± SD.` };
    const ok = results.find(q => !q.r.error);
    if (ok) rtPlotPeakFit(ok.r, `${ok.s.label} (first of ${results.length})`, kindName);
    return;
  }

  const sp = rtResolveSpectrum(target);
  if (!sp) { body.innerHTML = `<div class="fit-result">Choose a spectrum to fit.</div>`; return; }
  const r = fitBandsToSpectrum(sp.x, sp.y, o);
  if (r.error) { body.innerHTML = `<div class="fit-result" style="color:var(--danger,#dc2626)">${r.error}.</div>`; Plotly.purge("rtPlot"); return; }
  const etaCol = o.kind === "voigt";
  body.innerHTML = `<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">${rtEsc(sp.label)} · ${r.bands.length} ${kindName} band${r.bands.length === 1 ? "" : "s"} on a ${o.bg === "none" ? "zero" : o.bg} background · R² = ${r.r2.toFixed(5)} · RMSE = ${rtSig(r.rmse)} · ${r.n} points, ${r.k} parameters${r.converged ? "" : " · <b style='color:var(--danger)'>not fully converged</b>"} · ± = 1σ standard error${o.centres.length ? "" : ` · start positions found automatically (${r.centresUsed.map(c => c.toFixed(0)).join(", ")}); type your own to override`}</div>
    <div style="overflow-x:auto"><table class="peak-table"><thead><tr><th>Band</th><th>Centre</th><th>FWHM</th><th>Height</th><th>Area</th><th>Area %</th>${etaCol ? "<th>η (Lorentz fraction)</th>" : ""}</tr></thead><tbody>
    ${r.bands.map((b, j) => `<tr><td>${j + 1}</td><td><b>${rtPm(b.centre, b.centreErr)}</b></td><td>${rtPm(b.fwhm, b.fwhmErr)}</td><td>${rtSig(b.height)} ± ${rtSig(b.heightErr)}</td><td>${rtSig(b.area)} ± ${rtSig(b.areaErr)}</td><td>${b.areaPct.toFixed(1)}</td>${etaCol ? `<td>${rtPm(b.eta, b.etaErr, 2)}</td>` : ""}</tr>`).join("")}
    </tbody></table></div>`;
  let csv = `spectrum,${csvq(sp.label)}\nprofile,${kindName}\nbackground,${o.bg}\nregion,${o.lo},${o.hi}\nR2,${r.r2}\nRMSE,${r.rmse}\n\nband,centre,centre_se,fwhm,fwhm_se,height,height_se,area,area_se,area_pct,eta\n`;
  r.bands.forEach((b, j) => { csv += [j + 1, b.centre, b.centreErr, b.fwhm, b.fwhmErr, b.height, b.heightErr, b.area, b.areaErr, b.areaPct, b.eta].join(",") + "\n"; });
  csv += "\nx,data,fit,background," + r.comps.map((_, j) => "band" + (j + 1)).join(",") + "\n";
  r.x.forEach((v, i) => { csv += [v, r.y[i], r.fitY[i], r.bgY[i]].concat(r.comps.map(c => c[i])).join(",") + "\n"; });
  lastRamanTool = { kind: "PeakFit", csv, refs: ["lm"],
    methods: `The ${o.lo}–${o.hi} cm⁻¹ region of ${sp.label} was fitted with ${r.bands.length} ${kindName} band${r.bands.length === 1 ? "" : "s"} on a ${o.bg === "none" ? "zero" : o.bg} background by Levenberg–Marquardt least squares (R² = ${r.r2.toFixed(4)}); uncertainties are 1σ standard errors from the covariance matrix.` };
  rtPlotPeakFit(r, sp.label, kindName);
}

function rtPlotPeakFit(r, label, kindName) {
  const pal = ["#1f77b4", "#2ca02c", "#ff7f0e", "#9467bd", "#8c564b", "#e377c2", "#17becf", "#bcbd22", "#7f7f7f", "#003f5c", "#d62728", "#000000"];
  const tr = [{ x: r.x, y: r.y, mode: "markers", name: "Data", marker: { size: 4, color: "#475569" } }];
  r.comps.forEach((c, j) => tr.push({ x: r.x, y: c, mode: "lines", name: `Band ${j + 1} (${r.bands[j] ? r.bands[j].centre.toFixed(1) : ""})`, line: { width: 1.5, color: pal[j % pal.length] }, fill: "tonexty", fillcolor: hexToRgba(pal[j % pal.length], 0.15) }));
  // fill each band down to the background: insert the background before every band
  const withBg = [tr[0]];
  r.comps.forEach((c, j) => { withBg.push({ x: r.x, y: r.bgY, mode: "lines", line: { width: 0 }, hoverinfo: "skip", showlegend: false }); withBg.push(tr[j + 1]); });
  withBg.push({ x: r.x, y: r.fitY, mode: "lines", name: `Sum of ${kindName} bands (R²=${r.r2.toFixed(4)})`, line: { width: 2.2, color: "#d62728" } });
  if (r.bgY.some(v => v !== 0)) withBg.push({ x: r.x, y: r.bgY, mode: "lines", name: "Background", line: { width: 1, color: "#64748b", dash: "dot" } });
  withBg.push({ x: r.x, y: r.y.map((v, i) => v - r.fitY[i]), mode: "lines", name: "Residual", line: { width: 1, color: "#64748b" }, xaxis: "x", yaxis: "y2", showlegend: false });
  rtPlot("rtPlot", withBg, {
    title: { text: `Band fit — ${rtEsc(label)}`, font: { size: 15 } }, height: 520,
    xaxis: rtAxis(rtXLabel(), { anchor: "y2" }),
    yaxis: rtAxis(rtYLabel(), { domain: [0.26, 1] }),
    yaxis2: rtAxis("Residual", { domain: [0, 0.2], zeroline: true, zerolinecolor: "#cbd5e1" }),
    legend: { x: 0.01, y: 0.99, bgcolor: "rgba(255,255,255,0.85)", bordercolor: "#94a3b8", borderwidth: 1, font: { size: 11 } }
  });
}


/* ───────────────────────── BAND RATIO / AREA ───────────────────────── */

// "1004" → ±window around 1004; "990-1020" → that range
function rtBandRange(text, win) {
  const v = parseXList(text);
  if (!v.length) return null;
  return v.length >= 2 ? [Math.min(v[0], v[1]), Math.max(v[0], v[1])] : [v[0] - win, v[0] + win];
}

function rtBandValue(x, y, range, metric, localBl) {
  const idx = []; x.forEach((v, i) => { if (v >= range[0] && v <= range[1] && Number.isFinite(y[i])) idx.push(i); });
  if (idx.length < 2) return NaN;
  idx.sort((a, b) => x[a] - x[b]);
  const i0 = idx[0], i1 = idx[idx.length - 1];
  const line = xv => localBl ? y[i0] + (y[i1] - y[i0]) * (xv - x[i0]) / ((x[i1] - x[i0]) || 1) : 0;
  if (metric === "height") { let m = -Infinity; idx.forEach(i => { m = Math.max(m, y[i] - line(x[i])); }); return m; }
  let a = 0; for (let k = 1; k < idx.length; k++) { const p = idx[k - 1], q = idx[k]; a += (x[q] - x[p]) * ((y[q] - line(x[q])) + (y[p] - line(x[p]))) / 2; }
  return a;
}

function runBandRatio() {
  rxTrack("raman-band-ratio");
  const list = rtProcessedSpectra();
  if (!list.length) { alert("Load spectra first."); return; }
  const win = rtNum("rtBandWin", 10), metric = document.getElementById("rtBandMetric").value, localBl = document.getElementById("rtBandLocalBl").checked;
  const ra = rtBandRange(document.getElementById("rtBandA").value, win), rb = rtBandRange(document.getElementById("rtBandB").value, win);
  if (!ra) { alert("Type band A, e.g. 1004 or 990-1020."); return; }
  const fmtR = r => `${+r[0].toFixed(1)}–${+r[1].toFixed(1)}`;
  const what = `${metric === "area" ? "Area" : "Height"} ${fmtR(ra)}${rb ? ` / ${metric === "area" ? "Area" : "Height"} ${fmtR(rb)}` : ""}`;
  const vals = list.map(s => {
    const a = rtBandValue(s.x, s.y, ra, metric, localBl), b = rb ? rtBandValue(s.x, s.y, rb, metric, localBl) : 1;
    return { s, a, b, v: rb ? a / b : a };
  });
  const groups = [], byG = {};
  vals.forEach(o => { if (!byG[o.s.group]) { byG[o.s.group] = []; groups.push(o.s.group); } if (Number.isFinite(o.v)) byG[o.s.group].push(o.v); });
  const summ = groups.map(g => { const a = byG[g]; return { g, n: a.length, mean: a.length ? statMean(a) : NaN, sd: a.length > 1 ? Math.sqrt(statVar(a)) : NaN }; });
  summ.forEach(r => { r.sem = r.n > 1 ? r.sd / Math.sqrt(r.n) : NaN; });
  const errKind = document.getElementById("rtBandErr").value;
  let testHtml = "", testCsv = "";
  const testable = groups.filter(g => byG[g].length >= 2);
  if (testable.length === 2) {
    const t = welchTTest(byG[testable[0]], byG[testable[1]]);
    if (t) { testHtml = `${t.test}: t = ${t.t.toFixed(3)}, df = ${t.df.toFixed(1)}, <b>${fmtP(t.p)}</b> ${pStars(t.p)}`; testCsv = `${t.test},t,${t.t},df,${t.df},p,${t.p}\n`; }
  } else if (testable.length > 2) {
    const an = oneWayAnova(testable.map(g => byG[g]));
    if (an) { testHtml = `${an.test}: F(${an.df1}, ${an.df2}) = ${an.F.toFixed(3)}, <b>${fmtP(an.p)}</b> ${pStars(an.p)}`; testCsv = `${an.test},F,${an.F},df1,${an.df1},df2,${an.df2},p,${an.p}\n`; }
    const pw = [];
    for (let i = 0; i < testable.length; i++) for (let j = i + 1; j < testable.length; j++) {
      const t = welchTTest(byG[testable[i]], byG[testable[j]]); if (t) pw.push(`${rtEsc(testable[i])} vs ${rtEsc(testable[j])}: ${fmtP(t.p)} ${pStars(t.p)}`);
      if (t) testCsv += `pairwise Welch,${csvq(testable[i])},${csvq(testable[j])},p,${t.p}\n`;
    }
    if (pw.length) testHtml += `<br><span style="font-size:11px;color:var(--muted)">Pairwise Welch t-tests (not corrected for multiple comparisons): ${pw.join(" · ")}</span>`;
  } else testHtml = `<span style="color:var(--muted)">A significance test needs at least two groups with ≥ 2 spectra each (set the Group boxes or use Quick grouping).</span>`;

  rtShowSection(`Band ${rb ? "ratio" : metric} — ${what}`);
  document.getElementById("rtBody").innerHTML = `
    <div class="fit-result" style="margin-bottom:8px;">${testHtml}</div>
    <div style="overflow-x:auto"><table class="peak-table"><thead><tr><th>Group</th><th>n</th><th>Mean</th><th>SD</th><th>SEM</th></tr></thead><tbody>
    ${summ.map(r => `<tr><td>${rtEsc(r.g)}</td><td>${r.n}</td><td><b>${rtSig(r.mean)}</b></td><td>${rtSig(r.sd)}</td><td>${rtSig(r.sem)}</td></tr>`).join("")}</tbody></table></div>
    <details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px">Per-spectrum values</summary>
    <div style="overflow-x:auto"><table class="peak-table"><thead><tr><th>Spectrum</th><th>Group</th><th>Band A</th>${rb ? "<th>Band B</th>" : ""}<th>Value</th></tr></thead><tbody>
    ${vals.map(o => `<tr><td>${rtEsc(o.s.label)}</td><td>${rtEsc(o.s.group)}</td><td>${rtSig(o.a)}</td>${rb ? `<td>${rtSig(o.b)}</td>` : ""}<td><b>${rtSig(o.v)}</b></td></tr>`).join("")}</tbody></table></div></details>
    <div style="font-size:11px;color:var(--hint);margin-top:6px;">${metric === "area" ? "Trapezoidal area" : "Maximum"} inside each band${localBl ? ", above a straight line joining the band edges" : ""}. Error bars: ${errKind === "sem" ? "SEM" : "SD"}; dots are the individual spectra.</div>`;
  let csv = `measure,${csvq(what)}\nlocal_baseline,${localBl}\n\nspectrum,group,band_A,band_B,value\n`;
  vals.forEach(o => { csv += [csvq(o.s.label), csvq(o.s.group), o.a, rb ? o.b : "", o.v].join(",") + "\n"; });
  csv += "\ngroup,n,mean,sd,sem\n"; summ.forEach(r => { csv += [csvq(r.g), r.n, r.mean, r.sd, r.sem].join(",") + "\n"; });
  if (testCsv) csv += "\n" + testCsv;
  const testName = testable.length === 2 ? "Welch's t-test" : testable.length > 2 ? "one-way ANOVA" : "";
  lastRamanTool = { kind: rb ? "BandRatio" : "BandValue", csv, refs: testable.length === 2 ? ["welch"] : [],
    methods: `The band ${metric} ${rb ? "ratio " : ""}${what} was computed for every spectrum${localBl ? " above a local linear baseline" : ""}${testName ? ` and compared between groups with ${testName}` : ""}.` };

  const pal = GROUP_COLORS;
  const traces = [{ type: "bar", x: summ.map(r => r.g), y: summ.map(r => r.mean), marker: { color: summ.map((_, i) => hexToRgba(pal[i % pal.length], 0.55)), line: { color: summ.map((_, i) => pal[i % pal.length]), width: 1.5 } },
    error_y: { type: "data", array: summ.map(r => errKind === "sem" ? r.sem : r.sd), visible: true, thickness: 1.5, width: 8, color: "#1e293b" }, name: "Mean", showlegend: false }];
  groups.forEach((g, gi) => {
    const pts = vals.filter(o => o.s.group === g && Number.isFinite(o.v));
    traces.push({ type: "box", x: pts.map(() => g), y: pts.map(o => o.v), boxpoints: "all", jitter: 0.5, pointpos: 0, fillcolor: "rgba(0,0,0,0)", line: { width: 0 }, marker: { color: "#0f172a", size: 6, opacity: 0.8 }, hoveron: "points", text: pts.map(o => o.s.label), hovertemplate: "%{text}: %{y}<extra></extra>", showlegend: false, name: g });
  });
  rtPlot("rtPlot", traces, { title: { text: what, font: { size: 15 } }, xaxis: rtAxis("Group"), yaxis: rtAxis(rb ? "Ratio" : (metric === "area" ? "Band area" : "Band height")), bargap: 0.45 });
}


/* ───────────────────────── PCA ───────────────────────── */

let lastPCA = null;

function runRamanPCA() {
  rxTrack("raman-pca");
  const list = rtProcessedSpectra();
  if (list.length < 3) { alert("PCA needs at least 3 spectra."); return; }
  let lo = rtNum("rtPcaLo", -Infinity), hi = rtNum("rtPcaHi", Infinity); if (lo > hi) [lo, hi] = [hi, lo];
  lo = Math.max(lo, ...list.map(s => Math.min(...s.x))); hi = Math.min(hi, ...list.map(s => Math.max(...s.x)));
  const ord = list[0].x.map((_, i) => i).sort((a, b) => list[0].x[a] - list[0].x[b]);
  const grid = ord.map(i => list[0].x[i]).filter(v => v >= lo && v <= hi);
  if (grid.length < 5) { alert("The spectra share too little of the chosen region for PCA."); return; }
  const X = list.map(s => { const o = s.x.map((_, i) => i).sort((a, b) => s.x[a] - s.x[b]); const xs = o.map(i => s.x[i]), ys = o.map(i => s.y[i]); return grid.map(g => interpolate(xs, ys, g)); });
  const nComp = Math.max(2, Math.min(10, rtNum("rtPcaN", 3) | 0));
  const res = pca(X, nComp, document.getElementById("rtPcaScale").value);
  if (res.explained.length < 2) { alert("The spectra are identical (no variance to analyse)."); return; }
  lastPCA = { list, grid, res };
  const sel = (id, d) => { const el = document.getElementById(id); const prev = parseInt(el.value) || d; el.innerHTML = res.explained.map((e, i) => `<option value="${i + 1}">PC${i + 1} (${(100 * e).toFixed(1)} %)</option>`).join(""); el.value = String(Math.min(prev, res.explained.length)); };
  sel("rtPcaX", 1); sel("rtPcaY", 2);
  if (document.getElementById("rtPcaX").value === document.getElementById("rtPcaY").value) document.getElementById("rtPcaY").value = "2";
  renderRamanPCA();
}

function renderRamanPCA() {
  const P = lastPCA; if (!P) return;
  const { list, grid, res } = P;
  const a = (parseInt(document.getElementById("rtPcaX").value) || 1) - 1, b = (parseInt(document.getElementById("rtPcaY").value) || 2) - 1;
  const ell = document.getElementById("rtPcaEllipse").checked;
  rtShowSection(`PCA — ${list.length} spectra, ${grid.length} points (${grid[0].toFixed(0)}–${grid[grid.length - 1].toFixed(0)})`);
  const groups = [...new Set(list.map(s => s.group))];
  const traces = [];
  groups.forEach((g, gi) => {
    const idx = list.map((s, i) => s.group === g ? i : -1).filter(i => i >= 0);
    const col = GROUP_COLORS[gi % GROUP_COLORS.length];
    traces.push({ x: idx.map(i => res.scores[i][a]), y: idx.map(i => res.scores[i][b]), mode: "markers", name: `${g} (n=${idx.length})`, marker: { size: 10, color: col, symbol: ["circle", "square", "diamond", "triangle-up", "cross", "x"][gi % 6], line: { width: 1, color: "#fff" } },
      text: idx.map(i => list[i].label), hovertemplate: "%{text}<br>PC" + (a + 1) + " %{x:.4g}<br>PC" + (b + 1) + " %{y:.4g}<extra></extra>" });
    if (ell) { const e = confidenceEllipse(idx.map(i => res.scores[i][a]), idx.map(i => res.scores[i][b])); if (e) traces.push({ x: e.x, y: e.y, mode: "lines", line: { color: col, width: 1.5, dash: "dash" }, fill: "toself", fillcolor: hexToRgba(col, 0.08), hoverinfo: "skip", showlegend: false }); }
  });
  const pct = i => (100 * res.explained[i]).toFixed(1);
  rtPlot("rtPlot", traces, { title: { text: "PCA scores", font: { size: 15 } }, height: 480,
    xaxis: rtAxis(`PC${a + 1} (${pct(a)} %)`, { zeroline: true, zerolinecolor: "#cbd5e1" }), yaxis: rtAxis(`PC${b + 1} (${pct(b)} %)`, { zeroline: true, zerolinecolor: "#cbd5e1" }) });
  rtPlot("rtPlot2", [a, b].map((c, k) => ({ x: grid, y: res.loadings[c], mode: "lines", name: `PC${c + 1} loading`, line: { width: 1.8, color: k ? "#d62728" : "#1f77b4" } })),
    { title: { text: "Loadings (which bands drive each component)", font: { size: 15 } }, height: 380, xaxis: rtAxis(rtXLabel()), yaxis: rtAxis("Loading", { zeroline: true, zerolinecolor: "#94a3b8" }) });
  document.getElementById("rtDlLoadings").style.display = "";
  let cum = 0;
  document.getElementById("rtBody").innerHTML = `<div style="overflow-x:auto"><table class="peak-table"><thead><tr><th>Component</th>${res.explained.map((_, i) => `<th>PC${i + 1}</th>`).join("")}</tr></thead><tbody>
    <tr><td>Explained variance</td>${res.explained.map(e => `<td>${(100 * e).toFixed(2)} %</td>`).join("")}</tr>
    <tr><td>Cumulative</td>${res.explained.map(e => { cum += e; return `<td>${(100 * cum).toFixed(2)} %</td>`; }).join("")}</tr></tbody></table></div>
    <div style="font-size:11px;color:var(--hint);margin-top:6px;">Spectra are ${document.getElementById("rtPcaScale").value === "auto" ? "mean-centred and scaled to unit variance at every point" : "mean-centred"} and interpolated onto the first spectrum's points. ${ell ? "Dashed ellipses: 95 % confidence region of each group's scores (needs ≥ 3 spectra per group). " : ""}A positive loading means that band is stronger in spectra with a high score on that component.</div>`;
  let csv = "spectrum,group," + res.explained.map((_, i) => `PC${i + 1}`).join(",") + "\n";
  list.forEach((s, i) => { csv += [csvq(s.label), csvq(s.group)].concat(res.scores[i]).join(",") + "\n"; });
  csv += "\nexplained_variance,," + res.explained.join(",") + "\n\nx," + res.loadings.map((_, i) => `PC${i + 1}_loading`).join(",") + "\n";
  grid.forEach((g, j) => { csv += [g].concat(res.loadings.map(L => L[j])).join(",") + "\n"; });
  lastRamanTool = { kind: "PCA", csv,
    methods: `Principal component analysis was performed on ${list.length} ${document.getElementById("rtPcaScale").value === "auto" ? "autoscaled" : "mean-centred"} spectra (${grid[0].toFixed(0)}–${grid[grid.length - 1].toFixed(0)} cm⁻¹); PC${a + 1} and PC${b + 1} explain ${pct(a)} % and ${pct(b)} % of the variance${ell ? ", and 95 % confidence ellipses are drawn for each group" : ""}.` };
}


/* ───────────────────────── DIFFERENCE SPECTRUM ───────────────────────── */

function runDifferenceSpectrum() {
  rxTrack("raman-difference-spectrum");
  refreshRamanToolTargets();
  const A = rtResolveSpectrum(document.getElementById("rtDiffA").value), B = rtResolveSpectrum(document.getElementById("rtDiffB").value);
  if (!A || !B) { alert("Choose the two spectra or groups to compare."); return; }
  const errKind = document.getElementById("rtDiffErr").value, showMeans = document.getElementById("rtDiffShowMeans").checked;
  const lo = Math.max(Math.min(...A.x), Math.min(...B.x)), hi = Math.min(Math.max(...A.x), Math.max(...B.x));
  const ordB = B.x.map((_, i) => i).sort((a, b) => B.x[a] - B.x[b]);
  const bx = ordB.map(i => B.x[i]), by = ordB.map(i => B.y[i]);
  const be = B[errKind] ? ordB.map(i => B[errKind][i]) : null;
  const pts = A.x.map((x, i) => ({ x, i })).filter(o => o.x >= lo && o.x <= hi).sort((p, q) => p.x - q.x);
  const x = pts.map(o => o.x), yA = pts.map(o => A.y[o.i]), yB = x.map(v => interpolate(bx, by, v));
  const d = yA.map((v, i) => v - yB[i]);
  const eA = A[errKind] ? pts.map(o => A[errKind][o.i]) : null, eB = be ? x.map(v => interpolate(bx, be, v)) : null;
  // uncertainty of a difference of two independent means: add in quadrature
  const err = (eA || eB) ? x.map((_, i) => Math.sqrt((eA ? eA[i] ** 2 : 0) + (eB ? eB[i] ** 2 : 0))) : null;
  rtShowSection(`Difference spectrum — ${A.label} − ${B.label}`);
  const traces = [];
  if (err) traces.push(buildErrorBandTrace(x, d, err, "#7c3aed", 0.22, "±"));
  traces.push({ x, y: d, mode: "lines", name: `${A.label} − ${B.label}`, line: { color: "#7c3aed", width: 1.8 } });
  if (showMeans) {
    traces.push({ x, y: yA, mode: "lines", name: A.label, line: { color: "#1f77b4", width: 1.2 }, yaxis: "y2" });
    traces.push({ x, y: yB, mode: "lines", name: B.label, line: { color: "#d62728", width: 1.2 }, yaxis: "y2" });
  }
  const layout = { title: { text: `${A.label} − ${B.label}`, font: { size: 15 } }, height: showMeans ? 560 : 440,
    xaxis: rtAxis(rtXLabel(), showMeans ? { anchor: "y" } : {}),
    yaxis: rtAxis(`Difference${err ? ` (band: ± ${errKind === "sem" ? "SEM" : "SD"})` : ""}`, Object.assign({ zeroline: true, zerolinecolor: "#64748b", zerolinewidth: 1 }, showMeans ? { domain: [0, 0.48] } : {})) };
  if (showMeans) layout.yaxis2 = rtAxis(rtYLabel(), { domain: [0.55, 1], anchor: "x" });
  rtPlot("rtPlot", traces, layout);
  // the strongest positive and negative differences
  // local extremes at least 10 % of the largest |difference|, one per 15 X units
  const ix = d.map((_, i) => i), dMax = Math.max(...d.map(Math.abs)) || 1;
  const top = (sgn) => {
    const cand = ix.filter(i => sgn * d[i] >= 0.1 * dMax && (i === 0 || sgn * d[i] >= sgn * d[i - 1]) && (i === d.length - 1 || sgn * d[i] >= sgn * d[i + 1])).sort((p, q) => sgn * (d[q] - d[p]));
    const out = [];
    for (const i of cand) { if (out.every(j => Math.abs(x[j] - x[i]) > 15)) out.push(i); if (out.length >= 6) break; }
    return out;
  };
  const fmtList = (sgn) => top(sgn).map(i => `${x[i].toFixed(0)}${err && Math.abs(d[i]) > 2 * err[i] ? "*" : ""}`).join(", ") || "—";
  document.getElementById("rtBody").innerHTML = `<div class="fit-result" style="font-size:13px">Stronger in <b>${rtEsc(A.label)}</b>: ${fmtList(1)}<br>Stronger in <b>${rtEsc(B.label)}</b>: ${fmtList(-1)}</div>
    <div style="font-size:11px;color:var(--hint);margin-top:6px;">${err ? `Band: ± ${errKind === "sem" ? "SEM" : "SD"} of the difference (the two spreads added in quadrature). * marks positions where the difference exceeds twice that band.` : "A single spectrum has no spread, so no band is drawn."} B is interpolated onto A's points.</div>`;
  let csv = `x,${csvq(A.label)},${csvq(B.label)},difference${err ? ",uncertainty" : ""}\n`;
  x.forEach((v, i) => { csv += [v, yA[i], yB[i], d[i]].concat(err ? [err[i]] : []).join(",") + "\n"; });
  lastRamanTool = { kind: "Difference", csv,
    methods: `A difference spectrum (${A.label} − ${B.label}) was computed${err ? ` with its ± ${errKind === "sem" ? "SEM" : "SD"} uncertainty (combined in quadrature)` : ""}.` };
}
