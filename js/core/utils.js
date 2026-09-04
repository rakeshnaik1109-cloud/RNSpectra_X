function median(arr) { const s = arr.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

function nearestIdx(arr, val) { let best = 0, bestD = Infinity; arr.forEach((v, i) => { const d = Math.abs(v - val); if (d < bestD) { bestD = d; best = i; } }); return best; }

function transpose(M) { return M[0].map((_, c) => M.map(r => r[c])); }

function matMul(A, B) { return A.map(row => B[0].map((_, j) => row.reduce((s,v,k) => s + v*B[k][j], 0))); }

function matVec(M, v) { return M.map(row => row.reduce((s,vi,i) => s + vi*v[i], 0)); }

function gaussSolve(A, b) { const n = b.length; const M = A.map((row,i) => [...row, b[i]]); for (let col = 0; col < n; col++) { let max = col; for (let r = col+1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[max][col])) max = r; [M[col], M[max]] = [M[max], M[col]]; for (let r = col+1; r < n; r++) { const f = M[r][col] / (M[col][col] || 1e-12); for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]; } } const x = new Array(n).fill(0); for (let i = n-1; i >= 0; i--) { x[i] = M[i][n]; for (let j = i+1; j < n; j++) x[i] -= M[i][j] * x[j]; x[i] /= M[i][i] || 1e-12; } return x; }

function interpolate(xArr, yArr, targetX) { if (targetX <= xArr[0]) return yArr[0]; if (targetX >= xArr[xArr.length-1]) return yArr[yArr.length-1]; let low=0, high=xArr.length-1; while (high-low>1) { const mid=Math.floor((low+high)/2); if(xArr[mid]<=targetX) low=mid; else high=mid; } return yArr[low]+(targetX-xArr[low]) * (yArr[high]-yArr[low]) / (xArr[high]-xArr[low]); }

function hexToRgba(hex, a) {
  const h = hex.replace('#', ''); const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}


function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type: type + ";charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}


