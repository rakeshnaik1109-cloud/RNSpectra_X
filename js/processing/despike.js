

function applyDespike(y) {
  const type = document.getElementById("despikeType").value;
  if (type === "none") return y;
  const thr = parseFloat(document.getElementById("dsThresh").value) || 6;
  const win = parseInt(document.getElementById("dsWin").value) || 3;
  return despikeSignal(y, thr, win, type === "whitaker" ? "mean" : "interp");
}


// Spikes are detected on the first difference with a modified (median/MAD)
// Z-score. Repair:
//   "interp" (Modified Z-score) — linear interpolation between the nearest
//            unflagged neighbours;
//   "mean"   (Whitaker–Hayes 2018) — mean of the unflagged points within ±win.
function despikeSignal(y, thr, win, repair = "interp") {
  const n = y.length;
  if (n < 5) return y.slice();
  const diff = [];
  for (let i = 1; i < n; i++) diff.push(y[i] - y[i - 1]);
  const med = median(diff);
  const mad = median(diff.map(d => Math.abs(d - med))) || 1e-9;
  const z = diff.map(d => 0.6745 * (d - med) / mad);

  // diff[i] = y[i+1] − y[i]. A cosmic ray is at most a few pixels wide and
  // rises abruptly out of locally smooth signal. A run a+1..b is treated as a
  // spike when
  //   • the jump into it, diff[a], is an outlier (|Z| > threshold),
  //   • within MAX_SPIKE_WIDTH points the signal returns to about the level
  //     before the jump, and
  //   • the steps just outside the run are small compared with the jump.
  // The last two tests are what keep the steep flanks and apex of a strong,
  // narrow genuine band from being "repaired": a band rises over several
  // comparable steps, a spike in one. Downward spikes (dead pixels) are
  // handled the same way.
  const MAX_SPIKE_WIDTH = 3;
  const spike = new Array(n).fill(false);
  for (let a = 0; a < z.length; a++) {
    if (Math.abs(z[a]) <= thr) continue;
    const jump = Math.abs(diff[a]);
    if (a > 0 && Math.abs(diff[a - 1]) >= 0.5 * jump) continue;
    for (let b = a + 1; b <= Math.min(n - 2, a + MAX_SPIKE_WIDTH); b++) {
      if (Math.abs(y[b + 1] - y[a]) < 0.5 * jump && (b + 1 >= z.length || Math.abs(diff[b + 1]) < 0.5 * jump)) {
        for (let k = a + 1; k <= b; k++) spike[k] = true;
        a = b;
        break;
      }
    }
  }
  const out = y.slice();
  for (let i = 0; i < n; i++) {
    if (!spike[i]) continue;
    if (repair === "mean") {
      let s = 0, c = 0;
      for (let k = Math.max(0, i - win); k <= Math.min(n - 1, i + win); k++) if (!spike[k]) { s += y[k]; c++; }
      if (c) { out[i] = s / c; continue; }
      // every point in the window is flagged: fall through to interpolation
    }
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
  document.getElementById('dsWinWrap').style.display = (type === 'whitaker') ? 'flex' : 'none';
}


function setStatus(msg, cls="") { const el = document.getElementById("status"); el.textContent = msg; el.className = cls; }