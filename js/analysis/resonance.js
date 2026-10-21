/* ═══════════════════════════════════════════════════════════
   RESONANCE (DIP / PEAK) TRACKING — XY mode
   For SPR / LSPR and any spectral sensor read out by a resonance position:

   1. In each dataset (every replicate column), find the resonance inside a
      wavelength window, after the same smoothing/normalisation as the plot.
   2. Average the positions over the replicates of each group → mean ± SD/SEM.
      (Locating the dip in every replicate and then averaging is more honest
      than locating the dip of the averaged curve: the scatter of the
      positions is the quantity the error bar should describe.)
   3. Plot position — or shift Δλ from a reference group — against analyte
      concentration, fit a calibration / binding model, report sensitivity
      and limit of detection.
═══════════════════════════════════════════════════════════ */

let lastResonance = null;   // { rows: [...], xLabel, type }

// Locate the resonance of one spectrum. x must be ascending.
//   type:   "dip" (minimum) or "peak" (maximum)
//   method: "parabola" — least-squares parabola through the points within
//                        ±halfWidth of the extreme point; its vertex gives a
//                        sub-pixel position (falls back to the extreme point if
//                        the parabola opens the wrong way or leaves the window)
//           "min"      — the extreme data point itself
//           "centroid" — intensity-weighted centre of the part of the feature
//                        deeper than half its depth within the window
function findResonance(x, y, opts) {
  const sgn = opts.type === "peak" ? -1 : 1;           // work on sgn·y, always a minimum
  const idx = [];
  for (let i = 0; i < x.length; i++) if (x[i] >= opts.lo && x[i] <= opts.hi && Number.isFinite(y[i])) idx.push(i);
  if (idx.length < 3) return null;
  let iMin = idx[0];
  idx.forEach(i => { if (sgn * y[i] < sgn * y[iMin]) iMin = i; });
  const atEdge = iMin === idx[0] || iMin === idx[idx.length - 1];
  const extreme = { pos: x[iMin], value: y[iMin], atEdge };
  if (opts.method === "min") return extreme;

  if (opts.method === "centroid") {
    let top = -Infinity; idx.forEach(i => { if (sgn * y[i] > top) top = sgn * y[i]; });
    const bottom = sgn * y[iMin], thr = bottom + 0.5 * (top - bottom);
    // walk out from the minimum while the signal stays below half depth
    let a = iMin, b = iMin;
    while (a - 1 >= idx[0] && sgn * y[a - 1] <= thr) a--;
    while (b + 1 <= idx[idx.length - 1] && sgn * y[b + 1] <= thr) b++;
    let sw = 0, sx = 0;
    for (let i = a; i <= b; i++) { const wgt = thr - sgn * y[i]; sw += wgt; sx += wgt * x[i]; }
    return sw > 0 ? { pos: sx / sw, value: y[iMin], atEdge } : extreme;
  }

  // parabola
  const hw = opts.halfWidth > 0 ? opts.halfWidth : (x[idx[idx.length - 1]] - x[idx[0]]) / 10;
  const near = idx.filter(i => Math.abs(x[i] - x[iMin]) <= hw);
  if (near.length < 3) return extreme;
  const x0 = x[iMin];
  const c = polyFitCoeffs(near.map(i => x[i] - x0), near.map(i => y[i]), 2);
  if (!c || !c.every(Number.isFinite) || sgn * c[2] <= 0) return extreme;
  const v = -c[1] / (2 * c[2]) + x0;
  if (v < x[near[0]] || v > x[near[near.length - 1]]) return extreme;
  const dv = v - x0;
  return { pos: v, value: c[0] + c[1] * dv + c[2] * dv * dv, atEdge };
}

// Line shape of a located resonance inside the search window:
//   depth — from the mean level at the two window edges to the extreme value
//   FWHM  — full width where the feature is half as deep (linear interpolation
//           between samples on each side; NaN if it does not close inside the window)
//   Q     — quality factor, position / FWHM
function resonanceShape(x, y, opts, pos, value) {
  const sgn = opts.type === "peak" ? -1 : 1;
  const idx = [];
  for (let i = 0; i < x.length; i++) if (x[i] >= opts.lo && x[i] <= opts.hi && Number.isFinite(y[i])) idx.push(i);
  if (idx.length < 3 || !Number.isFinite(pos)) return { depth: NaN, fwhm: NaN, q: NaN };
  const e = Math.max(1, Math.round(idx.length / 20));
  const edge = (idx.slice(0, e).reduce((a, i) => a + y[i], 0) + idx.slice(-e).reduce((a, i) => a + y[i], 0)) / (2 * e);
  let iMin = idx[0]; idx.forEach(i => { if (sgn * y[i] < sgn * y[iMin]) iMin = i; });
  const extreme = Number.isFinite(value) ? value : y[iMin];
  const depth = sgn * (edge - extreme);
  if (!(depth > 0)) return { depth, fwhm: NaN, q: NaN };
  const half = extreme + sgn * depth / 2;
  const cross = (dir) => {
    for (let i = iMin; i + dir >= idx[0] && i + dir <= idx[idx.length - 1]; i += dir) {
      const j = i + dir;
      if (sgn * y[j] >= sgn * half) return x[i] + (x[j] - x[i]) * (half - y[i]) / ((y[j] - y[i]) || 1e-300);
    }
    return NaN;
  };
  const fwhm = Math.abs(cross(1) - cross(-1));
  return { depth, fwhm, q: Number.isFinite(fwhm) && fwhm > 0 ? Math.abs(pos) / fwhm : NaN };
}

const RES_METRICS = { fwhm: "FWHM", q: "Q factor", depth: "Depth" };

function metricStats(vals) {
  const v = vals.filter(Number.isFinite), n = v.length, mean = n ? v.reduce((a, b) => a + b, 0) / n : NaN;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, q) => a + (q - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, sem: n > 1 ? sd / Math.sqrt(n) : 0 };
}

// "10", "2.5", "0.3125", "10 nM", "1e-3 mg/mL" → number; buffer/blank names → 0;
// anything else → null (left for the user to type)
function concentrationFromName(name) {
  const t = String(name || "").replace(/\s*\(n=\d+\)\s*$/, "").trim();
  if (/^(pbs|blank|buffer|control|baseline|ref(erence)?)$/i.test(t) || /(^|[_\s-])(pbs|blank|buffer)([_\s-]|$)/i.test(t)) return 0;
  const m = t.match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*[a-zA-Zµμ%/]*\s*$/);
  return m ? Number(m[1]) : null;
}

function readResonanceOptions() {
  const num = id => parseFloat(document.getElementById(id)?.value);
  let lo = num("xyDipLo"), hi = num("xyDipHi");
  if (!Number.isFinite(lo)) lo = -Infinity; if (!Number.isFinite(hi)) hi = Infinity;
  if (lo > hi) [lo, hi] = [hi, lo];
  return { lo, hi, type: document.getElementById("xyDipType").value, method: document.getElementById("xyDipMethod").value, halfWidth: num("xyDipHalfWidth") };
}

// Step 1 + 2: positions per replicate, averaged per group
function runResonanceAnalysis() {
  rxTrack('xy-resonance-tracking');
  const raw = gatherXYDatasets().filter(ds => ds.x.length && ds.y.length);
  if (!raw.length) { alert("Load XY data first (and tick the datasets to analyse)."); return; }
  const opts = readResonanceOptions();
  const processed = processXYDatasets(raw);

  const order = [], buckets = {};
  processed.forEach(ds => {
    const key = ds.group || ds.name;
    if (!buckets[key]) { buckets[key] = []; order.push(key); }
    buckets[key].push(ds);
  });

  let edge = 0, failed = 0;
  const prev = lastResonance ? Object.fromEntries(lastResonance.rows.map(r => [r.key, r])) : {};
  const rows = order.map(key => {
    const reps = buckets[key].map(ds => {
      const ix = ds.x.map((_, i) => i).sort((a, b) => ds.x[a] - ds.x[b]);
      const sx = ix.map(i => ds.x[i]), sy = ix.map(i => ds.y[i]);
      const r = findResonance(sx, sy, opts);
      if (!r) failed++; else if (r.atEdge) edge++;
      const shape = r ? resonanceShape(sx, sy, opts, r.pos, r.value) : { depth: NaN, fwhm: NaN, q: NaN };
      return { name: ds.name, pos: r ? r.pos : NaN, fwhm: shape.fwhm, q: shape.q, depth: shape.depth };
    });
    const vals = reps.map(r => r.pos).filter(Number.isFinite);
    const n = vals.length, mean = n ? vals.reduce((a, b) => a + b, 0) / n : NaN;
    const sd = n > 1 ? Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)) : 0;
    // keep a concentration / tick the user already edited for this group
    const keep = prev[key];
    const metrics = {}; Object.keys(RES_METRICS).forEach(m => { metrics[m] = metricStats(reps.map(p => p[m])); });
    return { key, label: key, n, reps, mean, sd, sem: n > 1 ? sd / Math.sqrt(n) : 0, metrics,
             conc: keep ? keep.conc : concentrationFromName(key), use: keep ? keep.use : true };
  });

  // table in order of concentration; rows without one go last, in file order
  rows.sort((a, b) => (a.conc === null) - (b.conc === null) || (a.conc ?? 0) - (b.conc ?? 0));
  lastResonance = { rows, xLabel: document.getElementById("xyXlabel").value || "X", type: opts.type };
  buildResonanceTable();
  renderResonancePlot();
  document.getElementById("xyDipSection").style.display = "block";
  if (window.rxShowResult) rxShowResult("xyDipSection");
  if (failed) rxNotify(`${failed} dataset${failed === 1 ? "" : "s"} had fewer than 3 points inside the search window.`);
  else if (edge) rxNotify(`${edge} resonance${edge === 1 ? " lies" : "s lie"} at the edge of the search window — widen the window if the ${opts.type} is cut off.`);
}

function buildResonanceTable() {
  const R = lastResonance; if (!R) return;
  const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const ref = document.getElementById("xyDipRef");
  const prevRef = ref.value;
  ref.innerHTML = R.rows.map((r, i) => `<option value="${i}">${esc(r.label)}</option>`).join("");
  const zero = R.rows.findIndex(r => r.conc === 0);
  ref.value = prevRef !== "" && prevRef < R.rows.length ? prevRef : String(zero >= 0 ? zero : 0);

  const f = v => Number.isFinite(v) ? (+v.toFixed(3)).toString() : "—";
  document.getElementById("xyDipTableBody").innerHTML = R.rows.map((r, i) => `
    <tr>
      <td><input type="checkbox" ${r.use ? "checked" : ""} onchange="lastResonance.rows[${i}].use=this.checked;renderResonancePlot()"></td>
      <td>${esc(r.label)}</td>
      <td><input type="number" step="any" value="${r.conc ?? ""}" placeholder="enter" style="width:90px"
           onchange="lastResonance.rows[${i}].conc=this.value===''?null:Number(this.value);renderResonancePlot()"></td>
      <td>${r.n}</td>
      <td><b>${f(r.mean)}</b></td>
      <td>${f(r.sd)}</td>
      <td>${f(r.sem)}</td>
      <td>${f(r.metrics.fwhm.mean)}</td>
      <td>${f(r.metrics.q.mean)}</td>
      <td>${f(r.metrics.depth.mean)}</td>
      <td style="font-size:11px;color:var(--muted)">${r.reps.map(p => f(p.pos)).join(", ")}</td>
    </tr>`).join("");
}

// Step 3: calibration plot and fit
function renderResonancePlot() {
  const R = lastResonance; if (!R) return;
  const ySel = document.getElementById("xyDipY").value;
  const metric = RES_METRICS[ySel] ? ySel : null;
  const useShift = ySel === "shift";
  const errKind = document.getElementById("xyDipErr").value;
  const logX = document.getElementById("xyDipLogX").checked;
  const model = document.getElementById("xyDipFit").value;
  const unit = (document.getElementById("xyDipUnit").value || "").trim();
  const refRow = R.rows[parseInt(document.getElementById("xyDipRef").value) || 0];
  const e = r => errKind === "sem" ? r.sem : r.sd;

  const pts = R.rows.filter(r => r.use && r.conc !== null && Number.isFinite(r.conc) && Number.isFinite(metric ? r.metrics[metric].mean : r.mean)).map(r => {
    if (metric) { const m = r.metrics[metric]; return { x: r.conc, y: m.mean, err: errKind === "sem" ? m.sem : m.sd, label: r.label, n: m.n }; }
    let y = r.mean, err = e(r);
    if (useShift) {
      y = r.mean - refRow.mean;
      // the reference's own uncertainty adds in quadrature to every other row
      if (r !== refRow) err = Math.sqrt(err * err + e(refRow) ** 2);
    }
    return { x: r.conc, y, err, label: r.label, n: r.n };
  }).sort((a, b) => a.x - b.x);

  const what = R.type === "peak" ? "Peak" : "Resonance dip";
  const yTitle = metric ? (metric === "q" ? `${what} Q factor (position / FWHM)` : `${what} ${RES_METRICS[metric]}${metric === "fwhm" ? ", " + R.xLabel : ""}`)
    : useShift ? `${what} shift, Δ ${R.xLabel}` : `${what} position, ${R.xLabel}`;
  // unit of the X axis, e.g. "Wavelength [nm]" → "nm"
  const xUnitMatch = R.xLabel.match(/[\[(]([^\])]+)[\])]\s*$/);
  const xUnit = xUnitMatch ? xUnitMatch[1] : "";
  const xTitle = `Concentration${unit ? " (" + unit + ")" : ""}`;
  const shown = logX ? pts.filter(p => p.x > 0) : pts;
  const div = document.getElementById("xyDipPlot");
  const box = document.getElementById("xyDipFitBox");
  const notes = [];
  if (logX && shown.length < pts.length) notes.push(`${pts.length - shown.length} point${pts.length - shown.length === 1 ? "" : "s"} at zero concentration cannot be shown on a log axis (still used in the fit).`);
  const missing = R.rows.filter(r => r.use && (r.conc === null || !Number.isFinite(r.conc))).length;
  if (missing) notes.push(`${missing} group${missing === 1 ? " has" : "s have"} no concentration yet — type it in the table to include ${missing === 1 ? "it" : "them"}.`);

  const traces = [{
    x: shown.map(p => p.x), y: shown.map(p => p.y), mode: "markers", name: metric ? RES_METRICS[metric] : useShift ? "Shift" : "Position",
    marker: { size: 9, color: "#1f77b4" },
    error_y: { type: "data", array: shown.map(p => p.err), visible: true, thickness: 1.5, width: 5, color: "#1f77b4" },
    text: shown.map(p => `${p.label} (n=${p.n})`), hovertemplate: "%{text}<br>%{x}<br>%{y:.3f} ± %{error_y.array:.3f}<extra></extra>"
  }];

  let fitHtml = "";
  lastResonance.fit = null;
  if (model !== "none" && pts.length >= 3) {
    const sig = pts.map(p => p.err);
    const fit = fitModel(pts.map(p => p.x), pts.map(p => p.y), model, 2, sig.every(v => v > 0) ? sig : null);
    if (fit) {
      lastResonance.fit = fit;
      const pos = pts.map(p => p.x).filter(v => v > 0);
      const lo = logX ? Math.min(...pos) : Math.min(...pts.map(p => p.x)), hi = Math.max(...pts.map(p => p.x));
      const fx = []; for (let k = 0; k <= 200; k++) fx.push(logX ? lo * Math.pow(hi / lo, k / 200) : lo + (hi - lo) * k / 200);
      traces.push({ x: fx, y: fx.map(fit.predict).map(v => Number.isFinite(v) ? v : null), mode: "lines", name: `${fit.label} fit (R²=${fit.r2.toFixed(4)})`, line: { color: "#d62728", dash: "dash", width: 2 } });
      const rowsHtml = fit.names.map((nm, j) => `<tr><td>${nm}</td><td>${fmtWithErr(fit.values[j], fit.errors[j])}</td></tr>`).join("")
        + `<tr><td>R² / adjusted R²</td><td>${fit.r2.toFixed(5)} / ${fit.adjR2.toFixed(5)}</td></tr>`
        + (fit.redChi2 != null ? `<tr><td>Reduced χ²</td><td>${fmtNum(fit.redChi2)}</td></tr>` : "")
        + `<tr><td>Points</td><td>${fit.n}${fit.weighted ? " · weighted by 1/σ²" : ""}</td></tr>`;
      let extra = "";
      lastResonance.lod = null; lastResonance.loq = null; lastResonance.lodRes = null; lastResonance.loqRes = null;
      if (model === "linear") {
        const slope = fit.values[1], slopeErr = fit.errors[1];
        const yUnit = metric === "q" || metric === "depth" ? "" : (xUnit || "units");
        extra += `<tr><td>Sensitivity (slope)</td><td><b>${fmtWithErr(slope, slopeErr)}</b> ${yUnit ? yUnit + " " : ""}per ${unit || "unit concentration"}</td></tr>`;
        // LOD = 3·SD(blank)/|slope|, LOQ = 10·SD(blank)/|slope| from the
        // replicates of the reference group (of the quantity being plotted)
        const blank = refRow;
        const bSd = blank ? (metric ? blank.metrics[metric].sd : blank.sd) : NaN, bN = blank ? (metric ? blank.metrics[metric].n : blank.n) : 0;
        if (blank && bN >= 2 && slope) {
          const lod = 3 * bSd / Math.abs(slope), loq = 10 * bSd / Math.abs(slope);
          const who = `SD(${blank.label.replace(/</g, "&lt;")}, n=${bN})`;
          extra += `<tr><td>Limit of detection (3σ)</td><td><b>${fmtNum(lod)}</b> ${unit} &nbsp;<span style="color:var(--muted);font-size:11px">= 3 × ${who} / |slope|</span></td></tr>`;
          extra += `<tr><td>Limit of quantification (10σ)</td><td><b>${fmtNum(loq)}</b> ${unit} &nbsp;<span style="color:var(--muted);font-size:11px">= 10 × ${who} / |slope|</span></td></tr>`;
          lastResonance.lod = lod; lastResonance.loq = loq;
        } else {
          extra += `<tr><td>Limit of detection</td><td style="color:var(--muted)">needs ≥ 2 replicates in the reference (blank) group</td></tr>`;
        }
        // ICH Q2 alternative from the scatter of the calibration about the line
        if (fit.n > 2 && slope) {
          const sRes = Math.sqrt(fit.ssRes / (fit.n - 2));
          lastResonance.lodRes = 3.3 * sRes / Math.abs(slope); lastResonance.loqRes = 10 * sRes / Math.abs(slope);
          extra += `<tr><td>LOD / LOQ from calibration residuals</td><td>${fmtNum(lastResonance.lodRes)} / ${fmtNum(lastResonance.loqRes)} ${unit} &nbsp;<span style="color:var(--muted);font-size:11px">= 3.3 / 10 × s<sub>y/x</sub> / |slope| (ICH Q2), s<sub>y/x</sub> = ${fmtNum(sRes)}</span></td></tr>`;
        }
      }
      if (model === "langmuir" || model === "hill") extra += `<tr><td>Apparent K<sub>D</sub></td><td><b>${fmtWithErr(fit.values[2], fit.errors[2])}</b> ${unit}</td></tr>`;
      fitHtml = `<div class="fit-result"><b>${fit.label} fit</b><div style="font-size:13px;color:#475569;margin-top:4px;">${fit.eqText}</div><table>${extra}${rowsHtml}</table><div style="font-size:11px;color:var(--hint,#64748b);margin-top:4px;">± values are 1σ standard errors. Error bars: ${errKind === "sem" ? "SEM" : "SD"} of the replicate positions.</div></div>`;
    } else {
      fitHtml = `<div class="fit-result" style="color:var(--danger,#dc2626)">The ${model} model could not be fitted to these points (too few points, or a log/Langmuir model with concentrations ≤ 0).</div>`;
    }
  } else if (model !== "none") {
    notes.push("At least 3 concentrations are needed for a fit.");
  }
  box.innerHTML = fitHtml + (notes.length ? `<div style="font-size:12px;color:var(--muted);margin-top:8px;">${notes.join("<br>")}</div>` : "");

  const tick = { size: 13 };
  Plotly.newPlot(div, traces, {
    title: { text: metric ? `Resonance ${RES_METRICS[metric]} vs concentration` : useShift ? "Resonance shift vs concentration" : "Resonance position vs concentration", font: { size: 17 } },
    // on a log axis, label the measured concentrations themselves (Plotly's
    // default log ticks print 0.3 as a bare "3")
    xaxis: Object.assign({ title: { text: xTitle }, type: logX ? "log" : "linear", tickfont: tick, showline: true, mirror: true, ticks: "outside", zeroline: false },
      logX ? { tickvals: shown.map(p => p.x), ticktext: shown.map(p => String(+p.x.toPrecision(4))) } : {}),
    yaxis: { title: { text: yTitle }, tickfont: tick, showline: true, mirror: true, ticks: "outside", zeroline: false },
    plot_bgcolor: "white", paper_bgcolor: "white", margin: { l: 80, r: 30, t: 50, b: 70 }, height: 460,
    legend: { x: 0.02, y: 0.98, bgcolor: "rgba(255,255,255,0.85)", bordercolor: "#94a3b8", borderwidth: 1 }
  }, { displaylogo: false, responsive: true, edits: { titleText: true, axisTitleText: true, legendPosition: true } });
}

function downloadResonanceCSV() {
  const R = lastResonance; if (!R) { alert("Run the resonance analysis first."); return; }
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const refRow = R.rows[parseInt(document.getElementById("xyDipRef").value) || 0];
  let csv = "group,concentration,n,mean_position,sd,sem,shift_from_reference,replicate_positions,fwhm_mean,fwhm_sd,q_mean,q_sd,depth_mean,depth_sd\n";
  R.rows.forEach(r => {
    const m = r.metrics || {}, g = (k, f) => m[k] ? m[k][f] : "";
    csv += [q(r.label), r.conc ?? "", r.n, r.mean, r.sd, r.sem, r.mean - refRow.mean, q(r.reps.map(p => p.pos).join(";")),
      g("fwhm", "mean"), g("fwhm", "sd"), g("q", "mean"), g("q", "sd"), g("depth", "mean"), g("depth", "sd")].join(",") + "\n";
  });
  if (R.fit) {
    csv += `\nfit model,${q(R.fit.label)}\n`;
    R.fit.names.forEach((nm, j) => { csv += `${q(nm)},${R.fit.values[j]},±,${Number.isFinite(R.fit.errors[j]) ? R.fit.errors[j] : ""}\n`; });
    csv += `R2,${R.fit.r2}\n`;
    if (R.lod != null && R.fit.model === "linear") csv += `LOD (3 SD blank / slope),${R.lod}\nLOQ (10 SD blank / slope),${R.loq}\n`;
    if (R.lodRes != null && R.fit.model === "linear") csv += `LOD (3.3 s_y/x / slope),${R.lodRes}\nLOQ (10 s_y/x / slope),${R.loqRes}\n`;
    csv += `plotted quantity,${q(document.getElementById("xyDipY").selectedOptions[0]?.text || "")}\n`;
  }
  downloadBlob(csv, "RNSpectraX_Resonance.csv", "text/csv");
}

function downloadResonancePlot() {
  const div = document.getElementById("xyDipPlot");
  if (!div || !div.data) { alert("Run the resonance analysis first."); return; }
  Plotly.downloadImage(div, { format: "png", scale: 3, filename: "RNSpectraX_Resonance" });
}
