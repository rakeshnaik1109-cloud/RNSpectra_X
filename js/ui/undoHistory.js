/* ═══════════════════════════════════════════════════════════
   UNDO / REDO (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z, and the ↶ ↷ buttons)
   One timeline for the whole app:
   • settings — any control changed by the user, or by a button such as
     Quick grouping or a journal preset. A step is every control that
     changed since the previous step, so one click that changes several
     boxes is undone in one go.
   • annotations — each add / move / delete / restyle of a text, arrow,
     label, line or region (annotations.js reports these via noteAnnot).
   Undoing a setting puts the old values back and redraws the plot. Loaded
   spectra themselves are not part of the history (removing a file is not
   undone). Typing inside a text box keeps the browser's own text undo.
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LIMIT = 200;
  var undoStack = [], redoStack = [];
  var last = null, suppress = false, timer = null, ready = false;
  // never part of the history: dialogs, the label-text box, file pickers
  var SKIP_ID = /^(methodsTextBox|citeApa|citeBib|annotText|xyAnnotText|projectFileInput|fileInput|xyFileInput)$/;
  // handlers that would redo their own work (apply a preset, re-tick datasets)
  var NO_REPLAY = /applyJournalPreset|setXYQuantity|openProjectFile|calibrateShift/;

  function tracked(el) {
    if (!el.id || SKIP_ID.test(el.id)) return false;
    if (el.type === 'file' || el.type === 'button' || el.type === 'submit') return false;
    if (el.hasAttribute('data-mirror')) return false;            // its source is tracked
    if (/^(ocean-pk-|pk-|xy-pk-|cmp-)/.test(el.id)) return false;   // peak-table cells are plot output, rebuilt on every plot
    if (el.closest('#methodsOverlay, #citeOverlay')) return false;
    return true;
  }
  function val(el) { return (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value; }
  function snapshot() {
    var o = {};
    document.querySelectorAll('input[id], select[id], textarea[id]').forEach(function (el) { if (tracked(el)) o[el.id] = val(el); });
    return o;
  }

  function labelOf(id) {
    var el = document.getElementById(id); if (!el) return id;
    var f = el.closest('.field'), l = f && f.querySelector('label');
    var t = (l && l.textContent) || (el.closest('label') && el.closest('label').textContent) || el.title || id;
    return t.replace(/\s+/g, ' ').trim().slice(0, 40);
  }
  function describe(step) {
    if (step.kind === 'annot') return 'annotation';
    var ids = Object.keys(step.changes);
    return labelOf(ids[0]) + (ids.length > 1 ? ' (+' + (ids.length - 1) + ' more)' : '');
  }

  // record what changed since the previous step
  function commit() {
    timer = null;
    if (!ready || suppress) return;
    var now = snapshot(), changes = {};
    Object.keys(now).forEach(function (id) {
      // controls that just appeared (a new file card) are not a change
      if (last && Object.prototype.hasOwnProperty.call(last, id) && last[id] !== now[id]) changes[id] = { from: last[id], to: now[id] };
    });
    last = now;
    if (!Object.keys(changes).length) return;
    push({ kind: 'settings', changes: changes });
  }
  function push(step) {
    undoStack.push(step); if (undoStack.length > LIMIT) undoStack.shift();
    redoStack = [];
    updateButtons();
  }
  function schedule() { if (!ready || suppress) return; clearTimeout(timer); timer = setTimeout(commit, 60); }

  function setValue(el, v) { if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!v; else el.value = v; }

  function applySettings(changes, dir) {
    suppress = true;
    var ids = Object.keys(changes), touched = [];
    ids.forEach(function (id) { var el = document.getElementById(id); if (el) { setValue(el, changes[id][dir]); touched.push(el); } });
    // let each control's own handler update the panel (show the right parameter
    // fields, linked boxes, slider read-outs) — except handlers that would redo work
    touched.forEach(function (el) {
      var ch = el.getAttribute('onchange') || '', inp = el.getAttribute('oninput') || '';
      if (ch && !NO_REPLAY.test(ch)) el.dispatchEvent(new Event('change', { bubbles: true }));
      else if (inp && !NO_REPLAY.test(inp)) el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    document.querySelectorAll('[data-mirror]').forEach(function (m) {
      var src = document.getElementById(m.getAttribute('data-mirror')); if (!src) return;
      if (m.type === 'checkbox') m.checked = src.checked; else m.value = src.value;
    });
    if (typeof updateLegendSlidersText === 'function') updateLegendSlidersText();
    if (typeof updateXYLegendSlidersText === 'function') updateXYLegendSlidersText();
    // redraw the workspace(s) whose settings changed, if they have a plot
    var inXY = touched.some(function (el) { return el.closest('#xyMode'); });
    var inOcean = touched.some(function (el) { return !el.closest('#xyMode'); });
    try {
      if (inOcean && document.getElementById('plot-wrapper').data && typeof plotSpectrum === 'function') plotSpectrum();
      if (inXY && document.getElementById('xy-plot-wrapper').data && typeof plotXY === 'function') plotXY();
    } catch (e) { /* a plot that cannot be drawn with these settings simply stays as it is */ }
    document.body.dispatchEvent(new Event('change', { bubbles: true }));   // session memory saves
    setTimeout(function () { last = snapshot(); suppress = false; }, 0);
  }

  function applyAnnot(step, state) {
    var s = JSON.parse(state);
    customAnnotations[step.mode] = s.a; customShapesStore[step.mode] = s.s;
    if (typeof annotSelection !== 'undefined') annotSelection[step.mode] = null;
    if (typeof replotCurrentMode === 'function') replotCurrentMode(step.mode);
  }
  function annotState(mode) { return JSON.stringify({ a: customAnnotations[mode], s: customShapesStore[mode] }); }

  function undo() {
    commit();                                   // a pending change counts as the latest step
    var step = undoStack.pop();
    if (!step) { rxNotify('Nothing to undo'); return; }
    if (step.kind === 'annot') { step.after = annotState(step.mode); applyAnnot(step, step.before); }
    else applySettings(step.changes, 'from');
    redoStack.push(step); updateButtons();
    rxNotify('↶ Undone: ' + describe(step));
  }
  function redo() {
    var step = redoStack.pop();
    if (!step) { rxNotify('Nothing to redo'); return; }
    if (step.kind === 'annot') applyAnnot(step, step.after);
    else applySettings(step.changes, 'to');
    undoStack.push(step); updateButtons();
    rxNotify('↷ Redone: ' + describe(step));
  }

  function updateButtons() {
    var u = document.getElementById('rxUndoBtn'), r = document.getElementById('rxRedoBtn');
    if (u) { u.disabled = !undoStack.length; u.title = undoStack.length ? 'Undo: ' + describe(undoStack[undoStack.length - 1]) + ' (Ctrl+Z)' : 'Nothing to undo (Ctrl+Z)'; }
    if (r) { r.disabled = !redoStack.length; r.title = redoStack.length ? 'Redo: ' + describe(redoStack[redoStack.length - 1]) + ' (Ctrl+Y)' : 'Nothing to redo (Ctrl+Y)'; }
  }

  window.rxUndo = undo;
  window.rxRedo = redo;
  window.rxHistory = {
    // annotations.js calls this with the state *before* each annotation change
    noteAnnot: function (mode, before) { if (!suppress) push({ kind: 'annot', mode: mode, before: before }); },
    // a fresh start (after opening a project)
    reset: function () { undoStack = []; redoStack = []; last = snapshot(); updateButtons(); },
    size: function () { return { undo: undoStack.length, redo: redoStack.length }; },
    // what each step holds, newest last (for checking)
    list: function () { return undoStack.map(function (st) { return st.kind === 'annot' ? 'annotation' : Object.keys(st.changes).map(function (id) { return id + ': ' + st.changes[id].from + ' → ' + st.changes[id].to; }).join('; '); }); }
  };

  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    var k = (e.key || '').toLowerCase();
    if (k !== 'z' && k !== 'y') return;
    var t = e.target, tag = (t.tagName || '').toLowerCase();
    // inside a text box the browser's own text undo applies
    if (t.isContentEditable || tag === 'textarea' || (tag === 'input' && /^(text|search|email|url|number|tel|password)$/.test(t.type))) return;
    e.preventDefault();
    if (k === 'y' || (k === 'z' && e.shiftKey)) redo(); else undo();
  });

  document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('change', schedule, true);
    document.addEventListener('click', function () { setTimeout(schedule, 0); });   // after the button's own work
    // the ↶ ↷ buttons in the layout bar, before Reset
    var reset = document.querySelector('#layoutToolbar .layout-reset-btn');
    if (reset) {
      reset.insertAdjacentHTML('beforebegin',
        '<button class="rx-hist-btn" id="rxUndoBtn" onclick="rxUndo()" disabled>↶ Undo</button>' +
        '<button class="rx-hist-btn" id="rxRedoBtn" onclick="rxRedo()" disabled>↷ Redo</button>');
    }
    // start recording once the saved session has been restored
    setTimeout(function () { last = snapshot(); ready = true; updateButtons(); }, 300);
  });
})();
