function updateLegendSlidersText() {
  document.getElementById("legendX_val").textContent = document.getElementById("legendX").value;
  document.getElementById("legendY_val").textContent = document.getElementById("legendY").value;
}
function updateXYLegendSlidersText() {
  document.getElementById("xyLegendX_val").textContent = document.getElementById("xyLegendX").value;
  document.getElementById("xyLegendY_val").textContent = document.getElementById("xyLegendY").value;
}

function setMode(mode) {
  currentMode = mode;
  document.getElementById('oceanMode').classList.toggle('hidden', mode !== 'ocean');
  document.getElementById('xyMode').classList.toggle('hidden', mode !== 'xy');
  document.getElementById('modeOcean').classList.toggle('active', mode === 'ocean');
  document.getElementById('modeXY').classList.toggle('active', mode === 'xy');
}



function toggleSection(header) {
  header.classList.toggle('open');
  const body = header.nextElementSibling;
  body.style.maxHeight = header.classList.contains('open') ? '600px' : '0';
}

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
}
function updateXYHints() {
  const hints = XY_HINTS[document.getElementById("xyDataType").value]; document.getElementById("xyTypeBadge").textContent = hints.badge;
  if (hints.xlabel) document.getElementById("xyXlabel").value = hints.xlabel;
}
function addXYDataset() {
  extraDatasetCount++; const idx = extraDatasetCount;
  document.getElementById("extraXYDatasets").innerHTML += `
    <div id="extraDS${idx}" style="border:1px solid var(--border); border-radius:var(--radius); padding:14px; margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center;"><b>Dataset ${idx + 1}</b><button class="btn btn-outline btn-sm" onclick="document.getElementById('extraDS${idx}').remove()">✕ Remove</button></div>
      <div class="grid-3">
        <div class="field"><label>X Data</label><textarea id="xyXvals${idx}"></textarea></div>
        <div class="field"><label>Y Data</label><textarea id="xyYvals${idx}"></textarea></div>
        <div class="field"><label>Label</label><input id="xyName${idx}" value="Dataset ${idx + 1}"><input type="color" id="xyColor${idx}" value="${GROUP_COLORS[idx % GROUP_COLORS.length]}"></div>
      </div>
      <div class="grid-3" style="margin-top:8px">
        <div class="field"><label>Y Error (optional)</label><textarea id="xyYerr${idx}"></textarea></div>
        <div class="field"><label>X Error (optional)</label><textarea id="xyXerr${idx}"></textarea></div>
      </div>
    </div>`;
}


window.setMode = function(mode) {
  try {
    const isOcean = (mode === 'ocean');
    
    // 1. Safely toggle the main workspace containers
    const oceanSection = document.getElementById('oceanMode');
    const xySection = document.getElementById('xyMode');
    if (oceanSection) oceanSection.classList.toggle('hidden', !isOcean);
    if (xySection) xySection.classList.toggle('hidden', isOcean);

    // 2. Safely toggle the active styling on the tab buttons
    const btnOcean = document.getElementById('modeOcean');
    const btnXY = document.getElementById('modeXY');
    if (btnOcean) btnOcean.classList.toggle('active', isOcean);
    if (btnXY) btnXY.classList.toggle('active', !isOcean);

    // 3. Safely re-trigger the layout engine
    setTimeout(() => {
      try {
        if (typeof setWorkspaceLayout === 'function') {
           let savedLayout = localStorage.getItem('rnspx_layout') || 'left';
           if (savedLayout === 'undefined' || savedLayout === 'null') savedLayout = 'left'; 
           setWorkspaceLayout(savedLayout);
        }
      } catch (layoutErr) {
        console.warn("Layout engine minor error, but tabs still switched:", layoutErr);
      }
    }, 50);

  } catch (err) {
    console.error("Critical error during tab switch:", err);
  }
};