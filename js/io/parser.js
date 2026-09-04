/* ═══════════════════════════════════════════════════════════
   UNIVERSAL METADATA-AWARE SPECTRAL PARSER
   Detects: Ocean Optics, Horiba/LabSpec, Renishaw WiRE, Bruker,
   WITec, JCAMP-DX, generic delimited 2-column (header or not).
═══════════════════════════════════════════════════════════ */
function parseSpectralData(text, filename) {
  const rawLines = text.split(/\r\n|\r|\n/);
  const meta = { format: "Generic 2-Column", filename };
  let x = [], y = [];

  const lower = text.toLowerCase();

  // ---- Format fingerprinting from metadata/header ----
  if (text.includes(">>>>>Begin Spectral Data<<<<<")) meta.format = "Ocean Optics";
  else if (lower.includes("##title") || lower.includes("##jcamp")) meta.format = "JCAMP-DX";
  else if (lower.includes("labspec") || lower.includes("horiba")) meta.format = "Horiba / LabSpec";
  else if (lower.includes("wire") || lower.includes("renishaw")) meta.format = "Renishaw WiRE";
  else if (lower.includes("witec") || lower.includes("project four")) meta.format = "WITec";
  else if (lower.includes("opus") || lower.includes("bruker")) meta.format = "Bruker";

  // ---- Pull simple "key: value" / "#key value" metadata lines ----
  const metaPairs = [];
  for (let i = 0; i < Math.min(rawLines.length, 80); i++) {
    const ln = rawLines[i].trim();
    if (!ln) continue;
    // key=value or key: value or ##KEY=value
    let m = ln.match(/^#{0,2}\s*([A-Za-z][\w .\-/]{1,40})\s*[:=]\s*(.+)$/);
    if (m && !/^[\d.+\-eE]/.test(m[1])) {
      const k = m[1].trim(), v = m[2].trim();
      if (v && v.length < 80 && metaPairs.length < 12) metaPairs.push([k, v]);
    }
  }
  meta.pairs = metaPairs;

  // ---- Locate where numeric data begins ----
  let startIdx = 0;
  if (meta.format === "Ocean Optics") {
    for (let i = 0; i < rawLines.length; i++) {
      if (rawLines[i].includes(">>>>>Begin Spectral Data<<<<<")) { startIdx = i + 1; break; }
    }
  } else {
    // skip leading non-numeric/header lines for any other format
    for (let i = 0; i < rawLines.length; i++) {
      const t = rawLines[i].trim();
      if (!t || t.startsWith("#") || t.startsWith("//") || t.startsWith("##") || t.startsWith(";")) continue;
      const parts = t.split(/[\s,;\t]+/);
      const a = parseFloat(parts[0]), b = parseFloat(parts[1]);
      if (parts.length >= 2 && !isNaN(a) && !isNaN(b)) { startIdx = i; break; }
    }
  }

  // ---- Read numeric X/Y rows ----
  for (let i = startIdx; i < rawLines.length; i++) {
    const t = rawLines[i].trim();
    if (!t || t.startsWith("#") || t.startsWith("//") || t.startsWith("##") || t.startsWith(";")) continue;
    const parts = t.split(/[\s,;\t]+/);
    if (parts.length >= 2) {
      const xx = parseFloat(parts[0]), yy = parseFloat(parts[1]);
      if (!isNaN(xx) && !isNaN(yy)) { x.push(xx); y.push(yy); }
    }
  }

  // ---- If X is descending (FTIR/Bruker common), keep as-is but note it ----
  if (x.length > 2 && x[0] > x[x.length - 1]) meta.descending = true;

  meta.points = x.length;
  if (x.length) { meta.xrange = [Math.min(...x), Math.max(...x)]; }
  return { x, y, meta };
}


// parse up to 4 columns: X Y [Yerr] [Xerr]
function parseXYFile(text) {
  const x = [], y = [], ey = [], ex = []; let hasEY = false, hasEX = false;
  for (const line of text.split(/\r\n|\r|\n/)) {
    const t = line.trim(); if (!t || t.startsWith("#") || t.startsWith("//") || t.startsWith(";")) continue;
    const parts = t.split(/[\s,;\t]+/);
    if (parts.length >= 2) {
      const xx = parseFloat(parts[0]), yy = parseFloat(parts[1]);
      if (!isNaN(xx) && !isNaN(yy)) {
        x.push(xx); y.push(yy);
        const e1 = parts.length >= 3 ? parseFloat(parts[2]) : NaN;
        const e2 = parts.length >= 4 ? parseFloat(parts[3]) : NaN;
        ey.push(isNaN(e1) ? 0 : e1); ex.push(isNaN(e2) ? 0 : e2);
        if (!isNaN(e1)) hasEY = true; if (!isNaN(e2)) hasEX = true;
      }
    }
  }
  return { x, y, ey: hasEY ? ey : null, ex: hasEX ? ex : null };
}