

function applyDespike(y) {
  const type = document.getElementById("despikeType").value;
  if (type === "none") return y;
  const thr = parseFloat(document.getElementById("dsThresh").value) || 6;
  const win = parseInt(document.getElementById("dsWin").value) || 3;
  return despikeSignal(y, thr, win);
}


function despikeSignal(y, thr, win) {
  const n = y.length;
  if (n < 5) return y.slice();
  // Whitaker-Hayes: modified Z-score of consecutive differences
  const diff = [];
  for (let i = 1; i < n; i++) diff.push(y[i] - y[i - 1]);
  const med = median(diff);
  const mad = median(diff.map(d => Math.abs(d - med))) || 1e-9;
  const z = diff.map(d => 0.6745 * (d - med) / mad);

  const spike = new Array(n).fill(false);
  for (let i = 0; i < z.length; i++) {
    if (Math.abs(z[i]) > thr) { spike[i] = true; spike[i + 1] = true; }
  }
  const out = y.slice();
  for (let i = 0; i < n; i++) {
    if (!spike[i]) continue;
    // find nearest clean neighbours within window and interpolate
    let lo = i - 1; while (lo >= 0 && spike[lo]) lo--;
    let hi = i + 1; while (hi < n && spike[hi]) hi++;
    if (lo < 0 && hi >= n) continue;
    if (lo < 0) out[i] = y[hi];
    else if (hi >= n) out[i] = y[lo];
    else out[i] = y[lo] + (y[hi] - y[lo]) * (i - lo) / (hi - lo);
  }
  return out;
}


function updateDespikeParams() {
  const type = document.getElementById('despikeType').value;
  document.getElementById('dsThreshWrap').style.display = (type === 'none') ? 'none' : 'flex';
  document.getElementById('dsWinWrap').style.display = (type === 'none') ? 'none' : 'flex';
}


function setStatus(msg, cls="") { const el = document.getElementById("status"); el.textContent = msg; el.className = cls; }