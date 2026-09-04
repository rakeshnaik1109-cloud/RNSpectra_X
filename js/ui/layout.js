/* ═══════════════════════════════════════════════════════════
   RNSpectraX™ — layout.js  v3.0
   Professional desktop-class workspace engine
═══════════════════════════════════════════════════════════ */

const LAYOUT_KEY      = 'rnspx_layout';
const PANEL_SIZE_KEY  = 'rnspx_panel_size';
const COLLAPSED_KEY   = 'rnspx_collapsed';

const DEFAULTS = {
  layout: 'left',
  panelSize: 360,
  collapsed: false
};

let _layout    = DEFAULTS.layout;
let _panelSize = DEFAULTS.panelSize;
let _collapsed = DEFAULTS.collapsed;
let _dragging  = false;

/* ════════════════════════════════════════════════
   PUBLIC API
════════════════════════════════════════════════ */

function setWorkspaceLayout(layout) {
  _layout = layout;
  _save();
  _apply();
  _updateToolbar();
}

function toggleDockCollapse() {
  _collapsed = !_collapsed;
  _save();
  _apply();
  _updateCollapseBtn();
}

/* ════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════ */
function initWorkspaceLayout() {
  _layout    = localStorage.getItem(LAYOUT_KEY)     || DEFAULTS.layout;
  _panelSize = parseInt(localStorage.getItem(PANEL_SIZE_KEY)) || DEFAULTS.panelSize;
  _collapsed = localStorage.getItem(COLLAPSED_KEY)  === 'true';

  _injectToolbar();
  _injectResizeHandle();
  _apply();
  _updateToolbar();
  _updateCollapseBtn();
  _bindKeyboard();

  // FORCE re-calculation after the browser paints
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      _apply();
    });
  });
}
/* ════════════════════════════════════════════════
   TOOLBAR INJECTION (Cleaned up)
════════════════════════════════════════════════ */
function _injectToolbar() {
  const existing = document.getElementById('layoutToolbar');
  if (existing) { _wireToolbarButtons(); return; }

  const toolbar = document.createElement('div');
  toolbar.id = 'layoutToolbar';
  toolbar.className = 'layout-toolbar';
  toolbar.innerHTML = `
    <span class="layout-toolbar-label">Layout</span>
    <div class="layout-btn-group">
      <button class="layout-btn" data-layout="left" title="Left">Left</button>
      <button class="layout-btn" data-layout="right" title="Right">Right</button>
      <button class="layout-btn" data-layout="top" title="Top">Top</button>
      <button class="layout-btn" data-layout="bottom" title="Bottom">Bottom</button>
    </div>
    <div class="layout-divider"></div>
    <button class="layout-collapse-btn" id="collapseBtn" onclick="toggleDockCollapse()">
      <span id="collapseBtnIcon">◀</span> <span id="collapseBtnLabel">Collapse</span>
    </button>
    <button class="layout-reset-btn" onclick="_resetLayout()" title="Reset to defaults">↺ Reset</button>
  `;

  const shell = document.querySelector('.app-shell');
  if (shell) shell.prepend(toolbar);
  _wireToolbarButtons();
}

function _wireToolbarButtons() {
  document.querySelectorAll('#layoutToolbar .layout-btn').forEach(btn => {
    btn.onclick = function() { setWorkspaceLayout(this.getAttribute('data-layout')); };
  });
}

/* ════════════════════════════════════════════════
   RESIZE & CORE ENGINE
════════════════════════════════════════════════ */
function _injectResizeHandle() {
  if (document.getElementById('rnspxResizer')) return;
  const resizer = document.createElement('div');
  resizer.id = 'rnspxResizer';
  resizer.className = 'workspace-resizer';
  const ws = _getWorkspace();
  if (ws) ws.appendChild(resizer);
  _bindResizer(resizer);
}

function _bindResizer(resizer) {
  let startX, startY, startSize;
  resizer.addEventListener('mousedown', e => {
    _dragging = true;
    startX = e.clientX; startY = e.clientY; startSize = _panelSize;
  });
  document.addEventListener('mousemove', e => {
    if (!_dragging) return;
    const panel = _getPanel();
    if (_isHorizontal()) {
      const delta = _layout === 'left' ? (e.clientX - startX) : (startX - e.clientX);
      _panelSize = Math.max(240, Math.min(600, startSize + delta));
      panel.style.width = panel.style.minWidth = _panelSize + 'px';
    } else {
      const delta = _layout === 'top' ? (e.clientY - startY) : (startY - e.clientY);
      _panelSize = Math.max(160, Math.min(520, startSize + delta));
      panel.style.height = panel.style.maxHeight = _panelSize + 'px';
    }
  });
  document.addEventListener('mouseup', () => { _dragging = false; _save(); _triggerPlotlyResize(); });
}

function _apply() {
  const ws = _getWorkspace();
  const panel = _getPanel();
  if (!ws || !panel) return;

  ws.classList.remove('layout-left','layout-right','layout-top','layout-bottom');
  ws.classList.add('layout-' + _layout);
  panel.classList.toggle('panel-collapsed', _collapsed);
  
  if (!_collapsed) {
    if (_isHorizontal()) { panel.style.width = panel.style.minWidth = _panelSize + 'px'; }
    else { panel.style.height = panel.style.maxHeight = _panelSize + 'px'; }
  }
  _repositionResizer();
  setTimeout(_triggerPlotlyResize, 320);
}

function _repositionResizer() {
  const resizer = document.getElementById('rnspxResizer');
  const ws = _getWorkspace();
  if (!resizer || !ws) return;
  resizer.className = 'workspace-resizer resizer-' + (_isHorizontal() ? 'vertical' : 'horizontal');
  ws.insertBefore(resizer, (_layout === 'left' || _layout === 'top') ? _getPlotPanel() : _getPanel());
}

/* ════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════ */
function _updateToolbar() {
  document.querySelectorAll('.layout-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.layout === _layout));
}

function _updateCollapseBtn() {
  const icon = document.getElementById('collapseBtnIcon');
  if (icon) icon.textContent = _collapsed ? '▶' : '◀';
}

function _isHorizontal() { return _layout === 'left' || _layout === 'right'; }
function _getWorkspace() { return document.querySelector(!document.getElementById('xyMode').classList.contains('hidden') ? '#xyMode .workspace' : '#oceanMode .workspace'); }
function _getPanel() { return _getWorkspace().querySelector('.control-panel'); }
function _getPlotPanel() { return _getWorkspace().querySelector('.plot-panel'); }

function _save() { try { localStorage.setItem(LAYOUT_KEY, _layout); localStorage.setItem(PANEL_SIZE_KEY, _panelSize); localStorage.setItem(COLLAPSED_KEY, _collapsed); } catch(e) {} }
function _resetLayout() { _layout = DEFAULTS.layout; _panelSize = DEFAULTS.panelSize; _collapsed = DEFAULTS.collapsed; _save(); _apply(); _updateToolbar(); _updateCollapseBtn(); }
function _triggerPlotlyResize() { ['plot-wrapper', 'xy-plot-wrapper'].forEach(id => { const el = document.getElementById(id); if(el && window.Plotly) Plotly.Plots.resize(el); }); }

function _bindKeyboard() {
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
      const map = { '1':'left', '2':'right', '3':'top', '4':'bottom' };
      if (map[e.key]) { e.preventDefault(); setWorkspaceLayout(map[e.key]); }
      if (e.key === '\\') { e.preventDefault(); toggleDockCollapse(); }
    }
  });
}

document.addEventListener('DOMContentLoaded', initWorkspaceLayout);