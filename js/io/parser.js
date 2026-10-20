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

  // ---- JCAMP-DX tabular (X++(Y..Y)) block: one X then several Ys per line ----
  if (meta.format === "JCAMP-DX" && /##XYDATA\s*=\s*\(X\+\+\(Y\.\.Y\)\)/i.test(text)) {
    const jc = parseJcampXYData(rawLines);
    if (jc) { x = jc.x; y = jc.y; if (jc.note) meta.note = jc.note; }
  }

  // ---- Read numeric X/Y rows ----
  const haveJcamp = x.length > 0;
  for (let i = startIdx; i < rawLines.length && !haveJcamp; i++) {
    const t = rawLines[i].trim();
    if (!t || t.startsWith("#") || t.startsWith("//") || t.startsWith("##") || t.startsWith(";")) continue;
    const parts = t.split(/[\s,;\t]+/);
    if (parts.length >= 2) {
      const xx = parseFloat(parts[0]), yy = parseFloat(parts[1]);
      if (!isNaN(xx) && !isNaN(yy)) { x.push(xx); y.push(yy); }
    }
  }

  // ---- Return X ascending. Descending files (common for FTIR/Bruker) are
  // reordered so interpolation and group averaging work on every file. ----
  if (x.length > 2 && x[0] > x[x.length - 1]) meta.descending = true;
  if (x.length > 1) {
    const order = x.map((_, i) => i).sort((a, b) => x[a] - x[b]);
    if (order.some((v, i) => v !== i)) { x = order.map(i => x[i]); y = order.map(i => y[i]); }
  }

  meta.points = x.length;
  if (x.length) { meta.xrange = [Math.min(...x), Math.max(...x)]; }
  return { x, y, meta };
}


// JCAMP-DX "##XYDATA=(X++(Y..Y))" in plain (AFFN/PAC) form. Each line holds a
// starting X followed by consecutive Y values; X advances by
// (LASTX − FIRSTX)/(NPOINTS − 1). XFACTOR/YFACTOR are applied.
// Compressed forms (SQZ/DIF/DUP) are not decoded.
function parseJcampXYData(lines) {
  const ldr = {};
  let inData = false, x0s = [], rows = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (t.startsWith("##")) {
      const m = t.match(/^##([^=]+)=\s*(.*)$/);
      if (!m) continue;
      const key = m[1].replace(/[\s\-_/]/g, "").toUpperCase();
      if (key === "XYDATA") { inData = true; continue; }
      if (inData) { inData = false; }
      ldr[key] = m[2].trim();
      continue;
    }
    if (!inData || !t || t.startsWith("$$")) continue;
    if (/[@A-IJ-Ra-ij-rS-Zs%]/.test(t.replace(/[eE][+-]?\d/g, ""))) return { x: [], y: [], note: "Compressed JCAMP-DX (SQZ/DIF) is not supported — export as plain (AFFN) JCAMP or CSV." };
    const nums = t.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
    if (!nums || nums.length < 2) continue;
    x0s.push(parseFloat(nums[0])); rows.push(nums.slice(1).map(parseFloat));
  }
  if (!rows.length) return null;
  const xf = parseFloat(ldr.XFACTOR) || 1, yf = parseFloat(ldr.YFACTOR) || 1;
  const total = rows.reduce((a, r) => a + r.length, 0);
  const first = parseFloat(ldr.FIRSTX), last = parseFloat(ldr.LASTX), npts = parseInt(ldr.NPOINTS);
  const dx = (Number.isFinite(first) && Number.isFinite(last) && npts > 1) ? (last - first) / (npts - 1)
           : (x0s.length > 1 ? (x0s[1] - x0s[0]) * xf / rows[0].length : 1);
  const x = [], y = [];
  rows.forEach((r, li) => r.forEach((v, k) => { x.push(x0s[li] * xf + k * dx); y.push(v * yf); }));
  return { x, y, note: npts && npts !== total ? `NPOINTS says ${npts}, read ${total}` : "" };
}


// Thermo/Galactic SPC (binary, "new" LSB format, version byte 0x4B).
// Reads the first sub-file: evenly spaced X from FFIRST..FLAST, or an explicit
// X array when the TXVALS flag is set; Y as float32 (exponent −128) or as
// scaled integers y = n·2^(exp−32) (or 2^(exp−16) for 16-bit data).
function parseSpcBinary(buffer, filename) {
  const meta = { format: "Galactic SPC", filename, pairs: [] };
  const fail = note => { meta.note = note; meta.points = 0; return { x: [], y: [], meta }; };
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 544) return fail("File too short to be SPC");
  const dv = new DataView(buffer);
  const flags = dv.getUint8(0), version = dv.getUint8(1);
  if (version !== 0x4B) return fail(version === 0x4C ? "Big-endian SPC is not supported" : version === 0x4D ? "Old-format SPC is not supported — re-save as new-format SPC, JCAMP-DX or CSV" : "Not a recognised SPC file");
  const TSPREC = 0x01, TMULTI = 0x04, TXYXYS = 0x40, TXVALS = 0x80;
  if ((flags & TMULTI) && (flags & TXYXYS)) return fail("Multi-file SPC with separate X per sub-file is not supported");
  const fexp = dv.getInt8(3), npts = dv.getUint32(4, true);
  const first = dv.getFloat64(8, true), last = dv.getFloat64(16, true), nsub = dv.getUint32(24, true);
  if (!npts) return fail("SPC header reports no points");
  let off = 512, x = [];
  if (flags & TXVALS) {
    for (let i = 0; i < npts; i++) x.push(dv.getFloat32(off + 4 * i, true));
    off += 4 * npts;
  } else {
    for (let i = 0; i < npts; i++) x.push(npts > 1 ? first + (last - first) * i / (npts - 1) : first);
  }
  // 32-byte sub-header; its own exponent overrides the global one in multi-files
  const subexp = dv.getInt8(off + 1);
  const exp = (flags & TMULTI) ? subexp : fexp;
  off += 32;
  const y = [];
  const need = exp === -128 ? 4 * npts : (flags & TSPREC) ? 2 * npts : 4 * npts;
  if (off + need > buffer.byteLength) return fail("SPC data block is truncated");
  for (let i = 0; i < npts; i++) {
    if (exp === -128) y.push(dv.getFloat32(off + 4 * i, true));
    else if (flags & TSPREC) y.push(dv.getInt16(off + 2 * i, true) * Math.pow(2, exp - 16));
    else y.push(dv.getInt32(off + 4 * i, true) * Math.pow(2, exp - 32));
  }
  if (nsub > 1) meta.note = `${nsub} sub-spectra in file; the first is loaded`;
  if (x.length > 2 && x[0] > x[x.length - 1]) { meta.descending = true; x.reverse(); y.reverse(); }
  meta.points = x.length;
  meta.xrange = [x[0], x[x.length - 1]];
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

/* ═══════════════════════════════════════════════════════════
   MULTI-COLUMN TABLES (XY mode): CSV / TXT / Excel
   One X column followed by any number of Y columns, optionally
   preceded by instrument header rows such as an Avantes export:

     Filename-->      a.TRM8  b.TRM8 …
     Int.time[ms]-->  500     500    …
     Wavelength [nm]  a       b      …     ← names row
     175.204          -172.4  0      …     ← data
═══════════════════════════════════════════════════════════ */

// Split delimited text into rows of cells, keeping empty cells so that
// columns stay aligned (an empty "Mode/Unit-->" row must not shift columns).
function textToRows(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const sample = lines.slice(0, 50).join("\n");
  // Tab first; then semicolon, which (unlike a comma) never appears inside a
  // number, so "175,204;-172,47" is read as decimal-comma data; then comma;
  // otherwise runs of spaces.
  const delim = sample.includes("\t") ? "\t" : sample.includes(";") ? ";" : sample.includes(",") ? "," : null;
  return lines.map(l => delim ? l.split(delim).map(c => c.trim()) : l.trim().split(/\s+/));
}

function cellNum(c) {
  if (typeof c === "number") return Number.isFinite(c) ? c : NaN;
  if (typeof c !== "string") return NaN;
  let t = c.trim();
  if (/^[+-]?\d+,\d+([eE][+-]?\d+)?$/.test(t)) t = t.replace(",", ".");   // decimal comma (European exports)
  if (!t || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return NaN;
  return Number(t);
}
function cellText(c) { return c === undefined || c === null ? "" : String(c).trim(); }

// Returns { series: [{ name, x, y, ey, ex, info }], xLabel, layout }
// layout: "wide" (one dataset per column) or "errors" (X Y [Yerr] [Xerr]).
function parseXYTable(rows, sourceName) {
  const out = { series: [], xLabel: "", layout: "wide" };
  const isData = r => r && Number.isFinite(cellNum(r[0])) && r.filter(c => Number.isFinite(cellNum(c))).length >= 2;
  const start = rows.findIndex(isData);
  if (start < 0) return out;

  // Names row: the nearest non-empty row above the data
  let labels = [];
  for (let k = start - 1; k >= 0; k--) {
    const r = rows[k] || [];
    if (r.some(c => cellText(c))) { if (!cellText(r[0]).endsWith("-->")) labels = r.map(cellText); break; }
  }
  // Instrument settings rows ("Int.time[ms]-->  500  500 …"), per column
  const metaRows = rows.slice(0, start).filter(r => r && /-->\s*$/.test(cellText(r[0])));

  const data = rows.slice(start).filter(isData);
  let nCols = 0;
  data.forEach(r => { for (let c = r.length - 1; c >= 0; c--) if (Number.isFinite(cellNum(r[c]))) { nCols = Math.max(nCols, c + 1); break; } });
  out.xLabel = labels[0] && !Number.isFinite(cellNum(labels[0])) ? labels[0] : "";

  const errLike = l => /(err|unc|σ|±|\bsd\b|\bsem\b|std|dev)/i.test(l || "");
  const errorLayout = nCols >= 3 && nCols <= 4 && (labels.length ? errLike(labels[2]) : true);

  const xs = data.map(r => cellNum(r[0]));
  if (nCols === 2 || errorLayout) {
    out.layout = errorLayout ? "errors" : "wide";
    const s = { name: (labels[1] && !Number.isFinite(cellNum(labels[1]))) ? labels[1] : sourceName, x: [], y: [], ey: errorLayout ? [] : null, ex: errorLayout && nCols === 4 ? [] : null, info: "" };
    data.forEach((r, i) => {
      const y = cellNum(r[1]); if (!Number.isFinite(xs[i]) || !Number.isFinite(y)) return;
      s.x.push(xs[i]); s.y.push(y);
      if (s.ey) s.ey.push(Number.isFinite(cellNum(r[2])) ? cellNum(r[2]) : 0);
      if (s.ex) s.ex.push(Number.isFinite(cellNum(r[3])) ? cellNum(r[3]) : 0);
    });
    if (s.x.length) out.series.push(s);
    return out;
  }

  for (let c = 1; c < nCols; c++) {
    // Name: the header row; else the instrument "Filename-->" row (extension
    // dropped); else an automatic "file · column N", flagged so that grouping
    // by name never lumps unrelated unnamed columns together.
    const fnRow = metaRows.find(r => /^file\s*name/i.test(cellText(r[0])));
    const fromFile = fnRow ? cellText(fnRow[c]).replace(/\.[^.]+$/, "") : "";
    const named = labels[c] && !Number.isFinite(cellNum(labels[c])) ? labels[c] : fromFile;
    const s = { name: named || `${sourceName} · column ${c + 1}`, autoName: !named, x: [], y: [], ey: null, ex: null, info: "" };
    data.forEach((r, i) => { const y = cellNum(r[c]); if (Number.isFinite(xs[i]) && Number.isFinite(y)) { s.x.push(xs[i]); s.y.push(y); } });
    if (!s.x.length) continue;
    s.info = metaRows.map(r => {
      const v = cellText(r[c]); if (!v) return "";
      return cellText(r[0]).replace(/-->\s*$/, "").trim() + ": " + v;
    }).filter(Boolean).join(" · ");
    out.series.push(s);
  }
  return out;
}
