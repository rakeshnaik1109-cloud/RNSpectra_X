function updateBaselineParams() {
  const type = document.getElementById('baselineType').value;
  const p1 = document.getElementById('blParam1Wrap'), p2 = document.getElementById('blParam2Wrap');
  const lx1 = document.getElementById('blLinX1Wrap'), lx2 = document.getElementById('blLinX2Wrap');
  p1.style.display = 'none'; p2.style.display = 'none'; lx1.style.display = 'none'; lx2.style.display = 'none';
  const showAls = type === 'als' ? 'flex' : 'none';
  ['blAlsLamWrap', 'blAlsPWrap'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = showAls; });
  if (type === 'poly') p1.style.display = 'flex';
  else if (type === 'rolling_ball') p2.style.display = 'flex';
  else if (type === 'linear') { lx1.style.display = 'flex'; lx2.style.display = 'flex'; }
}

function applyBaseline(x, y) {
  const type = document.getElementById('baselineType').value; if (type === 'none') return { corrected: y, baseline: null };
  if (type === 'linear') {
    const x1 = parseFloat(document.getElementById('blLinX1').value), x2 = parseFloat(document.getElementById('blLinX2').value);
    const i1 = nearestIdx(x, x1), i2 = nearestIdx(x, x2); const slope = (y[i2] - y[i1]) / (x[i2] - x[i1] || 1);
    const baseline = x.map((xi) => y[i1] + slope * (xi - x[i1])); return { corrected: y.map((yi, i) => yi - baseline[i]), baseline };
  }
  if (type === 'poly') { const baseline = modPolyBaseline(x, y, parseInt(document.getElementById('blParam1').value) || 3); return { corrected: y.map((yi, i) => yi - baseline[i]), baseline }; }
  if (type === 'rubberband') { const baseline = rubberbandBaseline(x, y); return { corrected: y.map((yi, i) => Math.max(0, yi - baseline[i])), baseline }; }
  if (type === 'rolling_ball') { const baseline = rollingBallBaseline(y, parseInt(document.getElementById('blParam2').value) || 50); return { corrected: y.map((yi, i) => yi - baseline[i]), baseline }; }
  if (type === 'als') {
    const lam = Math.pow(10, parseFloat(document.getElementById('blAlsLam').value) || 5);
    const p = Math.min(0.5, Math.max(1e-4, parseFloat(document.getElementById('blAlsP').value) || 0.01));
    const baseline = alsBaseline(y, lam, p); return { corrected: y.map((yi, i) => yi - baseline[i]), baseline };
  }
  return { corrected: y, baseline: null };
}

// Asymmetric least squares (Eilers & Boelens, 2005). Minimise
//   Σ wᵢ (yᵢ − zᵢ)² + λ Σ (Δ²zᵢ)²
// with wᵢ = p where the signal is above the baseline and 1 − p below it, and
// re-weight until the weights settle. W + λD'D is pentadiagonal, so each pass
// is an O(n) banded Cholesky solve.
function alsBaseline(y, lam, p, maxIter = 15) {
  const n = y.length; if (n < 5) return y.slice();
  // D'D for the second-difference operator: bands 0, 1 and 2
  const d0 = new Float64Array(n), d1 = new Float64Array(n - 1), d2 = new Float64Array(n - 2);
  for (let i = 0; i < n - 2; i++) {
    d0[i] += 1; d0[i + 1] += 4; d0[i + 2] += 1;
    d1[i] -= 2; d1[i + 1] -= 2; d2[i] += 1;
  }
  let w = new Float64Array(n).fill(1), z = new Float64Array(n);
  for (let it = 0; it < maxIter; it++) {
    z = solvePentaSPD(Array.from(d0, (v, i) => w[i] + lam * v), Array.from(d1, v => lam * v), Array.from(d2, v => lam * v), y.map((v, i) => w[i] * v));
    let changed = 0;
    for (let i = 0; i < n; i++) { const nw = y[i] > z[i] ? p : 1 - p; if (nw !== w[i]) { changed++; w[i] = nw; } }
    if (!changed) break;
  }
  return Array.from(z);
}

// Solve A z = b for a symmetric positive-definite pentadiagonal A given by its
// main (a0), first (a1) and second (a2) diagonals, via banded Cholesky A = LLᵀ.
function solvePentaSPD(a0, a1, a2, b) {
  const n = a0.length, l0 = new Float64Array(n), l1 = new Float64Array(n), l2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (i >= 2) l2[i] = a2[i - 2] / l0[i - 2];
    if (i >= 1) l1[i] = (a1[i - 1] - (i >= 2 ? l2[i] * l1[i - 1] : 0)) / l0[i - 1];
    l0[i] = Math.sqrt(Math.max(1e-300, a0[i] - l1[i] * l1[i] - l2[i] * l2[i]));
  }
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) t[i] = (b[i] - (i >= 1 ? l1[i] * t[i - 1] : 0) - (i >= 2 ? l2[i] * t[i - 2] : 0)) / l0[i];
  const z = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) z[i] = (t[i] - (i + 1 < n ? l1[i + 1] * z[i + 1] : 0) - (i + 2 < n ? l2[i + 2] * z[i + 2] : 0)) / l0[i];
  return z;
}


// Least-squares polynomial evaluated at x. The abscissa is centred and scaled to
// [-1, 1] first: raw wavenumbers raised to high powers make the normal equations
// numerically singular.
function polyFitBaseline(x, y, order) {
  const n = x.length; if (!n) return [];
  let lo = Infinity, hi = -Infinity; for (const v of x) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const m = (lo + hi) / 2, h = (hi - lo) / 2 || 1;
  const t = x.map(v => (v - m) / h);
  const c = polyFitCoeffs(t, y, Math.min(order, n - 1));
  return t.map(ti => c.reduce((s, ci, j) => s + ci * Math.pow(ti, j), 0));
}

// Modified polynomial (ModPoly; Lieber & Mahadevan-Jansen, Appl. Spectrosc. 2003).
// Fit, clip the working signal to the fit wherever it rises above it (i.e. at
// the Raman bands), and refit until the baseline stops changing. Unlike a single
// least-squares fit, the result passes under the bands instead of through them.
function modPolyBaseline(x, y, order, maxIter = 100, tol = 1e-3) {
  let work = y.slice(), base = polyFitBaseline(x, work, order);
  for (let it = 0; it < maxIter; it++) {
    work = work.map((v, i) => Math.min(v, base[i]));
    const next = polyFitBaseline(x, work, order);
    let num = 0, den = 0;
    for (let i = 0; i < next.length; i++) { num += (next[i] - base[i]) ** 2; den += base[i] ** 2; }
    base = next;
    if (Math.sqrt(num / (den || 1)) < tol) break;
  }
  return base;
}
function polyFitCoeffs(x, y, order) { const n = x.length; const X = []; for (let i = 0; i < n; i++) { const row = []; for (let j = 0; j <= order; j++) row.push(Math.pow(x[i], j)); X.push(row); } const XtX = matMul(transpose(X), X); const Xty = matVec(transpose(X), y); return gaussSolve(XtX, Xty); }
function rubberbandBaseline(x, y) { const hull = convexHullLower(x.map((v, i) => [v, y[i]])); return x.map(xi => interpHull(hull, xi)); }
// Lower convex hull (Andrew's monotone chain): keep only counter-clockwise turns
// so the hull runs underneath the points.
function convexHullLower(pts) { const sorted = pts.slice().sort((a,b) => a[0]-b[0]); const hull = []; for (const p of sorted) { while (hull.length >= 2) { if (cross(hull[hull.length-2], hull[hull.length-1], p) <= 0) hull.pop(); else break; } hull.push(p); } return hull; }
function cross([ox,oy],[ax,ay],[bx,by]) { return (ax-ox)*(by-oy)-(ay-oy)*(bx-ox); }
function interpHull(hull, xi) { for (let i = 0; i < hull.length - 1; i++) { if (xi >= hull[i][0] && xi <= hull[i+1][0]) { return hull[i][1] + (xi - hull[i][0]) / (hull[i+1][0] - hull[i][0] || 1) * (hull[i+1][1] - hull[i][1]); } } return hull[hull.length-1][1]; }
function rollingBallBaseline(y, r) { const n = y.length; const minArr = new Array(n).fill(Infinity); const baseline = new Array(n).fill(0); for (let i = 0; i < n; i++) { for (let j = Math.max(0, i-r); j <= Math.min(n-1, i+r); j++) { if (y[j] < minArr[i]) minArr[i] = y[j]; } } for (let i = 0; i < n; i++) { let mx = -Infinity; for (let j = Math.max(0, i-r); j <= Math.min(n-1, i+r); j++) { if (minArr[j] > mx) mx = minArr[j]; } baseline[i] = mx; } return baseline; }
