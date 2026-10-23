/* ═══════════════════════════════════════════════════════════
   DRAGGABLE AXIS TITLES
   Plotly cannot drag an axis title, only edit its text. So the first drag
   of an X or Y axis title turns it into a figure-anchored (paper) label at
   the dropped position; from then on it is an ordinary Plotly annotation,
   which Plotly drags, edits and exports like any other. The position is
   kept in a hidden field per axis (xTitlePos, yTitlePos, xyXTitlePos,
   xyYTitlePos: "x,y" in paper units), so the session and .rnsx projects
   remember it. Empty field = the normal axis title.
═══════════════════════════════════════════════════════════ */

function axisTitlePosId(prefix, axis) { return fid(prefix, (axis === 'x' ? 'X' : 'Y') + 'TitlePos'); }

function getAxisTitlePos(prefix, axis) {
  const v = ($val(axisTitlePosId(prefix, axis), '') || '').split(',').map(Number);
  return v.length === 2 && v.every(Number.isFinite) ? { x: v[0], y: v[1] } : null;
}

function setAxisTitlePos(prefix, axis, pos) {
  const el = document.getElementById(axisTitlePosId(prefix, axis)); if (!el) return;
  el.value = pos ? `${+pos.x.toFixed(4)},${+pos.y.toFixed(4)}` : '';
  el.dispatchEvent(new Event('change', { bubbles: true }));   // session memory
}

// Called while the layout is assembled: a moved title becomes an annotation
function applyMovedAxisTitles(layout, prefix) {
  ['x', 'y'].forEach(axis => {
    const pos = getAxisTitlePos(prefix, axis), ax = layout[axis + 'axis'];
    if (!pos || !ax || !ax.title || !ax.title.text) return;
    layout.annotations.push({
      name: 'rxAxisTitle-' + axis, text: ax.title.text, font: ax.title.font,
      xref: 'paper', yref: 'paper', x: pos.x, y: pos.y, xanchor: 'center', yanchor: 'middle',
      textangle: axis === 'y' ? -90 : 0, showarrow: false, captureevents: true
    });
    ax.title = Object.assign({}, ax.title, { text: '' });
  });
}

function resetAxisTitlePositions(mode) {
  const prefix = mode === 'ocean' ? '' : 'xy';
  setAxisTitlePos(prefix, 'x', null); setAxisTitlePos(prefix, 'y', null);
  if (typeof triggerInteractiveReplotStyleOnly === 'function') triggerInteractiveReplotStyleOnly(mode);
}

// After every render: native titles can be dragged; moved ones report back
function bindAxisTitleDrag(gd, mode) {
  if (!gd || !gd._fullLayout) return;
  const prefix = mode === 'ocean' ? '' : 'xy';
  // centre of a title box → paper units, kept so the whole title stays inside
  // the figure (anything outside would be cut off in the exported image)
  const paperPos = (b) => {
    const r = gd.getBoundingClientRect(), s = gd._fullLayout._size;
    const cx = Math.min(Math.max(b.left + b.width / 2, r.left + b.width / 2 + 2), r.right - b.width / 2 - 2);
    const cy = Math.min(Math.max(b.top + b.height / 2, r.top + b.height / 2 + 2), r.bottom - b.height / 2 - 2);
    return { x: (cx - r.left - s.l) / s.w, y: 1 - (cy - r.top - s.t) / s.h };
  };
  ['x', 'y'].forEach(axis => {
    const el = gd.querySelector(`.g-${axis}title text`);
    if (!el || getAxisTitlePos(prefix, axis)) return;
    el.style.cursor = 'move';
    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const sx = e.clientX, sy = e.clientY, base = el.getAttribute('transform') || '';
      let moved = false;
      const move = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        moved = true;
        el.setAttribute('transform', `translate(${dx},${dy}) ${base}`);
      };
      const up = ev => {
        window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
        if (!moved) return;                       // a plain click still edits the text
        // swallow the click that follows the drag so the text editor does not open
        window.addEventListener('click', ce => { ce.stopPropagation(); ce.preventDefault(); }, { capture: true, once: true });
        setAxisTitlePos(prefix, axis, paperPos(el.getBoundingClientRect()));
        triggerInteractiveReplotStyleOnly(mode);
      };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    });
  });

  // a moved title (annotation) that is dragged again or retyped
  const moved = new Set();
  gd.on('plotly_relayout', ev => {
    if (!ev) return;
    const anns = (gd.layout && gd.layout.annotations) || [];
    Object.keys(ev).forEach(k => {
      const m = k.match(/^annotations\[(\d+)\]\.(x|y|text)$/); if (!m) return;
      const a = anns[+m[1]]; if (!a || !/^rxAxisTitle-[xy]$/.test(a.name || '')) return;
      const axis = a.name.slice(-1);
      if (m[2] === 'text') {
        const box = document.getElementById(fid(prefix, axis === 'x' ? 'Xlabel' : 'Ylabel'));
        if (box) box.value = String(ev[k]).replace(/^<b>([\s\S]*)<\/b>$/, '$1');
      } else moved.add(axis);
    });
    // after the drag has been drawn, store the (kept-inside) position
    moved.forEach(axis => {
      const i = anns.findIndex(a => a && a.name === 'rxAxisTitle-' + axis);
      const g = gd.querySelector(`.annotation[data-index="${i}"]`);
      if (g) {
        const pos = paperPos(g.getBoundingClientRect()), a = anns[i];
        setAxisTitlePos(prefix, axis, pos);
        if (Math.abs(pos.x - a.x) > 1e-3 || Math.abs(pos.y - a.y) > 1e-3) triggerInteractiveReplotStyleOnly(mode);
      }
    });
    moved.clear();
  });
}
