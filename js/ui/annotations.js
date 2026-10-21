/* ═══════════════════════════════════════════════════════════
   FIGURE ANNOTATIONS — text, arrows, point labels, marker lines,
   shaded regions and drawn shapes, for both workspaces.

   renderCanvasTracesAndLayout() rebuilds layout.annotations/shapes on every
   render (peak labels, scale bar, inset …), so the user's own items are kept
   here and appended after the generated ones; genCounts[mode] records where
   the user's items start in the live plot. After every drag, edit, draw or
   erase the live plot is read back (bindAnnotationSync) so changes survive
   the next replot.

   Editing: click an item to select it (highlighted) → Delete / Backspace or
   "Delete" removes only that item; Duplicate and Apply style act on it too.
   Ctrl/Cmd+Z undoes the last change. Esc cancels point-labelling or the
   selection.
═══════════════════════════════════════════════════════════ */
let customAnnotations = { ocean: [], xy: [] };
let customShapesStore = { ocean: [], xy: [] };
const annotGenCounts = { ocean: { ann: 0, shp: 0 }, xy: { ann: 0, shp: 0 } };
const annotSelection = { ocean: null, xy: null };     // { kind: 'ann'|'shape', i }
const annotHistory = { ocean: [], xy: [] };
const annotPickMode = { ocean: false, xy: false };    // waiting for a click to label a point

function annotFieldId(mode, name) { return mode === 'ocean' ? 'annot' + name : 'xyAnnot' + name; }
function annotWrapper(mode) { return document.getElementById(mode === 'ocean' ? 'plot-wrapper' : 'xy-plot-wrapper'); }

// Re-render using the current traces (fast; no reprocessing). Falls back to a
// full plot when nothing has been plotted yet.
function replotCurrentMode(mode) {
  const w = annotWrapper(mode);
  if (w && w.data && typeof triggerInteractiveReplotStyleOnly === 'function') return triggerInteractiveReplotStyleOnly(mode);
  if (mode === 'ocean' && typeof plotSpectrum === 'function') plotSpectrum();
  else if (mode === 'xy' && typeof plotXY === 'function') plotXY();
}

/* ---------- undo ---------- */
function annotSnapshot(mode) {
  const h = annotHistory[mode];
  h.push(JSON.stringify({ a: customAnnotations[mode], s: customShapesStore[mode] }));
  if (h.length > 60) h.shift();
}
function undoAnnotation(mode) {
  const h = annotHistory[mode];
  if (!h.length) { rxNotify('Nothing to undo'); return; }
  const prev = JSON.parse(h.pop());
  customAnnotations[mode] = prev.a; customShapesStore[mode] = prev.s;
  annotSelection[mode] = null;
  replotCurrentMode(mode);
}

/* ---------- style from the toolbar ---------- */
function annotStyle(mode) {
  const familyKey = $val(annotFieldId(mode, 'FontFamily'), 'auto');
  return {
    color: $val(annotFieldId(mode, 'Color'), '#dc2626'),
    family: familyKey !== 'auto' ? (FONT_FAMILIES[familyKey] || 'Georgia, serif') : 'Georgia, serif',
    size: parseFloat($val(annotFieldId(mode, 'FontSize'), 13)) || 13,
    bold: $chk(annotFieldId(mode, 'Bold'), false),
    italic: $chk(annotFieldId(mode, 'Italic'), false),
    filled: $val(annotFieldId(mode, 'BoxStyle'), 'filled') !== 'transparent'
  };
}
function annotFont(st) {
  // real bold / italic of the chosen family (Plotly ≥ 2.33 font.weight / font.style)
  return { size: st.size, color: st.color, family: st.family, weight: st.bold ? 'bold' : 'normal', style: st.italic ? 'italic' : 'normal' };
}
function annotBox(st) {
  return { bgcolor: st.filled ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0)', bordercolor: st.filled ? st.color : 'rgba(0,0,0,0)', borderwidth: st.filled ? 1 : 0, borderpad: 4 };
}

/* ---------- add ---------- */
function addTextAnnotation(mode) {
  const st = annotStyle(mode);
  const typed = ($val(annotFieldId(mode, 'Text'), '') || '').trim();
  const n = customAnnotations[mode].length;
  annotSnapshot(mode);
  customAnnotations[mode].push(Object.assign({
    x: 0.5, y: 0.92 - (n % 6) * 0.07, xref: 'paper', yref: 'paper',
    text: typed || 'Double-click to edit', showarrow: false, font: annotFont(st)
  }, annotBox(st)));
  annotSelection[mode] = { kind: 'ann', i: customAnnotations[mode].length - 1 };
  replotCurrentMode(mode);
}

function addArrowAnnotation(mode) {
  const st = annotStyle(mode);
  const typed = ($val(annotFieldId(mode, 'Text'), '') || '').trim();
  const n = customAnnotations[mode].length;
  annotSnapshot(mode);
  customAnnotations[mode].push({
    x: 0.5, y: 0.5 - (n % 6) * 0.06, xref: 'paper', yref: 'paper',
    ax: 40, ay: -40, axref: 'pixel', ayref: 'pixel',
    text: typed, showarrow: true, arrowhead: 2, arrowsize: 1.2, arrowwidth: 2, arrowcolor: st.color, font: annotFont(st)
  });
  annotSelection[mode] = { kind: 'ann', i: customAnnotations[mode].length - 1 };
  replotCurrentMode(mode);
}

// 📍 the next click on a curve places a labelled arrow at that data point
function startPointLabel(mode) {
  const w = annotWrapper(mode);
  if (!w || !w.data) { alert('Plot something first, then click 📍 and click a point on a curve.'); return; }
  annotPickMode[mode] = !annotPickMode[mode];
  const btn = document.getElementById(annotFieldId(mode, 'PickBtn'));
  if (btn) btn.classList.toggle('is-armed', annotPickMode[mode]);
  if (annotPickMode[mode]) rxNotify('Click a point on a curve to label it (Esc to cancel)');
}

function formatAxisValue(mode, v) {
  if (!Number.isFinite(v)) return String(v);
  if (mode === 'ocean') return Math.round(v) + ' cm⁻¹';
  return String(+v.toPrecision(5));
}

function labelPoint(mode, pt) {
  const st = annotStyle(mode);
  const xref = (pt.xaxis && pt.xaxis._id) || 'x', yref = (pt.yaxis && pt.yaxis._id) || 'y';
  annotSnapshot(mode);
  customAnnotations[mode].push(Object.assign({
    x: pt.x, y: pt.y, xref, yref, text: formatAxisValue(mode, pt.x),
    showarrow: true, arrowhead: 2, arrowsize: 1, arrowwidth: 1.5, arrowcolor: st.color, ax: 0, ay: -42,
    font: annotFont(st)
  }, annotBox(Object.assign({}, st, { filled: st.filled }))));
  annotSelection[mode] = { kind: 'ann', i: customAnnotations[mode].length - 1 };
  annotPickMode[mode] = false;
  document.getElementById(annotFieldId(mode, 'PickBtn'))?.classList.remove('is-armed');
  replotCurrentMode(mode);
}

function parseXList(s) {
  // accepts "1004, 1450", "1600 1700" and ranges such as "1600-1700" or "1600–1700"
  return String(s || '').replace(/(\d)\s*[-–—]\s*(?=\d)/g, '$1 ').split(/[,;\s]+/).filter(t => t !== '').map(Number).filter(Number.isFinite);
}

// ┆ dashed vertical line(s) at given X, each labelled at the top
function addMarkerLines(mode) {
  const v = prompt(mode === 'ocean' ? 'Marker line(s) at Raman shift (cm⁻¹), e.g. 1004, 1450, 1655' : 'Marker line(s) at X, e.g. 528, 640');
  const xs = parseXList(v); if (!xs.length) return;
  const st = annotStyle(mode);
  annotSnapshot(mode);
  xs.forEach(x => {
    customShapesStore[mode].push({ type: 'line', xref: 'x', yref: 'paper', x0: x, x1: x, y0: 0, y1: 1, line: { color: st.color, width: 1.5, dash: 'dash' }, layer: 'above' });
    customAnnotations[mode].push({ x, y: 1, xref: 'x', yref: 'paper', yanchor: 'bottom', text: formatAxisValue(mode, x), showarrow: false, font: annotFont(Object.assign({}, st, { size: Math.max(8, st.size - 2) })) });
  });
  replotCurrentMode(mode);
}

// ▥ translucent band between two X values, labelled at the top
function addShadedRegion(mode) {
  const v = prompt(mode === 'ocean' ? 'Shade region from–to (cm⁻¹), e.g. 1600 1700' : 'Shade region from–to (X), e.g. 500 560');
  const xs = parseXList(v); if (xs.length < 2) return;
  const [x0, x1] = [Math.min(xs[0], xs[1]), Math.max(xs[0], xs[1])];
  const label = (prompt('Label for the region (optional), e.g. Amide I', '') || '').trim();
  const st = annotStyle(mode);
  annotSnapshot(mode);
  customShapesStore[mode].push({ type: 'rect', xref: 'x', yref: 'paper', x0, x1, y0: 0, y1: 1, fillcolor: hexToRgba(st.color, 0.15), line: { width: 0 }, layer: 'below' });
  if (label) customAnnotations[mode].push({ x: (x0 + x1) / 2, y: 1, xref: 'x', yref: 'paper', yanchor: 'bottom', text: label, showarrow: false, font: annotFont(st) });
  replotCurrentMode(mode);
}

// insert a symbol at the caret of the toolbar's text field
function insertAnnotSymbol(mode, sel) {
  const sym = sel.value; sel.selectedIndex = 0; if (!sym) return;
  const box = document.getElementById(annotFieldId(mode, 'Text')); if (!box) return;
  const a = box.selectionStart ?? box.value.length, b = box.selectionEnd ?? box.value.length;
  box.value = box.value.slice(0, a) + sym + box.value.slice(b);
  box.focus(); box.selectionStart = box.selectionEnd = a + sym.length;
}

/* ---------- selected item: delete / duplicate / restyle ---------- */
function currentSelection(mode) {
  // a shape the user clicked in Plotly (active shape) takes precedence
  const w = annotWrapper(mode), act = w && w._fullLayout ? w._fullLayout._activeShapeIndex : undefined;
  if (act !== undefined && act !== null && act >= annotGenCounts[mode].shp) return { kind: 'shape', i: act - annotGenCounts[mode].shp };
  return annotSelection[mode];
}

function deleteSelectedAnnotation(mode) {
  const sel = currentSelection(mode);
  if (!sel) { rxNotify('Click a text, arrow or shape on the plot first, then Delete'); return; }
  annotSnapshot(mode);
  if (sel.kind === 'ann') customAnnotations[mode].splice(sel.i, 1);
  else customShapesStore[mode].splice(sel.i, 1);
  annotSelection[mode] = null;
  replotCurrentMode(mode);
}

function duplicateSelectedAnnotation(mode) {
  const sel = currentSelection(mode);
  if (!sel) { rxNotify('Select an item on the plot first'); return; }
  annotSnapshot(mode);
  if (sel.kind === 'ann') {
    const a = JSON.parse(JSON.stringify(customAnnotations[mode][sel.i]));
    if (a.xref === 'paper') { a.x = Math.min(0.98, a.x + 0.03); a.y = Math.max(0.02, a.y - 0.04); }
    else if (a.showarrow) { a.ay = (a.ay || -40) - 24; }
    customAnnotations[mode].push(a);
    annotSelection[mode] = { kind: 'ann', i: customAnnotations[mode].length - 1 };
  } else {
    const s = JSON.parse(JSON.stringify(customShapesStore[mode][sel.i]));
    if (s.xref === 'paper') { s.x0 += 0.03; s.x1 += 0.03; }
    customShapesStore[mode].push(s);
  }
  replotCurrentMode(mode);
}

function applyStyleToSelected(mode) {
  const sel = currentSelection(mode);
  if (!sel) { rxNotify('Select an item on the plot first'); return; }
  const st = annotStyle(mode);
  annotSnapshot(mode);
  if (sel.kind === 'ann') {
    const a = customAnnotations[mode][sel.i];
    a.font = annotFont(st);
    if (a.showarrow) a.arrowcolor = st.color;
    if (a.text) Object.assign(a, annotBox(st));
    const typed = ($val(annotFieldId(mode, 'Text'), '') || '').trim();
    if (typed && a.text) a.text = typed;
  } else {
    const s = customShapesStore[mode][sel.i];
    s.line = Object.assign({}, s.line, { color: st.color });
    if (s.type === 'rect' && s.fillcolor) s.fillcolor = hexToRgba(st.color, 0.15);
  }
  replotCurrentMode(mode);
}

function clearCustomAnnotations(mode) {
  if (!customAnnotations[mode].length && !customShapesStore[mode].length) return;
  if (!confirm('Remove all text, arrows, labels, lines, regions and shapes you added to this plot? (Undo can bring them back.)')) return;
  annotSnapshot(mode);
  customAnnotations[mode] = [];
  customShapesStore[mode] = [];
  annotSelection[mode] = null;
  replotCurrentMode(mode);
}

/* ---------- selection highlight (DOM only; never stored in the figure) ---------- */
function highlightSelection(mode) {
  const w = annotWrapper(mode); if (!w) return;
  w.querySelectorAll('.rx-ann-selected').forEach(el => el.classList.remove('rx-ann-selected'));
  const sel = annotSelection[mode];
  const status = document.getElementById(annotFieldId(mode, 'SelStatus'));
  if (!sel || sel.kind !== 'ann' || !customAnnotations[mode][sel.i]) { if (status) status.textContent = ''; return; }
  const idx = annotGenCounts[mode].ann + sel.i;
  w.querySelectorAll(`.annotation[data-index="${idx}"]`).forEach(el => el.classList.add('rx-ann-selected'));
  if (status) {
    const a = customAnnotations[mode][sel.i];
    const what = a.text ? `“${String(a.text).replace(/<[^>]+>/g, '').slice(0, 24)}”` : 'arrow';
    status.textContent = `Selected: ${what}`;
  }
}

/* Re-bind on every render (Plotly.purge() creates a fresh event emitter each
   time). genAnnCount/genShapeCount mark where the user's items begin. */
function bindAnnotationSync(gd, mode, genAnnCount, genShapeCount) {
  if (!gd || !gd.on) return;
  annotGenCounts[mode] = { ann: genAnnCount, shp: genShapeCount };
  gd.on('plotly_relayout', function (ev) {
    try {
      // only record a change that touched annotations or shapes
      const keys = Object.keys(ev || {});
      if (keys.length && !keys.some(k => /^(annotations|shapes)/.test(k))) return;
      const allAnn = (gd.layout && gd.layout.annotations) || [];
      const allShp = (gd.layout && gd.layout.shapes) || [];
      const nextA = allAnn.slice(genAnnCount).map(a => Object.assign({}, a));
      const nextS = allShp.slice(genShapeCount).map(s => Object.assign({}, s));
      if (JSON.stringify(nextA) === JSON.stringify(customAnnotations[mode]) && JSON.stringify(nextS) === JSON.stringify(customShapesStore[mode])) return;
      annotSnapshot(mode);
      customAnnotations[mode] = nextA;
      customShapesStore[mode] = nextS;
      if (annotSelection[mode] && annotSelection[mode].kind === 'ann' && !customAnnotations[mode][annotSelection[mode].i]) annotSelection[mode] = null;
      highlightSelection(mode);
    } catch (e) { /* ignore */ }
  });
  gd.on('plotly_clickannotation', function (ev) {
    const i = ev.index - genAnnCount;
    annotSelection[mode] = i >= 0 ? { kind: 'ann', i } : null;
    highlightSelection(mode);
  });
  gd.on('plotly_click', function (ev) {
    if (annotPickMode[mode] && ev && ev.points && ev.points.length) labelPoint(mode, ev.points[0]);
  });
  highlightSelection(mode);
}

/* ---------- keyboard: Delete, Ctrl/Cmd+Z, Esc ---------- */
document.addEventListener('keydown', function (e) {
  const t = e.target, tag = (t.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
  const mode = (typeof currentMode !== 'undefined') ? currentMode : 'ocean';
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
    if (annotHistory[mode].length) { e.preventDefault(); undoAnnotation(mode); }
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && currentSelection(mode)) { e.preventDefault(); deleteSelectedAnnotation(mode); return; }
  if (e.key === 'Escape') {
    if (annotPickMode[mode]) { annotPickMode[mode] = false; document.getElementById(annotFieldId(mode, 'PickBtn'))?.classList.remove('is-armed'); }
    if (annotSelection[mode]) { annotSelection[mode] = null; highlightSelection(mode); }
  }
});

/* ---------- toolbar (built once for each workspace) ---------- */
function buildAnnotToolbar(mode) {
  const bar = document.getElementById(mode === 'ocean' ? 'oceanAnnotToolbar' : 'xyAnnotToolbar'); if (!bar) return;
  const id = n => annotFieldId(mode, n), m = `'${mode}'`;
  const sel = 'font-size:12px;padding:4px 6px;border-radius:6px;border:1px solid var(--border);';
  const SYMBOLS = ['cm⁻¹', '⁻¹', '²', '³', '°', '±', '×', '·', 'µ', 'λ', 'Δ', 'σ', 'θ', 'α', 'β', 'γ', 'ν', 'π', 'Ω', 'Å', '→', '←', '↑', '↓', '≈', '≤', '≥', '∞', '<sub>…</sub>', '<sup>…</sup>'];
  // one row of everyday actions; symbols, marker lines, regions, styling and
  // Clear all sit in the "More" row, opened with ⋯ More (remembered per browser)
  let moreOpen = false; try { moreOpen = localStorage.getItem('rnspx_annot_more') === '1'; } catch (e) {}
  bar.innerHTML = `
    <div class="annot-row">
      <input type="text" id="${id('Text')}" placeholder="Label text (optional)" title="Text used by 🅣 Text and ↗ Arrow. Supports <b>bold</b>, <i>italic</i>, H<sub>2</sub>O, cm<sup>-1</sup>." style="${sel}min-width:140px;flex:1 1 140px;">
      <button class="btn btn-outline btn-sm" onclick="addTextAnnotation(${m})" title="Add a draggable text box">🅣 Text</button>
      <button class="btn btn-outline btn-sm" onclick="addArrowAnnotation(${m})" title="Add a draggable arrow (drag the head or tail)">↗ Arrow</button>
      <button class="btn btn-outline btn-sm" id="${id('PickBtn')}" onclick="startPointLabel(${m})" title="Then click a point on a curve: an arrow with its X value is placed there, pinned to the data">📍 Label point</button>
      <span class="annot-sep"></span>
      <button class="btn btn-outline btn-sm" onclick="deleteSelectedAnnotation(${m})" title="Delete the selected item (or press Delete)">🗑 Delete</button>
      <button class="btn btn-outline btn-sm" onclick="undoAnnotation(${m})" title="Undo (Ctrl/Cmd+Z)">↶ Undo</button>
      <button class="btn btn-outline btn-sm annot-more-btn${moreOpen ? ' is-armed' : ''}" id="${id('MoreBtn')}" onclick="toggleAnnotMore(${m})" aria-expanded="${moreOpen}" title="Symbols, marker lines, shaded regions, font and colour, duplicate, clear all">⋯ More</button>
      <span id="${id('SelStatus')}" class="annot-status"></span>
    </div>
    <div class="annot-more" id="${id('MoreRow')}"${moreOpen ? '' : ' hidden'}>
      <div class="annot-row">
        <select title="Insert a symbol into the label text" onchange="insertAnnotSymbol(${m}, this)" style="${sel}width:auto;"><option value="">Ω Symbol</option>${SYMBOLS.map(s => `<option value="${s.replace(/…/, '').replace(/"/g, '&quot;')}">${s.replace(/</g, '&lt;')}</option>`).join('')}</select>
        <button class="btn btn-outline btn-sm" onclick="addMarkerLines(${m})" title="Dashed vertical line(s) at X values you type, each labelled">┆ Marker line</button>
        <button class="btn btn-outline btn-sm" onclick="addShadedRegion(${m})" title="Translucent band between two X values (e.g. a spectral region)">▥ Region</button>
        <button class="btn btn-outline btn-sm" onclick="duplicateSelectedAnnotation(${m})" title="Copy the selected item">⧉ Duplicate</button>
        <button class="btn btn-secondary btn-sm" onclick="clearCustomAnnotations(${m})" title="Remove everything you added">Clear all</button>
      </div>
      <div class="annot-row">
        <select id="${id('FontFamily')}" title="Font" style="${sel}">
          <option value="auto">Font: Auto</option><option value="times">Times New Roman</option><option value="arial">Arial</option><option value="helvetica">Helvetica</option><option value="calibri">Calibri</option><option value="cambria">Cambria</option><option value="georgia">Georgia</option>
        </select>
        <input type="number" id="${id('FontSize')}" value="13" min="6" max="72" title="Font size (px)" style="width:52px;${sel}">
        <label class="toggle-item" style="font-size:12px;"><input type="checkbox" id="${id('Bold')}"><b>B</b></label>
        <label class="toggle-item" style="font-size:12px;"><input type="checkbox" id="${id('Italic')}"><i>I</i></label>
        <select id="${id('BoxStyle')}" title="Text box background" style="${sel}"><option value="filled">Filled box</option><option value="transparent">No box</option></select>
        <input type="color" id="${id('Color')}" value="#dc2626" title="Colour for new items (and Apply style)">
        <button class="btn btn-outline btn-sm" onclick="applyStyleToSelected(${m})" title="Give the selected item the font, size, colour and box set here (and the text, if typed)">🎨 Apply style</button>
      </div>
      <div class="annot-hint">Click an item on the plot to select it · double-click text to edit · drag to move · <kbd>Delete</kbd> removes the selected item · <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Z</kbd> undo · <kbd>Esc</kbd> cancel · box / circle / line: ▭ ○ ╱ in the chart's toolbar</div>
    </div>`;
}

function toggleAnnotMore(mode, open) {
  const row = document.getElementById(annotFieldId(mode, 'MoreRow')), btn = document.getElementById(annotFieldId(mode, 'MoreBtn'));
  if (!row) return;
  const show = open === undefined ? row.hidden : open;
  // both workspaces follow the same choice
  ['ocean', 'xy'].forEach(md => {
    const r = document.getElementById(annotFieldId(md, 'MoreRow')), b = document.getElementById(annotFieldId(md, 'MoreBtn'));
    if (r) r.hidden = !show;
    if (b) { b.classList.toggle('is-armed', show); b.setAttribute('aria-expanded', String(show)); }
  });
  try { localStorage.setItem('rnspx_annot_more', show ? '1' : '0'); } catch (e) {}
}
document.addEventListener('DOMContentLoaded', () => { buildAnnotToolbar('ocean'); buildAnnotToolbar('xy'); });
