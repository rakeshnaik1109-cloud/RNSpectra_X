function updateSmoothParams() { showSmoothParams(document.getElementById('smoothType').value, 'smParam1Wrap','smParam1Label','smParam1','smParam2Wrap','smParam2Label','smParam2','smParam3Wrap','smParam3Label','smParam3'); }
function updateXYSmoothParams() { showSmoothParams(document.getElementById('xySmoothType').value, 'xySmP1Wrap','xySmP1Label','xySmP1','xySmP2Wrap','xySmP2Label','xySmP2',null,null,null); }
// Gaussian smoothing is controlled by its σ. Where a dedicated σ field exists
// (Raman mode) it is shown; otherwise the first field is relabelled as σ.
function showSmoothParams(type, p1w,p1l,p1, p2w,p2l,p2, p3w,p3l,p3) {
  const show = (id, on) => { if (id) document.getElementById(id).style.display = on ? 'flex' : 'none'; };
  show(p1w, type === 'moving_avg' || type === 'median' || type === 'savgol' || (type === 'gaussian' && !p3w));
  show(p2w, type === 'savgol');
  show(p3w, type === 'gaussian');
  if (p1l) document.getElementById(p1l).textContent = (type === 'gaussian' && !p3w) ? 'Sigma (pts)' : 'Window (pts)';
}


function applySmoothing(y, type, w, poly, sigma) {
  if (type === 'none') return y; const n = y.length;
  w = Math.max(1, Math.round(w) || 1);
  if (type === 'moving_avg') return y.map((_, i) => { const s = Math.max(0, i-Math.floor(w/2)), e = Math.min(n-1, i+Math.floor(w/2)); return y.slice(s, e+1).reduce((a,v) => a+v, 0) / (e-s+1); });
  if (type === 'median') return y.map((_, i) => { const slice = y.slice(Math.max(0, i-Math.floor(w/2)), Math.min(n, i+Math.floor(w/2)+1)).sort((a,b)=>a-b); return slice[Math.floor(slice.length/2)]; });
  if (type === 'gaussian') { const s = sigma || 2; const kRadius = Math.ceil(3*s); const kernel = []; for (let k = -kRadius; k <= kRadius; k++) kernel.push(Math.exp(-k*k/(2*s*s))); return y.map((_, i) => { let val = 0, ws = 0; kernel.forEach((kv, ki) => { const idx = i - kRadius + ki; if (idx >= 0 && idx < n) { val += kv*y[idx]; ws += kv; } }); return val / ws; }); }
  if (type === 'savgol') {
    // Local least-squares polynomial in the offset t = j − i, evaluated at the
    // centre point itself (t = 0), i.e. the constant coefficient. Near the ends
    // the window is truncated but still evaluated at the point being smoothed.
    const hw = Math.floor(w/2);
    return y.map((_, i) => {
      const start = Math.max(0, i - hw), end = Math.min(n-1, i + hw);
      const t = [], yw = [];
      for (let j = start; j <= end; j++) { t.push(j - i); yw.push(y[j]); }
      const ord = Math.min(poly || 2, t.length - 1);
      if (ord < 1) return y[i];
      const c = polyFitCoeffs(t, yw, ord);
      return Number.isFinite(c[0]) ? c[0] : y[i];
    });
  }
  return y;
}


// x is needed for "area" (trapezoidal integral) and "ref" (reference band).
function normalizeData(y, type, x, opts) {
  if (type === "none" || !y.length) return y;
  if (type === "max") { const m = Math.max(...y); return m ? y.map(v=>v/m) : y; }
  if (type === "minmax") { const mn=Math.min(...y), mx=Math.max(...y); return (mx-mn)?y.map(v=>(v-mn)/(mx-mn)):y; }
  if (type === "area") {
    let s = 0;
    if (x && x.length === y.length) for (let i = 1; i < y.length; i++) s += Math.abs(x[i] - x[i-1]) * (Math.abs(y[i]) + Math.abs(y[i-1])) / 2;
    else s = y.reduce((a,b)=>a+Math.abs(b),0);
    return s?y.map(v=>v/s):y;
  }
  if (type === "vector") { const nm=Math.sqrt(y.reduce((a,b)=>a+b*b,0)); return nm?y.map(v=>v/nm):y; }
  if (type === "ref" && x && opts) {
    // Divide by the band maximum found within ±window of the reference position
    let ref = -Infinity;
    for (let i = 0; i < x.length; i++) if (Math.abs(x[i] - opts.refX) <= opts.window && y[i] > ref) ref = y[i];
    if (!Number.isFinite(ref)) ref = y[nearestIdx(x, opts.refX)];
    // a reference "band" at or below zero has no band in it: leave the spectrum unscaled
    return ref > 0 ? y.map(v => v / ref) : y;
  }
  return y;
}


// Peak detection by topographic prominence. A local maximum is kept when it
// rises at least minPromPct % of the spectrum's intensity range above the
// higher of the two lowest points separating it from taller signal on either
// side. Prominence is unaffected by vertical offsets and baseline level, and
// is what distinguishes a genuine band from noise riding on a shoulder.
function runPeakDetectionAlgorithm(xx, yy, minPromPct) {
  const n = yy.length; if (n < 3) return [];
  const pct = Number.isFinite(minPromPct) ? minPromPct : getPeakProminencePct();
  let lo = Infinity, hi = -Infinity;
  for (const v of yy) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const thr = (pct / 100) * (hi - lo);
  if (!(hi > lo)) return [];
  const peaks = [];
  for (let i = 1; i < n - 1; i++) {
    if (!(yy[i] > yy[i-1])) continue;
    let j = i; while (j < n - 1 && yy[j+1] === yy[i]) j++;   // flat top
    if (j >= n - 1 || !(yy[j+1] < yy[i])) { i = j; continue; }
    const pk = Math.floor((i + j) / 2), h = yy[i];
    let leftMin = h, rightMin = h;
    for (let k = i - 1; k >= 0 && yy[k] <= h; k--) if (yy[k] < leftMin) leftMin = yy[k];
    for (let k = j + 1; k < n && yy[k] <= h; k++) if (yy[k] < rightMin) rightMin = yy[k];
    if (h - Math.max(leftMin, rightMin) >= thr) peaks.push(pk);
    i = j;
  }
  return peaks;
}

function getPeakProminencePct() {
  const v = parseFloat(document.getElementById("peakProminence")?.value);
  return Number.isFinite(v) && v >= 0 ? v : 5;
}
