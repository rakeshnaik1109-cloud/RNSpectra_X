/* ═══════════════════════════════════════════════════════════
   RNSpectraX™ — advancedLayout.js
   Publication-grade layout engine:
   - Legend box styling (box / filled / transparent / custom) + click-to-rename
   - Journal / DPI export presets, font families
   - Axis frame (box vs L-shape vs custom), grid, minor ticks,
     scientific/SI notation, zero-line control, axis label standoff,
     manual Y-axis scale divisor with auto label suffix, auto/manual Y range
   - Scale bar (non-axis-reading size indicator)
   - TIFF (+ high-DPI PNG/JPEG) export
═══════════════════════════════════════════════════════════ */

/* ---------- field-id resolver ----------
   Ocean-mode controls use bare lowerCamelCase ids (e.g. "figWidth").
   XY-mode controls mirror them with an "xy" + PascalCase prefix (e.g. "xyFigWidth").
   fid('', 'FigWidth') -> "figWidth" ;  fid('xy', 'FigWidth') -> "xyFigWidth" */
function fid(prefix, field) {
  if (!prefix) return field.charAt(0).toLowerCase() + field.slice(1);
  return prefix + field;
}
function $val(id, fallback) { const el = document.getElementById(id); return (el && el.value !== undefined) ? el.value : fallback; }
function $chk(id, fallback) { const el = document.getElementById(id); return el ? el.checked : fallback; }

/* ---------- legend rename overrides (persist across re-plots) ---------- */
let legendNameOverrides = { ocean: {}, xy: {} };

function legendKey(kind, idx) { return `${kind}:${idx}`; }

function getDisplayName(mode, kind, idx, defaultName) {
  const ov = legendNameOverrides[mode][legendKey(kind, idx)];
  return (ov !== undefined && ov !== "") ? ov : defaultName;
}

function resetLegendNames(mode) {
  legendNameOverrides[mode] = {};
  if (mode === 'ocean') { if (typeof plotSpectrum === 'function') plotSpectrum(); }
  else { if (typeof plotXY === 'function') plotXY(); }
}

/* ═══════════════════════════════════════════════════════════
   FREEFORM ANNOTATIONS: text boxes, arrows, and shapes (rect/circle/
   line via Plotly's native draw tools) that the user can place and drag
   anywhere on the chart. Since renderCanvasTracesAndLayout rebuilds
   layout.annotations/shapes from scratch on every render (peak labels,
   scale bar, inset), user-added ones are tracked separately here and
   re-appended after everything we generate — and re-synced from the live
   plot after every drag/edit/draw/erase so they survive the next replot.
═══════════════════════════════════════════════════════════ */
let customAnnotations = { ocean: [], xy: [] };
let customShapesStore = { ocean: [], xy: [] };

function replotCurrentMode(mode) {
  if (mode === 'ocean' && typeof plotSpectrum === 'function') plotSpectrum();
  else if (mode === 'xy' && typeof plotXY === 'function') plotXY();
}

function annotFieldId(mode, name) {
  return mode === 'ocean' ? 'annot' + name : 'xyAnnot' + name;
}

function addTextAnnotation(mode) {
  const color = $val(annotFieldId(mode, 'Color'), '#111111');
  const familyKey = $val(annotFieldId(mode, 'FontFamily'), 'auto');
  const size = parseFloat($val(annotFieldId(mode, 'FontSize'), 13)) || 13;
  const bold = $chk(annotFieldId(mode, 'Bold'), false);
  const boxStyle = $val(annotFieldId(mode, 'BoxStyle'), 'filled');
  let family = familyKey !== 'auto' ? (FONT_FAMILIES[familyKey] || 'Georgia, serif') : 'Georgia, serif';
  if (bold) family = 'Arial Black, ' + family; // Plotly annotation font has no weight property; substitute a heavier face
  const n = customAnnotations[mode].length;
  const filled = boxStyle !== 'transparent';
  customAnnotations[mode].push({
    x: 0.5, y: 0.92 - (n % 6) * 0.07, xref: 'paper', yref: 'paper',
    text: 'Double-click to edit', showarrow: false,
    font: { size, color, family },
    bgcolor: filled ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0)',
    bordercolor: filled ? color : 'rgba(0,0,0,0)',
    borderwidth: filled ? 1 : 0, borderpad: 4
  });
  replotCurrentMode(mode);
}

function addArrowAnnotation(mode) {
  const color = $val(annotFieldId(mode, 'Color'), '#dc2626');
  const n = customAnnotations[mode].length;
  customAnnotations[mode].push({
    x: 0.5, y: 0.5 - (n % 6) * 0.06, xref: 'paper', yref: 'paper',
    ax: 40, ay: -40, axref: 'pixel', ayref: 'pixel',
    text: '', showarrow: true, arrowhead: 2, arrowsize: 1.2, arrowwidth: 2, arrowcolor: color
  });
  replotCurrentMode(mode);
}

function clearCustomAnnotations(mode) {
  customAnnotations[mode] = [];
  customShapesStore[mode] = [];
  replotCurrentMode(mode);
}

/* Re-bind on every render (Plotly.purge() creates a fresh event emitter each
   time, so — same as the legend-rename handler — a "bind once" guard here
   would silently go stale after the first re-plot). genAnnCount/genShapeCount
   mark where "ours" ends and "the user's" begins in this render's arrays. */
function bindAnnotationSync(gd, mode, genAnnCount, genShapeCount) {
  if (!gd || !gd.on) return;
  gd.on('plotly_relayout', function () {
    try {
      const allAnn = (gd.layout && gd.layout.annotations) || [];
      const allShp = (gd.layout && gd.layout.shapes) || [];
      customAnnotations[mode] = allAnn.slice(genAnnCount).map(a => Object.assign({}, a));
      customShapesStore[mode] = allShp.slice(genShapeCount).map(s => Object.assign({}, s));
    } catch (e) { /* ignore */ }
  });
}

/* ---------- LEGEND BOX STYLE ---------- */
function computeLegendLayout(prefix) {
  const style = $val(fid(prefix, 'LegendBoxStyle'), 'box');
  const bg = $val(fid(prefix, 'LegendBgColor'), '#ffffff');
  const opacity = parseFloat($val(fid(prefix, 'LegendBgOpacity'), 0.85));
  const borderColor = $val(fid(prefix, 'LegendBorderColor'), '#94a3b8');
  const borderWidth = parseFloat($val(fid(prefix, 'LegendBorderWidth'), 1));
  const orientation = $val(fid(prefix, 'LegendOrientation'), 'v');
  const itemGap = parseFloat($val(fid(prefix, 'LegendItemGap'), 4)) || 4;

  let bgcolor, bw;
  if (style === "transparent") { bgcolor = "rgba(0,0,0,0)"; bw = 0; }
  else if (style === "filled") { bgcolor = hexToRgba(bg, opacity); bw = 0; }
  else { bgcolor = hexToRgba(bg, opacity); bw = borderWidth; } // "box" or "custom"

  return {
    bgcolor,
    bordercolor: bw > 0 ? borderColor : "rgba(0,0,0,0)",
    borderwidth: bw,
    orientation: orientation === "h" ? "h" : "v",
    tracegroupgap: itemGap
  };
}

/* Legend/title/axis-title renaming now goes through Plotly's own native
   click-to-edit (config.edits below) instead of a hand-rolled popup — it's
   more robust, and it's also what makes axis-label click-to-edit possible
   at all. We just need to sync whatever the user types back into our own
   controlling state/fields, so it survives the next full re-plot (which
   otherwise would overwrite it by re-reading the old field values). */
function bindNativeEditSync(gd, mode) {
  if (!gd || !gd.on) return;
  const prefix = mode === 'ocean' ? '' : 'xy';

  // Renaming a legend entry edits trace.name -> fires plotly_restyle
  gd.on('plotly_restyle', function (update) {
    try {
      const upd = update && update[0];
      const idxs = update && update[1];
      if (!upd || !upd.name || !idxs) return;
      idxs.forEach((traceIdx, i) => {
        const trace = gd.data && gd.data[traceIdx];
        if (trace && trace.meta && trace.meta.editable) {
          const newName = Array.isArray(upd.name) ? upd.name[i] : upd.name;
          legendNameOverrides[mode][legendKey(trace.meta.kind, trace.meta.idx)] = newName;
          // Best-effort: also reflect the rename in the sidebar field that drives it
          if (mode === 'ocean' && trace.meta.kind === 'file') {
            const el = document.getElementById('label' + trace.meta.idx);
            if (el) el.value = newName;
          } else if (mode === 'ocean' && trace.meta.kind === 'avg') {
            const el = document.getElementById('avgLegendName');
            if (el) el.value = newName;
          }
        }
      });
    } catch (e) { /* ignore */ }
  });

  // Editing title / axis titles / dragging the legend edits layout -> plotly_relayout
  gd.on('plotly_relayout', function (update) {
    try {
      if (!update) return;
      const setField = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      if (update['title.text'] !== undefined) setField(fid(prefix, 'Title'), update['title.text']);
      if (update['xaxis.title.text'] !== undefined) setField(fid(prefix, 'Xlabel'), update['xaxis.title.text']);
      if (update['yaxis.title.text'] !== undefined) setField(fid(prefix, 'Ylabel'), update['yaxis.title.text']);
      if (update['legend.x'] !== undefined) {
        setField(fid(prefix, 'LegendX'), update['legend.x']);
        const disp = document.getElementById(fid(prefix, 'LegendX') + '_val'); if (disp) disp.textContent = (+update['legend.x']).toFixed(2);
      }
      if (update['legend.y'] !== undefined) {
        setField(fid(prefix, 'LegendY'), update['legend.y']);
        const disp = document.getElementById(fid(prefix, 'LegendY') + '_val'); if (disp) disp.textContent = (+update['legend.y']).toFixed(2);
      }
    } catch (e) { /* ignore */ }
  });
}

/* ---------- JOURNAL / DPI PRESETS ---------- */
const JOURNAL_PRESETS = {
  nature_single:  { label: "Nature — single column",      widthMm: 89,   aspect: 0.75,   dpi: 300, font: "arial",     title: 14, axis: 12, tick: 10, legend: 9  },
  nature_double:  { label: "Nature — double column",      widthMm: 183,  aspect: 0.55,   dpi: 300, font: "arial",     title: 16, axis: 13, tick: 11, legend: 10 },
  science_single: { label: "Science — single column",     widthMm: 55,   aspect: 0.8,    dpi: 300, font: "helvetica", title: 12, axis: 10, tick: 9,  legend: 8  },
  acs_single:     { label: "ACS Journals — single column", widthMm: 84,   aspect: 0.75,   dpi: 600, font: "times",     title: 14, axis: 12, tick: 10, legend: 9  },
  acs_double:     { label: "ACS Journals — double column", widthMm: 177,  aspect: 0.5,    dpi: 600, font: "times",     title: 16, axis: 13, tick: 11, legend: 10 },
  ieee_single:    { label: "IEEE — single column",        widthMm: 88.9, aspect: 0.75,   dpi: 600, font: "times",     title: 13, axis: 11, tick: 9,  legend: 8  },
  rsc_single:     { label: "RSC (Royal Soc. Chem.)",       widthMm: 85,   aspect: 0.75,   dpi: 300, font: "arial",     title: 14, axis: 12, tick: 10, legend: 9  },
  elsevier_single:{ label: "Elsevier — single column",     widthMm: 90,   aspect: 0.75,   dpi: 300, font: "arial",     title: 14, axis: 12, tick: 10, legend: 9  },
  wiley_single:   { label: "Wiley",                        widthMm: 84,   aspect: 0.75,   dpi: 300, font: "times",     title: 14, axis: 12, tick: 10, legend: 9  },
  springer_single:{ label: "Springer / Nature Portfolio",  widthMm: 84.5, aspect: 0.75,   dpi: 300, font: "arial",     title: 14, axis: 12, tick: 10, legend: 9  },
  slide_169:      { label: "Presentation slide (16:9)",    widthMm: 254,  aspect: 0.5625, dpi: 150, font: "arial",     title: 26, axis: 20, tick: 15, legend: 14 }
};

function populateJournalPresetSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel || sel.__populated) return;
  sel.__populated = true;
  const custom = document.createElement('option'); custom.value = ""; custom.textContent = "Custom (manual settings)";
  sel.appendChild(custom);
  Object.entries(JOURNAL_PRESETS).forEach(([key, p]) => {
    const o = document.createElement('option'); o.value = key; o.textContent = p.label; sel.appendChild(o);
  });
}

function mmToPxAtRefDpi(mm) { return Math.round(mm / 25.4 * 96); } // fig-size fields are stored at a 96dpi screen reference

function applyJournalPreset(prefix) {
  const sel = document.getElementById(fid(prefix, 'JournalPreset'));
  if (!sel || !sel.value) return;
  const p = JOURNAL_PRESETS[sel.value];
  if (!p) return;
  const w = mmToPxAtRefDpi(p.widthMm);
  const h = Math.round(w * p.aspect);
  setVal(fid(prefix, 'FigWidth'), w);
  setVal(fid(prefix, 'FigHeight'), h);
  setVal(fid(prefix, 'ExportDPI'), p.dpi);
  setVal(fid(prefix, 'TitleSize'), p.title);
  setVal(fid(prefix, 'LabelSize'), p.axis);
  setVal(fid(prefix, 'TickSize'), p.tick);
  setVal(fid(prefix, 'LegendSize'), p.legend);
  const fontSel = document.getElementById(fid(prefix, 'FontFamily'));
  if (fontSel) fontSel.value = p.font;

  // Peak-label density only applies to Ocean mode (labelSpacing/maxPeakLabels live there).
  // Scale relative to the 1000px width these defaults were originally tuned for, so a
  // narrow single-column preset shows fewer, better-separated labels instead of a
  // cramped, overlapping mess.
  if (prefix === "") {
    const scale = Math.max(0.25, w / 1000);
    setVal('labelSpacing', Math.max(20, Math.round(70 / scale)));
    setVal('maxPeakLabels', Math.max(4, Math.round(30 * scale)));
  }

  const isOcean = prefix === "";
  const wrapper = document.getElementById(isOcean ? 'plot-wrapper' : 'xy-plot-wrapper');
  if (wrapper && wrapper.data) {
    if (isOcean && typeof plotSpectrum === 'function') plotSpectrum();
    else if (!isOcean && typeof plotXY === 'function') plotXY();
  }
}
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }

/* ---------- FONT FAMILIES ---------- */
const FONT_FAMILIES = {
  times: "'Times New Roman', Times, serif",
  arial: "Arial, Helvetica, sans-serif",
  helvetica: "Helvetica, Arial, sans-serif",
  calibri: "Calibri, Candara, 'Segoe UI', sans-serif",
  cambria: "Cambria, Georgia, serif",
  georgia: "Georgia, 'Times New Roman', serif",
  liberation_serif: "'Liberation Serif', 'Times New Roman', serif",
  liberation_sans: "'Liberation Sans', Arial, sans-serif",
  cmu: "'CMU Serif', 'Latin Modern Roman', 'Times New Roman', serif"
};

function resolveFont(prefix, boldCheckboxId) {
  const key = $val(fid(prefix, 'FontFamily'), 'auto');
  const bold = $chk(boldCheckboxId, false);
  const base = (!key || key === 'auto') ? 'Georgia, serif' : (FONT_FAMILIES[key] || 'Georgia, serif');
  // Plotly's font objects (tickfont, legend.font) have no weight property, so bold is
  // simulated with a heavier face — this used to only kick in for "Auto", silently
  // ignoring the Bold checkbox whenever a specific family was chosen. Now it always applies.
  return bold ? ('Arial Black, ' + base) : base;
}

/* True bold via Plotly's rich-text tag support (works regardless of font family) —
   used for Title/Axis Labels, which are single strings we fully control. Left alone
   if the text contains LaTeX ($...$), since wrapping risks confusing MathJax. */
function boldWrapText(text, boldChecked) {
  if (!boldChecked || !text || text.includes('$')) return text;
  return `<b>${text}</b>`;
}

/* ---------- unicode superscript for scale-divisor axis suffixes ---------- */
const SUPERSCRIPTS = { '-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹' };
function toSuperscript(n) { return String(n).split('').map(c => SUPERSCRIPTS[c] || c).join(''); }

function scaleDivisorSuffix(divisor) {
  if (!divisor || divisor === 1) return "";
  const exp = Math.log10(divisor);
  if (Number.isInteger(exp)) return ` (×10${toSuperscript(exp)})`;
  return ` (÷${divisor})`;
}

function getYDivisor(prefix) {
  const v = parseFloat($val(fid(prefix, 'YDivisor'), 1));
  return (!v || v <= 0) ? 1 : v;
}

/* ---------- AXIS EXTRAS: frame, grid, minor ticks, notation, zero-line, standoff ---------- */
function computeAxisExtras(prefix, axis /* 'x' | 'y' */) {
  const AX = axis === 'x' ? 'X' : 'Y';
  const frame = $val(fid(prefix, AX + 'Frame'), 'both'); // none | one | both
  const showline = frame !== "none";
  const mirror = frame === "both";

  const showgrid = $chk(fid(prefix, AX + 'Grid'), true);
  const gridcolor = $val(fid(prefix, 'GridColor'), '#e5e7eb');

  const minorOn = $chk(fid(prefix, AX + 'MinorTicks'), false);
  const minor = minorOn ? { ticks: 'outside', ticklen: 3, showgrid: false } : undefined;

  const zeroline = $chk(fid(prefix, AX + 'ZeroLine'), false);

  const notation = $val(fid(prefix, AX + 'Notation'), 'auto');
  // Plotly's exponentformat/showexponent only *restyle* an exponent Plotly has already
  // decided to use on its own (which for everyday Raman-intensity magnitudes — hundreds
  // to low thousands — it never does). To actually force a notation regardless of
  // magnitude we also need an explicit tickformat.
  let exponentformat, showexponent, tickformat;
  if (notation === 'power')      { tickformat = '.2~e'; exponentformat = 'power'; showexponent = 'all'; }
  else if (notation === 'si')    { tickformat = '.3~s'; exponentformat = 'SI';    showexponent = 'all'; }
  else if (notation === 'plain') { tickformat = ',~r';  exponentformat = 'none';  showexponent = 'none'; }
  else if (notation === 'e')     { tickformat = '.2~e'; exponentformat = 'e';     showexponent = 'all'; }
  // 'auto' -> leave everything undefined, Plotly's default behaviour

  const standoffRaw = $val(fid(prefix, AX + 'Standoff'), '');
  const standoff = standoffRaw !== "" ? parseFloat(standoffRaw) : undefined;

  const ticks = $val(fid(prefix, 'TickDir'), 'outside');

  return {
    showline, mirror, linewidth: 2,
    showgrid, gridcolor, gridwidth: 1,
    zeroline, zerolinecolor: '#94a3b8', zerolinewidth: 1.2,
    minor, ticks, standoff, exponentformat, showexponent, tickformat
  };
}

function getManualYRange(prefix) {
  const minV = $val(fid(prefix, 'Ymin'), "");
  const maxV = $val(fid(prefix, 'Ymax'), "");
  if (minV !== "" && maxV !== "") return [parseFloat(minV), parseFloat(maxV)];
  return undefined;
}

/* ═══════════════════════════════════════════════════════════
   INSET PLOTS — zoom into a specific X-range and render it as a
   mini plot docked inside the main figure (via a second x/y axis
   pair placed at a paper-fraction domain), with an optional
   shaded "source region" highlight on the main plot.
═══════════════════════════════════════════════════════════ */
function buildInset(prefix, cleanTraces) {
  const empty = { traces: [], xaxis2: null, yaxis2: null, shapes: [], annotations: [] };
  const on = $chk(fid(prefix, 'InsetOn'), false);
  if (!on) return empty;

  const xminRaw = $val(fid(prefix, 'InsetXmin'), "");
  const xmaxRaw = $val(fid(prefix, 'InsetXmax'), "");
  const xmin = xminRaw !== "" ? parseFloat(xminRaw) : undefined;
  const xmax = xmaxRaw !== "" ? parseFloat(xmaxRaw) : undefined;

  const x0 = parseFloat($val(fid(prefix, 'InsetX0'), 0.55));
  const y0 = parseFloat($val(fid(prefix, 'InsetY0'), 0.55));
  const w  = Math.max(0.1, parseFloat($val(fid(prefix, 'InsetW'), 0.38)));
  const h  = Math.max(0.1, parseFloat($val(fid(prefix, 'InsetH'), 0.38)));
  const border = $chk(fid(prefix, 'InsetBorder'), true);
  const bg = $val(fid(prefix, 'InsetBg'), '#ffffff');
  const title = $val(fid(prefix, 'InsetTitle'), '');
  const highlight = $chk(fid(prefix, 'InsetHighlight'), true);

  const insetTraces = [];
  cleanTraces.forEach(t => {
    if (t.isGuide || t.isPeakMarker || t.isCommonLegend || t.isInsetClone || t.xaxis === 'x2' || !Array.isArray(t.x) || !Array.isArray(t.y)) return;
    const ix = [], iy = [];
    for (let i = 0; i < t.x.length; i++) {
      const xv = t.x[i];
      if (xv === null || xv === undefined) continue;
      if (xmin !== undefined && xv < xmin) continue;
      if (xmax !== undefined && xv > xmax) continue;
      ix.push(xv); iy.push(t.y[i]);
    }
    if (!ix.length) return;
    const clone = Object.assign({}, t, { x: ix, y: iy, xaxis: 'x2', yaxis: 'y2', showlegend: false, hoverinfo: 'skip', isInsetClone: true, meta: undefined });
    delete clone.error_x; delete clone.error_y;
    insetTraces.push(clone);
  });

  const shapes = [];
  if (border) {
    shapes.push({
      type: 'rect', xref: 'paper', yref: 'paper',
      x0, x1: x0 + w, y0, y1: y0 + h,
      line: { color: '#334155', width: 1 }, fillcolor: bg, layer: 'below'
    });
  }
  if (highlight && xmin !== undefined && xmax !== undefined) {
    shapes.push({
      type: 'rect', xref: 'x', yref: 'paper',
      x0: xmin, x1: xmax, y0: 0, y1: 1,
      fillcolor: 'rgba(37,99,235,0.07)', line: { width: 0 }, layer: 'below'
    });
  }

  const xaxis2 = {
    domain: [x0, x0 + w], anchor: 'y2',
    range: (xmin !== undefined && xmax !== undefined) ? [xmin, xmax] : undefined,
    showgrid: false, zeroline: false, tickfont: { size: 9 },
    ticks: 'outside', showline: true, mirror: true, linewidth: 1
  };
  const yaxis2 = {
    domain: [y0, y0 + h], anchor: 'x2',
    showgrid: false, zeroline: false, tickfont: { size: 9 },
    ticks: 'outside', showline: true, mirror: true, linewidth: 1
  };

  const annotations = [];
  if (title) {
    annotations.push({
      xref: 'paper', yref: 'paper', x: x0 + w / 2, y: y0 + h + 0.02,
      text: title, showarrow: false, font: { size: 10 }, xanchor: 'center', yanchor: 'bottom'
    });
  }

  return { traces: insetTraces, xaxis2, yaxis2, shapes, annotations };
}

/* ---------- Scale bar: a real, data-accurate size indicator ----------
   The bar's *length* is drawn against the real Y axis (yref:'y'), so a
   "500" bar is genuinely 500 intensity units tall relative to the plotted
   data — not a decorative line with an arbitrary label. Horizontal
   placement stays in paper-fraction coordinates since that's just "where",
   not "how long". */
function buildScaleBarShapesAndAnnotations(prefix, cleanTraces) {
  const on = $chk(fid(prefix, 'ScaleBarOn'), false);
  if (!on) return { shapes: [], annotations: [] };

  const len = parseFloat($val(fid(prefix, 'ScaleBarLen'), 100)) || 100;
  const labelOverride = $val(fid(prefix, 'ScaleBarLabel'), '');
  const label = labelOverride || String(len);
  const x0 = parseFloat($val(fid(prefix, 'ScaleBarX'), 0.05));
  const yFrac = Math.min(0.95, Math.max(0, parseFloat($val(fid(prefix, 'ScaleBarY'), 0.1))));

  // Figure out the real Y-data range so the bar is proportionally correct —
  // prefer the user's manual Y min/max (that's what will actually render),
  // otherwise fall back to the extent of the plotted data (close to what
  // Plotly's autorange will pick).
  const manualRange = getManualYRange(prefix);
  let yMin, yMax;
  if (manualRange) {
    [yMin, yMax] = manualRange;
  } else if (Array.isArray(cleanTraces) && cleanTraces.length) {
    let lo = Infinity, hi = -Infinity;
    cleanTraces.forEach(t => {
      if (t.isGuide || t.isPeakMarker || t.isCommonLegend || t.isInsetClone || !Array.isArray(t.y)) return;
      t.y.forEach(v => { if (typeof v === 'number' && isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } });
    });
    if (isFinite(lo) && isFinite(hi) && hi > lo) { yMin = lo; yMax = hi; }
  }
  if (yMin === undefined) { yMin = 0; yMax = len * 10; } // safe fallback if there's no data yet

  const barBase = yMin + yFrac * (yMax - yMin);
  const barTop = barBase + len;

  const shapes = [{
    type: 'line', xref: 'paper', yref: 'y',
    x0, x1: x0, y0: barBase, y1: barTop,
    line: { color: '#111', width: 2.5 }
  }];
  const annotations = [{
    x: x0 + 0.015, y: (barBase + barTop) / 2, xref: 'paper', yref: 'y',
    text: label, showarrow: false, xanchor: 'left', yanchor: 'middle', font: { size: 11, color: '#111' }
  }];
  return { shapes, annotations };
}

/* ═══════════════════════════════════════════════════════════
   TIFF EXPORT (baseline, uncompressed RGB) — no external deps
═══════════════════════════════════════════════════════════ */
function buildUncompressedTIFF(width, height, rgbaData, dpi) {
  const pixelDataOffset = 8;
  const pixelDataLen = width * height * 3;
  const bpsOffset = pixelDataOffset + pixelDataLen;
  const xResOffset = bpsOffset + 6;
  const yResOffset = xResOffset + 8;
  const ifdOffset = yResOffset + 8;
  const entries = [
    [256, 4, 1, width],
    [257, 4, 1, height],
    [258, 3, 3, bpsOffset],
    [259, 3, 1, 1],
    [262, 3, 1, 2],
    [273, 4, 1, pixelDataOffset],
    [277, 3, 1, 3],
    [278, 4, 1, height],
    [279, 4, 1, pixelDataLen],
    [282, 5, 1, xResOffset],
    [283, 5, 1, yResOffset],
    [296, 3, 1, 2]
  ];
  const ifdSize = 2 + entries.length * 12 + 4;
  const total = ifdOffset + ifdSize;
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);

  dv.setUint8(0, 0x49); dv.setUint8(1, 0x49);
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifdOffset, true);

  let p = pixelDataOffset;
  for (let i = 0; i < width * height; i++) {
    u8[p++] = rgbaData[i * 4];
    u8[p++] = rgbaData[i * 4 + 1];
    u8[p++] = rgbaData[i * 4 + 2];
  }

  dv.setUint16(bpsOffset, 8, true); dv.setUint16(bpsOffset + 2, 8, true); dv.setUint16(bpsOffset + 4, 8, true);
  dv.setUint32(xResOffset, Math.round(dpi), true); dv.setUint32(xResOffset + 4, 1, true);
  dv.setUint32(yResOffset, Math.round(dpi), true); dv.setUint32(yResOffset + 4, 1, true);

  let off = ifdOffset;
  dv.setUint16(off, entries.length, true); off += 2;
  entries.forEach(([tag, type, count, value]) => {
    dv.setUint16(off, tag, true);
    dv.setUint16(off + 2, type, true);
    dv.setUint32(off + 4, count, true);
    dv.setUint32(off + 8, value, true);
    off += 12;
  });
  dv.setUint32(off, 0, true); // no next IFD

  return new Blob([u8], { type: 'image/tiff' });
}

function exportWrapperAsImage(wrapperId, filename, format, widthPx, heightPx, dpi) {
  const scale = Math.max(1, (dpi || 300) / 96);
  if (format !== 'tiff') {
    Plotly.downloadImage(wrapperId, { format, filename, width: widthPx, height: heightPx, scale });
    return;
  }
  Plotly.toImage(document.getElementById(wrapperId), { format: 'png', width: widthPx, height: heightPx, scale })
    .then(dataUrl => {
      const img = new Image();
      img.onload = function () {
        const cw = widthPx * scale, ch = heightPx * scale;
        const canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        const imgData = ctx.getImageData(0, 0, cw, ch).data;
        const blob = buildUncompressedTIFF(cw, ch, imgData, dpi || 300);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename + '.tiff'; a.click();
      };
      img.src = dataUrl;
    });
}
