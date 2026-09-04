function updateSmoothParams() { showSmoothParams(document.getElementById('smoothType').value, 'smParam1Wrap','smParam1Label','smParam1','smParam2Wrap','smParam2Label','smParam2','smParam3Wrap','smParam3Label','smParam3'); }
function updateXYSmoothParams() { showSmoothParams(document.getElementById('xySmoothType').value, 'xySmP1Wrap','xySmP1Label','xySmP1','xySmP2Wrap','xySmP2Label','xySmP2',null,null,null); }
function showSmoothParams(type, p1w,p1l,p1, p2w,p2l,p2, p3w,p3l,p3) { if (p1w) document.getElementById(p1w).style.display = 'none'; if (p2w) document.getElementById(p2w).style.display = 'none'; if (p3w) document.getElementById(p3w).style.display = 'none'; if (type === 'moving_avg' || type === 'median') document.getElementById(p1w).style.display = 'flex'; else if (type === 'savgol') { document.getElementById(p1w).style.display = 'flex'; if (p2w) document.getElementById(p2w).style.display = 'flex'; } else if (type === 'gaussian') { document.getElementById(p1w).style.display = 'flex'; } }


function applySmoothing(y, type, w, poly, sigma) {
  if (type === 'none') return y; const n = y.length;
  if (type === 'moving_avg') return y.map((_, i) => { const s = Math.max(0, i-Math.floor(w/2)), e = Math.min(n-1, i+Math.floor(w/2)); return y.slice(s, e+1).reduce((a,v) => a+v, 0) / (e-s+1); });
  if (type === 'median') return y.map((_, i) => { const slice = y.slice(Math.max(0, i-Math.floor(w/2)), Math.min(n, i+Math.floor(w/2)+1)).sort((a,b)=>a-b); return slice[Math.floor(slice.length/2)]; });
  if (type === 'gaussian') { const s = sigma || 2; const kRadius = Math.ceil(3*s); const kernel = []; for (let k = -kRadius; k <= kRadius; k++) kernel.push(Math.exp(-k*k/(2*s*s))); return y.map((_, i) => { let val = 0, ws = 0; kernel.forEach((kv, ki) => { const idx = i - kRadius + ki; if (idx >= 0 && idx < n) { val += kv*y[idx]; ws += kv; } }); return val / ws; }); }
  if (type === 'savgol') { const hw = Math.floor(w/2); const ord = Math.min(poly || 2, w-1); const xw = Array.from({length: w}, (_, i) => i - hw); return y.map((_, i) => { const start = Math.max(0, i - hw), end = Math.min(n-1, i + hw); const yw = y.slice(start, end+1); const xwSlice = xw.slice(start - (i-hw), end - (i-hw) + 1); try { return polyFitBaseline(xwSlice, yw, Math.min(ord, yw.length-1))[0]; } catch { return y[i]; } }); }
  return y;
}



function normalizeData(y, type) { if (type === "none") return y; if (type === "max") { const m = Math.max(...y); return m ? y.map(v=>v/m) : y; } if (type === "minmax") { const mn=Math.min(...y), mx=Math.max(...y); return (mx-mn)?y.map(v=>(v-mn)/(mx-mn)):y; } if (type === "area") { const s=y.reduce((a,b)=>a+Math.abs(b),0); return s?y.map(v=>v/s):y; } if (type === "vector") { const nm=Math.sqrt(y.reduce((a,b)=>a+b*b,0)); return nm?y.map(v=>v/nm):y; } return y; }


function runPeakDetectionAlgorithm(xx, yy) { const threshold = 0.15 * Math.max(...yy); const peaks = []; for (let i = 2; i < yy.length-2; i++) { if (yy[i]>yy[i-1] && yy[i]>yy[i-2] && yy[i]>yy[i+1] && yy[i]>yy[i+2] && yy[i]>threshold) peaks.push(i); } return peaks; }