/* ── CURVE FITTING ENGINE ── */
function updateFitParams() {
  document.getElementById('fitOrderWrap').style.display = (document.getElementById('fitModel').value === 'poly') ? 'flex' : 'none';
}



function rSquared(y, yhat) {
  const m = y.reduce((a, b) => a + b, 0) / y.length;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < y.length; i++) { ssRes += (y[i] - yhat[i]) ** 2; ssTot += (y[i] - m) ** 2; }
  return { r2: ssTot ? 1 - ssRes / ssTot : 0, ssRes, ssTot };
}




// returns {label, coeffs:{name:val}, predict, eqText, r2, adjR2, ssRes, n, k}
function fitModel(x, y, model, order) {
  const n = x.length; let coeffs = {}, predict, eqText, k = 2;
  if (model === 'linear') {
    const c = polyFitCoeffs(x, y, 1); // c0 + c1 x
    const slope = c[1], intercept = c[0];
    coeffs = { slope, intercept }; k = 2;
    predict = xi => intercept + slope * xi;
    eqText = `y = ${slope.toExponential(4)}·x + ${intercept.toExponential(4)}`;
  } else if (model === 'poly') {
    const c = polyFitCoeffs(x, y, order); k = order + 1;
    c.forEach((v, i) => coeffs["a" + i] = v);
    predict = xi => c.reduce((s, ci, i) => s + ci * Math.pow(xi, i), 0);
    eqText = "y = " + c.map((v, i) => `${v.toExponential(3)}·x^${i}`).join(" + ");
  } else if (model === 'exp') {
    // linearize ln(y - cmin) ; use offset c = min(y)-small
    const cOff = Math.min(...y) - 1e-6 * (Math.max(...y) - Math.min(...y) + 1);
    const yl = y.map(v => Math.log(Math.max(v - cOff, 1e-12)));
    const c = polyFitCoeffs(x, yl, 1); const a = Math.exp(c[0]), b = c[1];
    coeffs = { a, b, c: cOff }; k = 3;
    predict = xi => a * Math.exp(b * xi) + cOff;
    eqText = `y = ${a.toExponential(3)}·e^(${b.toExponential(3)}·x) + ${cOff.toExponential(3)}`;
  } else if (model === 'power') {
    const valid = x.map((xi, i) => [xi, y[i]]).filter(p => p[0] > 0 && p[1] > 0);
    const lx = valid.map(p => Math.log(p[0])), ly = valid.map(p => Math.log(p[1]));
    const c = polyFitCoeffs(lx, ly, 1); const a = Math.exp(c[0]), b = c[1];
    coeffs = { a, b }; k = 2;
    predict = xi => a * Math.pow(xi, b);
    eqText = `y = ${a.toExponential(3)}·x^${b.toFixed(4)}`;
  } else if (model === 'log') {
    const valid = x.map((xi, i) => [xi, y[i]]).filter(p => p[0] > 0);
    const lx = valid.map(p => Math.log(p[0])), yy = valid.map(p => p[1]);
    const c = polyFitCoeffs(lx, yy, 1); const a = c[1], b = c[0];
    coeffs = { a, b }; k = 2;
    predict = xi => a * Math.log(xi) + b;
    eqText = `y = ${a.toExponential(3)}·ln(x) + ${b.toExponential(3)}`;
  } else if (model === 'gaussian' || model === 'lorentzian') {
    // estimate amplitude A, center x0, width w from data, refine via coarse grid
    const ymax = Math.max(...y), i0 = y.indexOf(ymax), x0g = x[i0];
    const base = Math.min(...y); const A0 = ymax - base;
    // FWHM estimate
    let half = base + A0 / 2, lo = x[0], hi = x[x.length - 1];
    for (let i = i0; i >= 0; i--) { if (y[i] < half) { lo = x[i]; break; } }
    for (let i = i0; i < x.length; i++) { if (y[i] < half) { hi = x[i]; break; } }
    let w = Math.max((hi - lo) / 2, (x[x.length-1]-x[0])/50);
    const g = (xi, A, x0, ww) => model === 'gaussian' ? base + A * Math.exp(-((xi - x0) ** 2) / (2 * ww * ww)) : base + A * (ww * ww) / ((xi - x0) ** 2 + ww * ww);
    // coarse refine
    let best = { A: A0, x0: x0g, w, err: Infinity };
    for (let dA = 0.8; dA <= 1.2; dA += 0.1) for (let dx = -w; dx <= w; dx += w / 3) for (let dw = 0.6; dw <= 1.6; dw += 0.2) {
      const A = A0 * dA, x0 = x0g + dx, ww = w * dw;
      let e = 0; for (let i = 0; i < n; i++) e += (y[i] - g(x[i], A, x0, ww)) ** 2;
      if (e < best.err) best = { A, x0, w: ww, err: e };
    }
    coeffs = { amplitude: best.A, center: best.x0, width: best.w, baseline: base, FWHM: model === 'gaussian' ? 2.3548 * best.w : 2 * best.w }; k = 3;
    predict = xi => g(xi, best.A, best.x0, best.w);
    eqText = `${model} peak @ ${best.x0.toFixed(2)}, A=${best.A.toExponential(3)}, w=${best.w.toFixed(3)}`;
  } else { return null; }

  const yhat = x.map(predict);
  const { r2, ssRes } = rSquared(y, yhat);
  const adjR2 = (n - k - 1) > 0 ? 1 - (1 - r2) * (n - 1) / (n - k - 1) : r2;
  return { model, coeffs, predict, eqText, r2, adjR2, ssRes, n, k };
}






function renderFitResultsBox(showEq) {
  const box = document.getElementById("fitResultBox");
  if (!lastFitResults.length) { box.innerHTML = ""; return; }
  let html = "";
  lastFitResults.forEach(fit => {
    let rows = "";
    rows += `<tr><td>Model</td><td>${fit.model}</td></tr>`;
    rows += `<tr><td>R²</td><td><b>${fit.r2.toFixed(6)}</b></td></tr>`;
    rows += `<tr><td>Adjusted R²</td><td>${fit.adjR2.toFixed(6)}</td></tr>`;
    rows += `<tr><td>Residual Sum of Squares</td><td>${fit.ssRes.toExponential(5)}</td></tr>`;
    rows += `<tr><td>Data points (n)</td><td>${fit.n}</td></tr>`;
    Object.entries(fit.coeffs).forEach(([k, v]) => { rows += `<tr><td>${k}</td><td>${typeof v === 'number' ? v.toExponential(6) : v}</td></tr>`; });
    html += `<div class="fit-result"><b>Fit — ${fit.datasetName}</b>${showEq ? `<div style="font-size:13px;color:#475569;margin-top:4px;">${fit.eqText}</div>` : ""}<table>${rows}</table></div>`;
  });
  box.innerHTML = html;
}