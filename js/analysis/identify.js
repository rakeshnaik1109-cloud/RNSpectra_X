/* ═══════════════════════════════════════════════════════════
   IDENTIFY — reference-library match (Raman mode)

   Compares a processed spectrum with the reference spectra of an open
   library and ranks the most similar substances. Every match is reported
   with the library citation and the publication its reference spectrum
   came from.

   Library: RamanBiolib (Terán et al., Chemometr. Intell. Lab. Syst. 264,
   105476, 2025), Open Database License — data/ramanbiolib.js, see
   data/README.md. It is loaded only when an identification is first run.

   Scores (all on 0–100):
   • Correlation HQI — 100·r², r = Pearson correlation of the two spectra over
     their common range (negative r counts as 0). The usual "hit quality
     index" of commercial library search.
   • Derivative HQI — the same on first derivatives, which discounts any
     residual broad background and weights band shape and position.
   • Peak match — detected bands of the query vs the band list of each
     reference, matched within ± tolerance: 100·matched / (Nquery + Nref − matched).
═══════════════════════════════════════════════════════════ */

let refLibrary = null;     // { meta, grid: Float64Array, entries: [{..., y: Float32Array}] }
let lastIdentify = null;   // { query: {x, y}, results: [...], lo, hi, method }

function loadReferenceLibrary() {
  if (refLibrary) return Promise.resolve(refLibrary);
  const prepare = () => {
    const L = window.RNSPX_LIBRARY_RAMANBIOLIB;
    const g = L.grid, n = Math.round((g.stop - g.start) / g.step) + 1;
    const grid = new Float64Array(n); for (let i = 0; i < n; i++) grid[i] = g.start + i * g.step;
    const s = L.yScale || 1;
    refLibrary = { meta: L, grid, entries: L.entries.map(e => ({ ...e, y: Float32Array.from(e.y, v => v / s) })) };
    return refLibrary;
  };
  if (window.RNSPX_LIBRARY_RAMANBIOLIB) return Promise.resolve(prepare());
  // the single-file build carries the library inline as JSON
  const inline = document.getElementById("rnspxLibraryData");
  if (inline) { window.RNSPX_LIBRARY_RAMANBIOLIB = JSON.parse(inline.textContent); return Promise.resolve(prepare()); }
  return new Promise((resolve, reject) => {
    const sc = document.createElement("script");
    // same cache-busting stamp as the page's own scripts
    const v = (document.querySelector('script[src*="identify.js?v="]')?.getAttribute("src") || "").split("?v=")[1];
    sc.src = "data/ramanbiolib.js" + (v ? "?v=" + v : "");
    sc.onload = () => window.RNSPX_LIBRARY_RAMANBIOLIB ? resolve(prepare()) : reject(new Error("Reference library did not load"));
    sc.onerror = () => reject(new Error("Could not load the reference library (data/ramanbiolib.js)"));
    document.head.appendChild(sc);
  });
}

// Fill the "spectrum to identify" list: every loaded file, every group
// average (when groups are used) and the grand average.
function refreshIdentifyTargets() {
  const sel = document.getElementById("idTarget"); if (!sel) return;
  const prev = sel.value;
  const active = spectra.filter(s => s != null);
  const opts = active.map(s => [`file:${s.gIdx}`, document.getElementById("label" + s.gIdx)?.value || oceanFileNames[s.gIdx] || `File ${s.gIdx + 1}`]);
  const groups = {};
  active.forEach(s => { const g = (document.getElementById("group" + s.gIdx)?.value || "Group 1").trim() || "Group 1"; (groups[g] = groups[g] || []).push(s); });
  const gNames = Object.keys(groups);
  if (gNames.length > 1 || (gNames.length === 1 && groups[gNames[0]].length > 1)) gNames.forEach(g => opts.push([`group:${g}`, `Group average — ${g} (n=${groups[g].length})`]));
  if (active.length > 1) opts.push(["grand", `Grand average (n=${active.length})`]);
  const esc = v => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  sel.innerHTML = opts.length ? opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("") : `<option value="">Load spectra first</option>`;
  if (opts.some(o => o[0] === prev)) sel.value = prev;
}

// The processed spectrum (despiked, baseline-corrected, smoothed, normalised
// exactly as in the plot) chosen in the Identify panel.
function getIdentifyQuery() {
  const v = document.getElementById("idTarget").value;
  const active = spectra.filter(s => s != null);
  if (!v || !active.length) return null;
  if (v.startsWith("file:")) {
    const s = active.find(sp => String(sp.gIdx) === v.slice(5)); if (!s) return null;
    const p = processSpec(s, { skipDerivative: true });
    return { x: p.xx, y: p.yy, label: document.getElementById("label" + s.gIdx)?.value || "spectrum" };
  }
  let members = active, label = "Grand average";
  if (v.startsWith("group:")) {
    const g = v.slice(6); label = `Group average — ${g}`;
    members = active.filter(s => ((document.getElementById("group" + s.gIdx)?.value || "Group 1").trim() || "Group 1") === g);
  }
  const agg = averageSpecs(members, { skipDerivative: true }); if (!agg) return null;
  return { x: agg.x, y: agg.mean, label };
}

function minMax(a) {
  let lo = Infinity, hi = -Infinity; for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const d = hi - lo || 1; return Array.from(a, v => (v - lo) / d);
}
function pearson(a, b) {
  const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}
// first derivative by a 5-point central difference (1 cm⁻¹ grid)
function deriv5(a) {
  const n = a.length, d = new Array(n).fill(0);
  for (let i = 2; i < n - 2; i++) d[i] = (-a[i + 2] + 8 * a[i + 1] - 8 * a[i - 1] + a[i - 2]) / 12;
  return d.slice(2, n - 2);
}

async function runIdentify() {
  rxTrack('raman-identify');
  const status = document.getElementById("idStatus");
  const q = getIdentifyQuery();
  if (!q || q.x.length < 10) { alert("Load Raman spectra first, then choose which spectrum to identify."); return; }
  status.textContent = "Loading reference library…";
  let lib;
  try { lib = await loadReferenceLibrary(); } catch (e) { status.textContent = ""; alert(e.message); return; }

  const method = document.getElementById("idMethod").value;
  const cls = document.getElementById("idClass").value;
  const topN = Math.max(1, parseInt(document.getElementById("idTopN").value) || 10);
  const tol = Math.max(0.5, parseFloat(document.getElementById("idTol").value) || 8);
  const uniqueOnly = document.getElementById("idUnique").checked;

  // query on the library grid over the common range
  const ix = q.x.map((_, i) => i).sort((a, b) => q.x[a] - q.x[b]);
  const qx = ix.map(i => q.x[i]), qy = ix.map(i => q.y[i]);
  const lo = Math.max(lib.grid[0], qx[0]), hi = Math.min(lib.grid[lib.grid.length - 1], qx[qx.length - 1]);
  if (hi - lo < 200) { status.textContent = ""; alert(`The spectrum and the library (${lib.grid[0]}–${lib.grid[lib.grid.length - 1]} cm⁻¹) overlap over less than 200 cm⁻¹ — widen X Min / X Max.`); return; }
  const i0 = Math.ceil(lo - lib.grid[0]), i1 = Math.floor(hi - lib.grid[0]);
  const gx = Array.from(lib.grid.slice(i0, i1 + 1));
  let qv = gx.map(x => interpolate(qx, qy, x));
  if (document.getElementById("idBaseline").checked) {
    const b = rubberbandBaseline(gx, qv); qv = qv.map((v, i) => v - b[i]);
  }
  qv = minMax(qv);
  const qd = method === "deriv" ? deriv5(qv) : null;
  const qPeaks = method === "peaks" ? runPeakDetectionAlgorithm(gx, qv).map(i => gx[i]) : null;

  let results = lib.entries
    .filter(e => cls === "all" || e.type.split("/")[0] === cls)
    .map(e => {
      const ly = minMax(e.y.slice(i0, i1 + 1));
      let score;
      if (method === "deriv") { const r = pearson(qd, deriv5(ly)); score = 100 * Math.max(r, 0) ** 2; }
      else if (method === "peaks") {
        const lp = (e.peaks || []).filter(p => p >= lo && p <= hi);
        const used = new Set(); let m = 0;
        qPeaks.forEach(p => { let best = -1, bd = Infinity; lp.forEach((r, k) => { const d = Math.abs(r - p); if (d <= tol && d < bd && !used.has(k)) { bd = d; best = k; } }); if (best >= 0) { used.add(best); m++; } });
        const denom = qPeaks.length + lp.length - m;
        score = denom ? 100 * m / denom : 0;
      } else { const r = pearson(qv, ly); score = 100 * Math.max(r, 0) ** 2; }
      return { e, score, ly };
    })
    .sort((a, b) => b.score - a.score);
  if (uniqueOnly) { const seen = new Set(); results = results.filter(r => !seen.has(r.e.name) && seen.add(r.e.name)); }
  results = results.slice(0, topN);

  lastIdentify = { query: { x: gx, y: qv, label: q.label }, results, lo, hi, method, cls };
  status.textContent = "";
  renderIdentifyResults(0);
}

function identifyCitation(e) {
  const refs = refLibrary.meta.references || {};
  const formatted = refs[e.doi];
  return { text: formatted || "", doi: e.doi };
}

// Score thresholds differ by method: derivative correlations are lower for
// the same agreement because differentiation amplifies noise. A top hit that
// also leads the runner-up by ≥ 15 points is reported as a clear lead.
const ID_THRESHOLDS = { hqi: [90, 75], deriv: [55, 30], peaks: [60, 35] };
function matchQualityLabel(score, method, lead) {
  const [strong, possible] = ID_THRESHOLDS[method] || ID_THRESHOLDS.hqi;
  if (score >= strong || (lead >= 15 && score >= possible)) return [lead >= 15 ? "Strong · clear lead" : "Strong", "var(--success,#16a34a)"];
  if (score >= possible) return ["Possible", "#b45309"];
  return ["Weak", "var(--danger,#dc2626)"];
}

function renderIdentifyResults(sel) {
  const R = lastIdentify; if (!R) return;
  const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const methodName = { hqi: "Correlation HQI", deriv: "Derivative HQI", peaks: "Peak match" }[R.method];
  document.getElementById("idSection").style.display = "block";
  document.getElementById("idSummary").innerHTML =
    `<b>${esc(R.query.label)}</b> compared over ${Math.round(R.lo)}–${Math.round(R.hi)} cm⁻¹ with ${refLibrary.entries.length} reference spectra` +
    (R.cls !== "all" ? ` (class: ${esc(R.cls)})` : "") + ` · score: ${methodName}`;

  document.getElementById("idTableBody").innerHTML = R.results.map((r, k) => {
    const lead = k === 0 && R.results[1] ? r.score - R.results[1].score : 0;
    const c = identifyCitation(r.e), [q, col] = matchQualityLabel(r.score, R.method, lead);
    return `<tr class="${k === sel ? "id-row-active" : ""}" style="cursor:pointer;${k === sel ? "background:var(--accent-soft,#f3f0ff);" : ""}" onclick="renderIdentifyResults(${k})">
      <td>${k + 1}</td>
      <td><b>${esc(r.e.name)}</b><div style="font-size:11px;color:var(--muted)">${esc(r.e.type.replace(/\//g, " › "))}</div></td>
      <td><b>${r.score.toFixed(1)}</b> <span style="font-weight:600;color:${col};font-size:11px">${q}</span></td>
      <td style="font-size:12px">${esc(r.e.technique)} Raman${r.e.laser ? ", " + esc(r.e.laser) + " nm" : ""}</td>
      <td style="font-size:11px;line-height:1.45">${c.text ? esc(c.text) + "<br>" : ""}<a href="${esc(c.doi)}" target="_blank" rel="noopener noreferrer">${esc(c.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "doi:"))}</a></td>
    </tr>`;
  }).join("") || `<tr><td colspan="5" style="text-align:center;color:var(--muted)">No reference spectra in this class.</td></tr>`;

  const best = R.results[sel]; if (!best) return;
  const c = identifyCitation(best.e);
  document.getElementById("idCitation").innerHTML =
    `<b>Selected match:</b> ${esc(best.e.name)} — score ${best.score.toFixed(1)} (${methodName}).<br>` +
    `<b>Reference spectrum source:</b> ${c.text ? esc(c.text) + " " : ""}<a href="${esc(c.doi)}" target="_blank" rel="noopener noreferrer">${esc(c.doi)}</a> ` +
    `(${esc(best.e.origin)} from the published figure${best.e.sample ? "; sample: " + esc(best.e.sample) : ""}).<br>` +
    `<b>Reference library:</b> ${esc(refLibrary.meta.citation)} <a href="${esc(refLibrary.meta.doi)}" target="_blank" rel="noopener noreferrer">${esc(refLibrary.meta.doi)}</a> — ${esc(refLibrary.meta.license)}.`;

  const off = 1.15;
  Plotly.newPlot("idPlot", [
    { x: R.query.x, y: R.query.y.map(v => v + off), mode: "lines", name: R.query.label, line: { color: "#1f77b4", width: 1.6 } },
    { x: R.query.x, y: best.ly, mode: "lines", name: `${best.e.name} (reference)`, line: { color: "#d62728", width: 1.6 } }
  ], {
    title: { text: `Query vs ${best.e.name}`, font: { size: 15 } },
    xaxis: { title: { text: "Raman shift (cm⁻¹)" }, showline: true, mirror: true, ticks: "outside", zeroline: false },
    yaxis: { title: { text: "Normalised intensity (offset)" }, showticklabels: false, showline: true, mirror: true, zeroline: false },
    plot_bgcolor: "white", paper_bgcolor: "white", margin: { l: 50, r: 20, t: 46, b: 56 }, height: 380,
    legend: { orientation: "h", x: 0, y: -0.22 }
  }, { displaylogo: false, responsive: true });
}

function downloadIdentifyCSV() {
  const R = lastIdentify; if (!R) { alert("Run an identification first."); return; }
  const q = s => `"${String(s ?? "").replace(/"/g, '""')}"`;
  let csv = `# Query: ${R.query.label}; range ${Math.round(R.lo)}-${Math.round(R.hi)} cm-1; method ${R.method}\n`;
  csv += `# Reference library: ${refLibrary.meta.citation} ${refLibrary.meta.doi} (${refLibrary.meta.license})\n`;
  csv += "rank,component,class,score,technique,laser_nm,source_reference,source_doi\n";
  R.results.forEach((r, k) => { const c = identifyCitation(r.e); csv += [k + 1, q(r.e.name), q(r.e.type), r.score.toFixed(2), q(r.e.technique), r.e.laser, q(c.text), q(c.doi)].join(",") + "\n"; });
  downloadBlob(csv, "RNSpectraX_Identification.csv", "text/csv");
}
