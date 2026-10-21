/* ═══════════════════════════════════════════════════════════
   RAMAN PROCESSING EXTRAS
   • Shift calibration — a constant offset added to every Raman shift, set
     by hand or measured from a reference band (silicon 520.7 cm⁻¹).
   • Excluded regions — X ranges removed before any processing (substrate
     bands, notch-filter edge, a detector artefact).
   • Derivative spectra — Savitzky–Golay 1st or 2nd derivative, the last
     step of the pipeline; it separates overlapping bands and shoulders.
   With the defaults (0 shift, no regions, no derivative) the pipeline is
   exactly the one without these steps.
═══════════════════════════════════════════════════════════ */

function getShiftCorrection() {
  const v = parseFloat(document.getElementById("rsShift")?.value);
  return Number.isFinite(v) ? v : 0;
}

// "1540-1560; 2330 2340, 100–150" → [[1540,1560],[2330,2340],[100,150]]
function parseRanges(s) {
  const nums = String(s || "").replace(/(\d)\s*[-–—]\s*(?=\d)/g, "$1 ").split(/[,;\s]+/).filter(t => t !== "").map(Number).filter(Number.isFinite);
  const out = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([Math.min(nums[i], nums[i + 1]), Math.max(nums[i], nums[i + 1])]);
  return out;
}

function getExcludedRanges() { return parseRanges(document.getElementById("rsExclude")?.value); }

function isExcluded(x, ranges) {
  for (const [a, b] of ranges) if (x >= a && x <= b) return true;
  return false;
}

// Savitzky–Golay derivative: local least-squares polynomial in the true
// offsets x_j − x_i, so the result is in intensity per X unit even when the
// spacing is uneven. order 1 → dy/dx = c₁, order 2 → d²y/dx² = 2c₂.
function sgDerivative(x, y, deriv, window, poly) {
  const n = y.length, hw = Math.max(1, Math.floor((window || 11) / 2));
  const ord = Math.max(deriv, poly || (deriv === 2 ? 3 : 2));
  return y.map((_, i) => {
    const a = Math.max(0, i - hw), b = Math.min(n - 1, i + hw);
    const t = [], yw = [];
    for (let j = a; j <= b; j++) { t.push(x[j] - x[i]); yw.push(y[j]); }
    const o = Math.min(ord, t.length - 1);
    if (o < deriv) return 0;
    const c = polyFitCoeffs(t, yw, o);
    const v = deriv === 1 ? c[1] : 2 * c[2];
    return Number.isFinite(v) ? v : 0;
  });
}

function applyDerivativeStep(xx, yy) {
  const d = parseInt(document.getElementById("rsDeriv")?.value) || 0;
  if (!d || yy.length < 3) return yy;
  return sgDerivative(xx, yy, d, parseInt(document.getElementById("rsDerivWin")?.value) || 11, parseInt(document.getElementById("rsDerivOrder")?.value) || (d === 2 ? 3 : 2));
}

function updateDerivParams() {
  const on = (parseInt(document.getElementById("rsDeriv")?.value) || 0) > 0;
  ["rsDerivWinWrap", "rsDerivOrderWrap"].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = on ? "flex" : "none"; });
}

// Measure the shift offset from a reference spectrum: the band maximum
// within ±window of the reference position, refined by a parabola through
// the top points, compared with its literature value.
function calibrateShiftFromReference() {
  const sel = document.getElementById("rsCalFile");
  const spec = spectra.find(s => s && String(s.gIdx) === sel?.value);
  if (!spec) { alert("Load the reference spectrum (e.g. a silicon wafer) and choose it in the list first."); return; }
  const ref = parseFloat(document.getElementById("rsCalRef").value) || 520.7;
  const win = parseFloat(document.getElementById("rsCalWin").value) || 15;
  const idx = [];
  spec.x.forEach((v, i) => { if (Math.abs(v - ref) <= win) idx.push(i); });
  if (idx.length < 3) { alert(`The reference spectrum has no data within ±${win} of ${ref}.`); return; }
  let top = idx[0]; idx.forEach(i => { if (spec.y[i] > spec.y[top]) top = i; });
  let pos = spec.x[top];
  const near = idx.filter(i => Math.abs(i - top) <= 3);
  if (near.length >= 3) {
    const x0 = spec.x[top], c = polyFitCoeffs(near.map(i => spec.x[i] - x0), near.map(i => spec.y[i]), 2);
    if (c && c[2] < 0) { const v = x0 - c[1] / (2 * c[2]); if (Math.abs(v - x0) <= Math.abs(spec.x[near[near.length - 1]] - spec.x[near[0]])) pos = v; }
  }
  const shift = +(ref - pos).toFixed(3);
  const box = document.getElementById("rsShift"); box.value = shift;
  box.dispatchEvent(new Event("change", { bubbles: true }));
  rxNotify(`Measured band at ${pos.toFixed(2)} → shift correction ${shift >= 0 ? "+" : ""}${shift} cm⁻¹ applied to every spectrum. Press Plot.`);
  rxTrack("raman-shift-calibration");
}

function refreshCalibrationFiles() {
  const sel = document.getElementById("rsCalFile"); if (!sel) return;
  const prev = sel.value;
  const esc = v => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const act = spectra.filter(s => s != null);
  sel.innerHTML = act.length ? act.map(s => `<option value="${s.gIdx}">${esc(document.getElementById("label" + s.gIdx)?.value || oceanFileNames[s.gIdx])}</option>`).join("") : `<option value="">Load spectra first</option>`;
  if (act.some(s => String(s.gIdx) === prev)) sel.value = prev;
}
