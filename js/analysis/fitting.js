/* ── CURVE FITTING ENGINE ──
   Least-squares regression for XY data from any field.

   • Linear and polynomial models are solved exactly (weighted linear least
     squares). X is centred and scaled before solving so high orders stay
     well conditioned, then the coefficients are mapped back to powers of x.
   • Exponential, power, logarithmic, Gaussian and Lorentzian models are
     solved with Levenberg–Marquardt, started from a linearised or
     shape-based estimate.
   • If Y-errors (σ) are supplied, every point is weighted by 1/σ².
   • Parameter standard errors come from the covariance matrix
     (JᵀWJ)⁻¹ scaled by the reduced χ², i.e. by the scatter of the data
     about the fit — the default convention of most analysis packages.
*/
function updateFitParams() {
  document.getElementById('fitOrderWrap').style.display = (document.getElementById('fitModel').value === 'poly') ? 'flex' : 'none';
}


/* ---------- small dense linear algebra ---------- */
// Solve A·x = b by Gaussian elimination with partial pivoting. Returns null if singular.
function fitSolve(A, b) {
  const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (!Number.isFinite(M[piv][c]) || Math.abs(M[piv][c]) < 1e-300) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x.every(Number.isFinite) ? x : null;
}

function fitInverse(A) {
  const n = A.length, inv = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    const e = new Array(n).fill(0); e[j] = 1;
    const col = fitSolve(A, e); if (!col) return null;
    col.forEach((v, i) => { inv[i][j] = v; });
  }
  return inv;
}

// JᵀWJ and JᵀW·r for a Jacobian J (n×k), weights w and residuals r
function fitNormalEquations(J, w, r) {
  const k = J[0].length, A = Array.from({ length: k }, () => new Array(k).fill(0)), g = new Array(k).fill(0);
  for (let i = 0; i < J.length; i++) {
    const Ji = J[i], wi = w[i];
    for (let a = 0; a < k; a++) {
      g[a] += Ji[a] * wi * r[i];
      for (let b = a; b < k; b++) A[a][b] += Ji[a] * wi * Ji[b];
    }
  }
  for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) A[a][b] = A[b][a];
  return { A, g };
}

// Central-difference Jacobian of f(x, p) with respect to p
function fitJacobian(f, x, p) {
  return x.map(xi => p.map((pj, j) => {
    const h = Math.abs(pj) > 1e-12 ? Math.abs(pj) * 1e-6 : 1e-9;
    const pp = p.slice(), pm = p.slice(); pp[j] = pj + h; pm[j] = pj - h;
    return (f(xi, pp) - f(xi, pm)) / (2 * h);
  }));
}

function fitChi2(f, x, y, w, p) {
  let s = 0;
  for (let i = 0; i < x.length; i++) { const r = y[i] - f(x[i], p); s += w[i] * r * r; }
  return Number.isFinite(s) ? s : Infinity;
}

// Levenberg–Marquardt minimisation of Σ wᵢ (yᵢ − f(xᵢ, p))²
function levenbergMarquardt(f, x, y, w, p0, maxIter = 300) {
  let p = p0.slice(), chi2 = fitChi2(f, x, y, w, p), lambda = 1e-3, converged = false;
  if (!Number.isFinite(chi2)) return null;
  for (let it = 0; it < maxIter && !converged; it++) {
    const J = fitJacobian(f, x, p);
    const r = x.map((xi, i) => y[i] - f(xi, p));
    const { A, g } = fitNormalEquations(J, w, r);
    let improved = false;
    while (lambda < 1e16) {
      const Ad = A.map((row, a) => row.map((v, b) => a === b ? v + lambda * (v || 1e-12) : v));
      const dp = fitSolve(Ad, g);
      if (dp) {
        const pn = p.map((v, j) => v + dp[j]);
        const chi2n = fitChi2(f, x, y, w, pn);
        if (chi2n <= chi2) {
          const rel = (chi2 - chi2n) / Math.max(chi2, 1e-300);
          p = pn; chi2 = chi2n; lambda = Math.max(lambda / 10, 1e-12); improved = true;
          if (rel < 1e-12) converged = true;
          break;
        }
      }
      lambda *= 10;
    }
    if (!improved) converged = true;   // no step lowers χ² any further: at the minimum
  }
  return { p, chi2, converged };
}


/* ---------- model definitions ---------- */
function binom(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }

// Weighted polynomial least squares in the scaled variable t = (x − m)/s,
// returned as coefficients of plain powers of x with their (unscaled) covariance.
function fitPolynomial(x, y, w, order) {
  const n = x.length, m = x.reduce((a, b) => a + b, 0) / n;
  const s = Math.max(...x.map(v => Math.abs(v - m))) || 1;
  const J = x.map(xi => { const t = (xi - m) / s; return Array.from({ length: order + 1 }, (_, j) => Math.pow(t, j)); });
  const { A, g } = fitNormalEquations(J, w, y);
  const b = fitSolve(A, g), Ainv = fitInverse(A);
  if (!b || !Ainv) return null;
  // a_i = Σ_j T[i][j]·b_j  with  T[i][j] = C(j,i)·(−m)^(j−i) / s^j
  const T = Array.from({ length: order + 1 }, (_, i) => Array.from({ length: order + 1 }, (_, j) => j < i ? 0 : binom(j, i) * Math.pow(-m, j - i) / Math.pow(s, j)));
  const a = T.map(row => row.reduce((acc, v, j) => acc + v * b[j], 0));
  const TA = T.map(Ti => Ainv[0].map((_, l) => Ti.reduce((acc, tij, j) => acc + tij * Ainv[j][l], 0)));
  const cov = TA.map(row => T.map(Tk => row.reduce((acc, v, l) => acc + v * Tk[l], 0)));
  // evaluating in t keeps the plotted curve accurate even for high orders
  const predict = xi => { const t = (xi - m) / s; return b.reduce((acc, bj, j) => acc + bj * Math.pow(t, j), 0); };
  return { p: a, covUnscaled: cov, predict };
}

function fmtNum(v) {
  if (!Number.isFinite(v)) return String(v);
  const a = Math.abs(v);
  return (a !== 0 && (a < 1e-3 || a >= 1e5)) ? v.toExponential(4) : String(+v.toPrecision(6));
}

// Returns null when the model cannot be fitted to these points.
// Result: { model, label, names, values, errors, coeffs, errMap, derived[], predict,
//           eqText, r2, adjR2, ssRes, chi2, redChi2, weighted, n, k, converged }
function fitModel(xIn, yIn, model, order, sigmaIn) {
  // keep finite points, sorted by x
  let pts = xIn.map((xi, i) => ({ x: +xi, y: +yIn[i], s: sigmaIn ? +sigmaIn[i] : NaN }))
    .filter(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  if (model === 'power' || model === 'log') pts = pts.filter(pt => pt.x > 0);
  pts.sort((a, b) => a.x - b.x);
  const x = pts.map(pt => pt.x), y = pts.map(pt => pt.y), n = x.length;
  if (n < 3) return null;
  const weighted = !!sigmaIn && pts.every(pt => Number.isFinite(pt.s) && pt.s > 0);
  const w = pts.map(pt => weighted ? 1 / (pt.s * pt.s) : 1);

  const yMin = Math.min(...y), yMax = Math.max(...y), yRange = (yMax - yMin) || Math.abs(yMax) || 1;
  const yMed = y.slice().sort((a, b) => a - b)[Math.floor(n / 2)];

  let f, names, p, label, eqOf, derivedOf = () => [], covUnscaled = null, converged = true, predictOverride = null;

  if (model === 'linear' || model === 'poly') {
    const ord = model === 'linear' ? 1 : Math.max(2, Math.min(order || 2, 10));
    if (n < ord + 2) return null;
    const res = fitPolynomial(x, y, w, ord); if (!res) return null;
    p = res.p; covUnscaled = res.covUnscaled; predictOverride = res.predict;
    f = (xi, q) => q.reduce((acc, qj, j) => acc + qj * Math.pow(xi, j), 0);
    if (model === 'linear') {
      label = 'Linear'; names = ['intercept', 'slope'];
      eqOf = q => `y = ${fmtNum(q[1])}·x ${q[0] < 0 ? '−' : '+'} ${fmtNum(Math.abs(q[0]))}`;
    } else {
      label = `Polynomial (order ${ord})`; names = p.map((_, j) => 'a' + j);
      eqOf = q => 'y = ' + q.map((v, j) => j === 0 ? fmtNum(v) : `${fmtNum(v)}·x${j > 1 ? '^' + j : ''}`).join(' + ');
    }
  } else if (model === 'exp') {
    if (n < 4) return null;
    label = 'Exponential'; names = ['A', 'b', 'c'];
    // Solve in centred form A'·e^{b(x−m)} + c (well conditioned), report A = A'·e^{−bm}.
    // Try the asymptote below the data (A > 0) and above it (A < 0); keep the better fit.
    const m = x.reduce((a, b) => a + b, 0) / n;
    const fc = (xi, q) => q[0] * Math.exp(q[1] * (xi - m)) + q[2];
    let best = null;
    [[yMin - 0.05 * yRange, 1], [yMax + 0.05 * yRange, -1]].forEach(([c0, sign]) => {
      const lin = polyFitCoeffs(x.map(v => v - m), y.map(v => Math.log(Math.max(sign * (v - c0), 1e-300))), 1);
      if (!lin || !lin.every(Number.isFinite)) return;
      const fit = levenbergMarquardt(fc, x, y, w, [sign * Math.exp(lin[0]), lin[1], c0]);
      if (fit && (!best || fit.chi2 < best.chi2)) best = fit;
    });
    if (!best) return null;
    converged = best.converged;
    p = [best.p[0] * Math.exp(-best.p[1] * m), best.p[1], best.p[2]];
    predictOverride = xi => fc(xi, best.p);
    f = (xi, q) => q[0] * Math.exp(q[1] * xi) + q[2];
    eqOf = q => `y = ${fmtNum(q[0])}·e^(${fmtNum(q[1])}·x) ${q[2] < 0 ? '−' : '+'} ${fmtNum(Math.abs(q[2]))}`;
    derivedOf = (q, C) => q[1] !== 0 ? [{ name: q[1] < 0 ? 'τ = −1/b (decay constant)' : 'τ = 1/b (growth constant)', value: Math.abs(1 / q[1]), se: Math.sqrt(C[1][1]) / (q[1] * q[1]) }] : [];
  } else if (model === 'power') {
    label = 'Power'; names = ['a', 'b'];
    f = (xi, q) => q[0] * Math.pow(xi, q[1]);
    const pos = x.map((xi, i) => [xi, y[i]]).filter(pr => pr[1] > 0);
    let p0 = [yMed || 1, 1];
    if (pos.length >= 2) { const c = polyFitCoeffs(pos.map(pr => Math.log(pr[0])), pos.map(pr => Math.log(pr[1])), 1); if (c && c.every(Number.isFinite)) p0 = [Math.exp(c[0]), c[1]]; }
    const fit = levenbergMarquardt(f, x, y, w, p0); if (!fit) return null;
    p = fit.p; converged = fit.converged;
    eqOf = q => `y = ${fmtNum(q[0])}·x^${fmtNum(q[1])}`;
  } else if (model === 'log') {
    label = 'Logarithmic'; names = ['a', 'b'];
    f = (xi, q) => q[0] * Math.log(xi) + q[1];
    // linear in its parameters, so a single weighted linear solve is exact
    const J = x.map(xi => [Math.log(xi), 1]);
    const { A, g } = fitNormalEquations(J, w, y);
    p = fitSolve(A, g); if (!p) return null;
    eqOf = q => `y = ${fmtNum(q[0])}·ln(x) ${q[1] < 0 ? '−' : '+'} ${fmtNum(Math.abs(q[1]))}`;
  } else if (model === 'gaussian' || model === 'lorentzian') {
    if (n < 5) return null;
    const gauss = model === 'gaussian';
    label = gauss ? 'Gaussian peak' : 'Lorentzian peak';
    names = gauss ? ['amplitude', 'center', 'sigma', 'baseline'] : ['amplitude', 'center', 'gamma (HWHM)', 'baseline'];
    f = gauss
      ? (xi, q) => q[3] + q[0] * Math.exp(-((xi - q[1]) ** 2) / (2 * q[2] * q[2]))
      : (xi, q) => q[3] + q[0] * (q[2] * q[2]) / ((xi - q[1]) ** 2 + q[2] * q[2]);
    // the peak may point up (emission, diffraction) or down (absorption dip)
    const up = (yMax - yMed) >= (yMed - yMin);
    const i0 = y.indexOf(up ? yMax : yMin), base0 = up ? yMin : yMax, A0 = y[i0] - base0;
    const half = base0 + A0 / 2, sgn = Math.sign(A0) || 1;
    let lo = x[0], hi = x[n - 1];
    for (let i = i0; i >= 0; i--) if ((y[i] - half) * sgn < 0) { lo = x[i]; break; }
    for (let i = i0; i < n; i++) if ((y[i] - half) * sgn < 0) { hi = x[i]; break; }
    const hwhm = Math.max((hi - lo) / 2, (x[n - 1] - x[0]) / 200 || 1e-9);
    const fit = levenbergMarquardt(f, x, y, w, [A0, x[i0], gauss ? hwhm / 1.17741 : hwhm, base0]);
    if (!fit) return null;
    p = fit.p; p[2] = Math.abs(p[2]); converged = fit.converged;
    eqOf = q => `${label} at x = ${fmtNum(q[1])}, A = ${fmtNum(q[0])}, FWHM = ${fmtNum(gauss ? 2.35482 * q[2] : 2 * q[2])}`;
    derivedOf = (q, C) => {
      const kF = gauss ? 2.35482 : 2;
      const kA = gauss ? Math.sqrt(2 * Math.PI) : Math.PI;
      const area = kA * q[0] * q[2];
      const varArea = kA * kA * (q[2] * q[2] * C[0][0] + q[0] * q[0] * C[2][2] + 2 * q[0] * q[2] * C[0][2]);
      return [
        { name: 'FWHM', value: kF * q[2], se: kF * Math.sqrt(C[2][2]) },
        { name: 'area (above baseline)', value: area, se: Math.sqrt(Math.max(varArea, 0)) }
      ];
    };
  } else if (model === 'langmuir' || model === 'hill') {
    // Binding isotherms in concentration x ≥ 0:
    //   Langmuir  y = y0 + A·x / (K + x)
    //   Hill      y = y0 + A·xⁿ / (Kⁿ + xⁿ)
    // K is the half-saturation concentration (apparent K_D), A the response at
    // saturation and y0 the response with no analyte.
    const hill = model === 'hill';
    if (n < (hill ? 5 : 4)) return null;
    if (x.some(v => v < 0)) return null;
    label = hill ? 'Hill' : 'Langmuir'; names = hill ? ['y0', 'A (max response)', 'K (half-saturation)', 'n (Hill coefficient)'] : ['y0', 'A (max response)', 'K (half-saturation)'];
    const hv = (xi, K, nh) => { const t = Math.pow(Math.max(xi, 0), nh); return t / (Math.pow(Math.abs(K), nh) + t); };
    f = hill ? (xi, q) => q[0] + q[1] * hv(xi, q[2], q[3]) : (xi, q) => q[0] + q[1] * xi / (Math.abs(q[2]) + xi);
    const iLo = 0, iHi = n - 1;                       // x is sorted
    const y0 = y[iLo], A0 = (y[iHi] - y[iLo]) * 1.2 || 1;
    const pos = x.filter(v => v > 0);
    const K0 = pos.length ? pos[Math.floor(pos.length / 2)] : 1;
    const fit = levenbergMarquardt(f, x, y, w, hill ? [y0, A0, K0, 1] : [y0, A0, K0]);
    if (!fit) return null;
    p = fit.p; p[2] = Math.abs(p[2]); converged = fit.converged;
    eqOf = q => hill
      ? `y = ${fmtNum(q[0])} + ${fmtNum(q[1])}·xⁿ/(${fmtNum(q[2])}ⁿ + xⁿ), n = ${fmtNum(q[3])}`
      : `y = ${fmtNum(q[0])} + ${fmtNum(q[1])}·x/(${fmtNum(q[2])} + x)`;
  } else {
    return null;
  }

  const k = p.length;
  if (n <= k) return null;
  const predict = predictOverride || (xi => f(xi, p));
  const yhat = x.map(predict);
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let ssRes = 0, ssTot = 0, chi2 = 0;
  for (let i = 0; i < n; i++) { const r = y[i] - yhat[i]; ssRes += r * r; ssTot += (y[i] - yMean) ** 2; chi2 += w[i] * r * r; }
  if (!Number.isFinite(ssRes)) return null;
  const r2 = ssTot ? 1 - ssRes / ssTot : 0;
  const dof = n - k;
  const adjR2 = 1 - (1 - r2) * (n - 1) / dof;
  const redChi2 = chi2 / dof;

  if (!covUnscaled) {
    const J = fitJacobian(f, x, p);
    covUnscaled = fitInverse(fitNormalEquations(J, w, new Array(n).fill(0)).A);
  }
  const C = covUnscaled ? covUnscaled.map(row => row.map(v => v * redChi2)) : null;
  const errors = p.map((_, j) => C && C[j][j] >= 0 ? Math.sqrt(C[j][j]) : NaN);

  const coeffs = {}, errMap = {};
  names.forEach((nm, j) => { coeffs[nm] = p[j]; errMap[nm] = errors[j]; });

  return {
    model, label, names, values: p, errors, coeffs, errMap,
    derived: C ? derivedOf(p, C) : [],
    predict, eqText: eqOf(p),
    r2, adjR2, ssRes, chi2, redChi2: weighted ? redChi2 : null, weighted, n, k, converged
  };
}


function fmtWithErr(v, se) {
  return Number.isFinite(se) ? `${fmtNum(v)} ± ${fmtNum(se)}` : fmtNum(v);
}

function renderFitResultsBox(showEq) {
  const box = document.getElementById("fitResultBox");
  if (!lastFitResults.length) { box.innerHTML = ""; return; }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let html = "";
  lastFitResults.forEach(fit => {
    if (fit.failed) {
      html += `<div class="fit-result"><b>Fit — ${esc(fit.datasetName)}</b><div style="font-size:13px;color:var(--danger,#dc2626);margin-top:4px;">This model could not be fitted: too few valid points, or the data do not suit the model (power and logarithmic fits need x &gt; 0).</div></div>`;
      return;
    }
    let rows = "";
    rows += `<tr><td>Model</td><td>${esc(fit.label)}${fit.converged ? "" : ' <span style="color:var(--danger,#dc2626)">(not fully converged)</span>'}</td></tr>`;
    fit.names.forEach((nm, j) => { rows += `<tr><td>${esc(nm)}</td><td>${fmtWithErr(fit.values[j], fit.errors[j])}</td></tr>`; });
    fit.derived.forEach(d => { rows += `<tr><td>${esc(d.name)}</td><td>${fmtWithErr(d.value, d.se)}</td></tr>`; });
    rows += `<tr><td>R²</td><td><b>${fit.r2.toFixed(6)}</b></td></tr>`;
    rows += `<tr><td>Adjusted R²</td><td>${fit.adjR2.toFixed(6)}</td></tr>`;
    rows += `<tr><td>Residual sum of squares</td><td>${fit.ssRes.toExponential(5)}</td></tr>`;
    if (fit.redChi2 !== null && fit.redChi2 !== undefined) rows += `<tr><td>Reduced χ²</td><td>${fmtNum(fit.redChi2)}</td></tr>`;
    rows += `<tr><td>Points / parameters</td><td>${fit.n} / ${fit.k}${fit.weighted ? " · weighted by 1/σ²" : ""}</td></tr>`;
    html += `<div class="fit-result"><b>Fit — ${esc(fit.datasetName)}</b>${showEq ? `<div style="font-size:13px;color:#475569;margin-top:4px;">${esc(fit.eqText)}</div>` : ""}<table>${rows}</table><div style="font-size:11px;color:var(--hint,#64748b);margin-top:4px;">± values are 1σ standard errors.</div></div>`;
  });
  box.innerHTML = html;
}
