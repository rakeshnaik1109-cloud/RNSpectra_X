function updateLegendSlidersText() {
  document.getElementById("legendX_val").textContent = document.getElementById("legendX").value;
  document.getElementById("legendY_val").textContent = document.getElementById("legendY").value;
}
function updateXYLegendSlidersText() {
  document.getElementById("xyLegendX_val").textContent = document.getElementById("xyLegendX").value;
  document.getElementById("xyLegendY_val").textContent = document.getElementById("xyLegendY").value;
}

// The active workspace and XY input tab are remembered on this device, so a
// reload reopens where the user was (until they click the other one).
const MODE_KEY = 'rnspx_mode', XYTAB_KEY = 'rnspx_xytab';
function rememberUI(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
function recallUI(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

function setMode(mode) {
  if (mode !== 'ocean' && mode !== 'xy') mode = 'ocean';
  currentMode = mode;
  document.getElementById('oceanMode').classList.toggle('hidden', mode !== 'ocean');
  document.getElementById('xyMode').classList.toggle('hidden', mode !== 'xy');
  document.getElementById('modeOcean').classList.toggle('active', mode === 'ocean');
  document.getElementById('modeXY').classList.toggle('active', mode === 'xy');
  document.getElementById('modeOcean').setAttribute('aria-selected', mode === 'ocean');
  document.getElementById('modeXY').setAttribute('aria-selected', mode === 'xy');
  rememberUI(MODE_KEY, mode);
  // re-apply the dock layout to the workspace that just became visible
  setTimeout(() => {
    try {
      if (typeof setWorkspaceLayout === 'function') {
        let savedLayout = recallUI('rnspx_layout') || 'left';
        if (savedLayout === 'undefined' || savedLayout === 'null') savedLayout = 'left';
        setWorkspaceLayout(savedLayout);
      }
    } catch (layoutErr) { console.warn('Layout engine:', layoutErr); }
  }, 50);
}

// Start-up workspace: a link ending in #xy or #raman wins; otherwise the
// last one used; otherwise Raman.
function initialMode() {
  const h = (location.hash || '').toLowerCase();
  if (h === '#xy') return 'xy';
  if (h === '#raman' || h === '#ocean') return 'ocean';
  return recallUI(MODE_KEY) || 'ocean';
}



// Collapsible sections animate open to their real content height and are then
// left unconstrained ("none"), so content added later — fit results for many
// datasets, extra controls — is never clipped by a fixed max-height.
function toggleSection(header) {
  header.classList.toggle('open');
  const body = header.nextElementSibling;
  if (header.classList.contains('open')) {
    body.style.maxHeight = body.scrollHeight + 'px';
    const done = e => { if (e.target === body && header.classList.contains('open')) body.style.maxHeight = 'none'; body.removeEventListener('transitionend', done); };
    body.addEventListener('transitionend', done);
  } else {
    body.style.maxHeight = body.scrollHeight + 'px';   // from "none" to a number so the close animates
    void body.offsetHeight;
    body.style.maxHeight = '0';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.collapsible-header.open').forEach(h => {
    const body = h.nextElementSibling;
    if (body && body.classList.contains('collapsible-body')) body.style.maxHeight = 'none';
  });
});

/* Quick-nav pills: scroll a numbered group into view within the sidebar,
   and open it briefly if it happens to be a collapsed top-level card. */
function jumpToSection(panelId, sectionId) {
  const panel = document.getElementById(panelId);
  const target = document.getElementById(sectionId);
  if (!panel || !target) return;
  const scrollHost = panel.querySelector('.control-panel-inner') || panel;
  const top = target.offsetTop - scrollHost.offsetTop - 8;
  scrollHost.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  target.classList.add('rnspx-flash');
  setTimeout(() => target.classList.remove('rnspx-flash'), 900);
}


function setXYTab(tab) {
  document.getElementById('xyInputCSV').classList.toggle('hidden', tab !== 'csv');
  document.getElementById('xyInputCols').classList.toggle('hidden', tab !== 'cols');
  document.getElementById('xyInputFile').classList.toggle('hidden', tab !== 'file');
  document.getElementById('tabCSV').classList.toggle('active', tab === 'csv');
  document.getElementById('tabCols').classList.toggle('active', tab === 'cols');
  document.getElementById('tabFile').classList.toggle('active', tab === 'file');
  rememberUI(XYTAB_KEY, tab);
}
function updateXYHints() {
  const hints = XY_HINTS[document.getElementById("xyDataType").value]; document.getElementById("xyTypeBadge").textContent = hints.badge;
  if (hints.xlabel) document.getElementById("xyXlabel").value = hints.xlabel;
  if (hints.ylabel) document.getElementById("xyYlabel").value = hints.ylabel;
  document.getElementById("xyInvertX").checked = !!hints.invertX;
}
function addXYDataset() {
  extraDatasetCount++; const idx = extraDatasetCount;
  // insertAdjacentHTML keeps values already pasted into earlier datasets
  document.getElementById("extraXYDatasets").insertAdjacentHTML("beforeend", `
    <div id="extraDS${idx}" style="border:1px solid var(--border); border-radius:var(--radius); padding:14px; margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center;"><b>Dataset ${idx + 1}</b><button class="btn btn-outline btn-sm" onclick="document.getElementById('extraDS${idx}').remove()">✕ Remove</button></div>
      <div class="grid-3">
        <div class="field"><label>X Data</label><textarea id="xyXvals${idx}"></textarea></div>
        <div class="field"><label>Y Data</label><textarea id="xyYvals${idx}"></textarea></div>
        <div class="field"><label>Label</label><input id="xyName${idx}" value="Dataset ${idx + 1}"><input type="color" id="xyColor${idx}" value="${GROUP_COLORS[idx % GROUP_COLORS.length]}"><label class="toggle-item" style="font-size:12px;"><input type="checkbox" id="xyRight${idx}">Right Y axis</label></div>
      </div>
      <div class="grid-3" style="margin-top:8px">
        <div class="field"><label>Y Error (optional)</label><textarea id="xyYerr${idx}"></textarea></div>
        <div class="field"><label>X Error (optional)</label><textarea id="xyXerr${idx}"></textarea></div>
      </div>
    </div>`);
}
