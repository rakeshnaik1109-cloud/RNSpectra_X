/* ═══════════════════════════════════════════════════════════
   STATISTICS — group tests and principal component analysis
   • Welch's t-test (two groups, unequal variances) and one-way ANOVA
     (two or more groups), with exact p-values from the regularised
     incomplete beta function (Numerical Recipes, §6.4).
   • PCA of mean-centred spectra by eigen-decomposition of the n×n Gram
     matrix (Jacobi rotations): with far fewer spectra than points this
     is exact and much cheaper than decomposing the p×p covariance.
═══════════════════════════════════════════════════════════ */

function statMean(a) { return a.reduce((s, v) => s + v, 0) / a.length; }
function statVar(a) { const m = statMean(a); return a.length > 1 ? a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1) : 0; }

function logGamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t);
  let s = 1.000000000190015; for (let j = 0; j < 6; j++) s += c[j] / ++y;
  return -t + Math.log(2.5066282746310005 * s / x);
}

function betacf(a, b, x) {
  const MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

// regularised incomplete beta I_x(a, b)
function incBeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}

// two-sided p for Student's t with df degrees of freedom
function tTwoSidedP(t, df) { return Number.isFinite(t) && df > 0 ? incBeta(df / (df + t * t), df / 2, 0.5) : NaN; }
// upper-tail p for F(d1, d2)
function fUpperP(F, d1, d2) { return Number.isFinite(F) && F >= 0 ? incBeta(d2 / (d2 + d1 * F), d2 / 2, d1 / 2) : NaN; }

function welchTTest(a, b) {
  const na = a.length, nb = b.length;
  if (na < 2 || nb < 2) return null;
  const va = statVar(a) / na, vb = statVar(b) / nb, se = Math.sqrt(va + vb);
  const t = (statMean(a) - statMean(b)) / se;
  const df = (va + vb) ** 2 / (va * va / (na - 1) + vb * vb / (nb - 1));
  return { test: "Welch's t-test", t, df, p: se > 0 ? tTwoSidedP(t, df) : NaN };
}

function oneWayAnova(groups) {
  const gs = groups.filter(g => g.length);
  const N = gs.reduce((s, g) => s + g.length, 0), k = gs.length;
  if (k < 2 || N - k < 1) return null;
  const grand = gs.flat().reduce((s, v) => s + v, 0) / N;
  let ssb = 0, ssw = 0;
  gs.forEach(g => { const m = statMean(g); ssb += g.length * (m - grand) ** 2; g.forEach(v => { ssw += (v - m) ** 2; }); });
  const d1 = k - 1, d2 = N - k, F = (ssb / d1) / (ssw / d2);
  return { test: "One-way ANOVA", F, df1: d1, df2: d2, p: ssw > 0 ? fUpperP(F, d1, d2) : NaN };
}

function fmtP(p) {
  if (!Number.isFinite(p)) return "—";
  if (p < 1e-4) return "p < 0.0001";
  return "p = " + (p < 0.001 ? p.toExponential(2) : p.toFixed(4));
}
function pStars(p) { return !Number.isFinite(p) ? "" : p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "n.s."; }

// Symmetric eigen-decomposition by cyclic Jacobi rotations.
// Returns { values (descending), vectors (columns, as arrays) }.
function jacobiEigen(Ain) {
  const n = Ain.length, A = Ain.map(r => r.slice());
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-22 * (1 + A.reduce((s, r, i) => s + r[i] * r[i], 0))) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
      }
    }
  }
  const order = A.map((r, i) => i).sort((a, b) => A[b][b] - A[a][a]);
  return { values: order.map(i => A[i][i]), vectors: order.map(i => V.map(r => r[i])) };
}

// PCA of the rows of X (n spectra × p points).
//   scale: "none" (mean-centred) or "auto" (each point scaled to unit variance)
// Returns scores[n][k], loadings[k][p], explained[k] (fraction), mean[p]
function pca(X, nComp, scale) {
  const n = X.length, p = X[0].length;
  const mean = new Array(p).fill(0), sd = new Array(p).fill(1);
  X.forEach(r => r.forEach((v, j) => { mean[j] += v / n; }));
  if (scale === "auto") for (let j = 0; j < p; j++) { let s = 0; for (let i = 0; i < n; i++) s += (X[i][j] - mean[j]) ** 2; sd[j] = Math.sqrt(s / Math.max(1, n - 1)) || 1; }
  const Z = X.map(r => r.map((v, j) => (v - mean[j]) / sd[j]));
  const G = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => { let s = 0; for (let k = 0; k < p; k++) s += Z[i][k] * Z[j][k]; return s; }));
  const { values, vectors } = jacobiEigen(G);
  const total = values.reduce((s, v) => s + Math.max(0, v), 0) || 1;
  const k = Math.min(nComp, n - 1, values.filter(v => v > total * 1e-12).length);
  const scores = Array.from({ length: n }, () => []), loadings = [], explained = [];
  for (let c = 0; c < k; c++) {
    const sv = Math.sqrt(Math.max(values[c], 0)), u = vectors[c];
    // loading = Zᵀu / σ, a unit vector; score = σu
    const L = new Array(p).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) L[j] += Z[i][j] * u[i];
    for (let j = 0; j < p; j++) L[j] /= sv || 1;
    // sign convention: the largest loading is positive
    let big = 0; L.forEach((v, j) => { if (Math.abs(v) > Math.abs(L[big])) big = j; });
    const sg = L[big] < 0 ? -1 : 1;
    loadings.push(L.map(v => v * sg));
    for (let i = 0; i < n; i++) scores[i].push(sv * u[i] * sg);
    explained.push(Math.max(values[c], 0) / total);
  }
  return { scores, loadings, explained, mean };
}

// 95 % confidence ellipse of 2-D points (χ²₂ = 5.991), as a closed path
function confidenceEllipse(xs, ys, chi2 = 5.991) {
  const n = xs.length; if (n < 3) return null;
  const mx = statMean(xs), my = statMean(ys);
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  sxx /= n - 1; syy /= n - 1; sxy /= n - 1;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + disc, l2 = Math.max(0, tr / 2 - disc);
  const ang = Math.abs(sxy) < 1e-300 ? (sxx >= syy ? 0 : Math.PI / 2) : Math.atan2(l1 - sxx, sxy);
  const a = Math.sqrt(chi2 * l1), b = Math.sqrt(chi2 * l2);
  const ex = [], ey = [];
  for (let k = 0; k <= 72; k++) {
    const t = 2 * Math.PI * k / 72, cx = a * Math.cos(t), cy = b * Math.sin(t);
    ex.push(mx + cx * Math.cos(ang) - cy * Math.sin(ang)); ey.push(my + cx * Math.sin(ang) + cy * Math.cos(ang));
  }
  return { x: ex, y: ey };
}
