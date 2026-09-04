
function lookUpDefaultBiomolecularAssignment(wavenumber) {
  const wave = Math.round(wavenumber);
  if (wave >= 480 && wave <= 520) return { mode: "S-S disulfide stretch", assign: "Protein Matrix" };
  if (wave >= 740 && wave <= 760) return { mode: "Ring Breathing", assign: "Nucleic Acids / Cytochrome C" };
  if (wave >= 850 && wave <= 858) return { mode: "Tyrosine ring breathing", assign: "Protein Backbone" };
  if (wave >= 1000 && wave <= 1006) return { mode: "Symmetric ring breathing", assign: "Phenylalanine Marker" };
  if (wave >= 1060 && wave <= 1090) return { mode: "C-C stretching", assign: "Lipid Acyl Chains" };
  if (wave >= 1230 && wave <= 1285) return { mode: "Amide III structural mode", assign: "Beta-Sheet/Alpha-Helix" };
  if (wave >= 1300 && wave <= 1340) return { mode: "CH3/CH2 twisting deformations", assign: "Lipids / Collagen" };
  if (wave >= 1440 && wave <= 1460) return { mode: "CH2 bending deformation", assign: "Universal Lipid Marker" };
  if (wave >= 1550 && wave <= 1565) return { mode: "Amide II vibrations", assign: "Protein Structuring" };
  if (wave >= 1650 && wave <= 1675) return { mode: "Amide I (C=O stretch)", assign: "Alpha-Helix Confirmation" };
  if (wave >= 1730 && wave <= 1750) return { mode: "C=O stretch carbonyls", assign: "Triglycerides / Esters" };
  return { mode: "Vibrational Mode", assign: "Fingerprint Zone" };
}




function mergeNearbyPeaks(peaks, tolerance = 3) {

    if (!peaks.length) return [];

    const sorted = [...peaks].sort((a, b) => a.x - b.x);

    const merged = [];

    sorted.forEach(pk => {

        const last = merged[merged.length - 1];

        if (!last || Math.abs(pk.x - last.x) > tolerance) {

            merged.push({ ...pk });

        } else {

            // Keep the stronger peak
            if (pk.y > last.y) {

                last.x = pk.x;
                last.y = pk.y;
                last.mode = pk.mode;
                last.assign = pk.assign;

            }

        }

    });

    return merged;

}


function filterPeakAnnotations(
    peaks,
    minSpacing = 10,
    topN = Infinity
) {

    if (!peaks.length) return [];

    // Strongest peaks first
    const strongest = [...peaks]
        .sort((a, b) => b.y - a.y);

    const selected = [];

    strongest.forEach(pk => {

        const tooClose = selected.some(
            p => Math.abs(p.x - pk.x) < minSpacing
        );

        if (!tooClose) {

            selected.push({ ...pk });

        }

    });

    // Sort back by Raman shift
    selected.sort((a, b) => a.x - b.x);

    const commonOnly =
    document.getElementById("commonLabelsOnly")?.checked;

let result = selected;

if (commonOnly) {

    result = result.filter(pk =>
        analyzedCommonPeaks.some(cp =>
            Math.abs(cp.x - pk.x) < 2
        )
    );

}

return result.slice(0, topN);

}


/* ═══════════════════════════════════════════════════════════
   OCEAN PEAK TABLE
═══════════════════════════════════════════════════════════ */
function buildOceanPeakTableHTML() {
  const tbody = document.getElementById("peakTableBody"); tbody.innerHTML = "";
  const uniquePeaks = mergeNearbyPeaks(lastPeaksData, 3);uniquePeaks.forEach((pk, i) => {
    tbody.innerHTML += `
      <tr id="ocean-pk-row-${i}">
        <td>${i + 1}</td>
        <td><input type="number" step="0.1" id="ocean-pk-x-${i}" value="${pk.x.toFixed(1)}" onchange="syncOceanTableToMemory()"></td>
        <td><input type="number" step="0.001" id="ocean-pk-y-${i}" value="${pk.y.toFixed(4)}" onchange="syncOceanTableToMemory()"></td>
        <td><input type="text" id="ocean-pk-mode-${i}" value="${pk.mode}" onchange="syncOceanTableToMemory()"></td>
        <td><input type="text" id="ocean-pk-assign-${i}" value="${pk.assign}" onchange="syncOceanTableToMemory()"></td>
        <td><button class="btn-danger-action" onclick="deleteOceanPeakRow(${i})">✕ Delete</button></td>
      </tr>`;
  });
  document.getElementById("peakTableSection").style.display = "block";
}


function syncOceanTableToMemory() {
  const updatedMatrix = [];
  lastPeaksData.forEach((_, i) => {
    if (document.getElementById(`ocean-pk-row-${i}`)) {
      updatedMatrix.push({ x: parseFloat(document.getElementById(`ocean-pk-x-${i}`).value) || 0, y: parseFloat(document.getElementById(`ocean-pk-y-${i}`).value) || 0, mode: document.getElementById(`ocean-pk-mode-${i}`).value, assign: document.getElementById(`ocean-pk-assign-${i}`).value });
    }
  });
  lastPeaksData = updatedMatrix;
}

function deleteOceanPeakRow(idx) { lastPeaksData.splice(idx, 1); buildOceanPeakTableHTML(); replotWithModifiedPeaks(); }
function addCustomOceanPeakRow() { syncOceanTableToMemory(); const match = lookUpDefaultBiomolecularAssignment(parseFloat(document.getElementById("xmin").value)); lastPeaksData.push({ x: parseFloat(document.getElementById("xmin").value), y: 0.5, mode: match.mode, assign: match.assign }); buildOceanPeakTableHTML(); replotWithModifiedPeaks(); }
function replotWithModifiedPeaks() {
  syncOceanTableToMemory(); const font = document.getElementById("boldStyle").checked ? "Arial Black, Arial" : "Georgia, serif";
  const wrapper = document.getElementById("plot-wrapper"); const currentTraces = wrapper.data ? wrapper.data.filter(t => t.name !== undefined) : [];
  renderCanvasTracesAndLayout(currentTraces, lastPeaksData, font, wrapper, 'ocean');
}


function togglePeakSectionVisibility() {
  const check = document.getElementById("showPeaks").checked;
  document.getElementById("peakTableSection").style.display = (check && lastPeaksData.length) ? "block" : "none";
}



function buildXyPeakTableHTML() {
  const tbody = document.getElementById("xyPeakTableBody"); tbody.innerHTML = "";
  lastXYPeaks.sort((a, b) => a.x - b.x).forEach((pk, i) => {
    tbody.innerHTML += `
      <tr id="xy-pk-row-${i}">
        <td>${i + 1}</td>
        <td><input type="number" step="0.1" id="xy-pk-x-${i}" value="${pk.x.toFixed(2)}" onchange="syncXyTableToMemory()"></td>
        <td><input type="number" step="0.001" id="xy-pk-y-${i}" value="${pk.y.toFixed(4)}" onchange="syncXyTableToMemory()"></td>
        <td><input type="text" id="xy-pk-note-${i}" value="${pk.note || ''}" onchange="syncXyTableToMemory()"></td>
        <td><button class="btn-danger-action" onclick="deleteXyPeakRow(${i})">✕ Delete</button></td>
      </tr>`;
  });
  document.getElementById("xyPeakTableSection").style.display = "block";
}

function syncXyTableToMemory() {
  const matrix = []; lastXYPeaks.forEach((_, i) => { if (document.getElementById(`xy-pk-row-${i}`)) matrix.push({ x: parseFloat(document.getElementById(`xy-pk-x-${i}`).value) || 0, y: parseFloat(document.getElementById(`xy-pk-y-${i}`).value) || 0, note: document.getElementById(`xy-pk-note-${i}`).value }); }); lastXYPeaks = matrix;
}



function deleteXyPeakRow(idx) { lastXYPeaks.splice(idx, 1); buildXyPeakTableHTML(); replotWithModifiedXyPeaks(); }
function addCustomXyPeakRow() { syncXyTableToMemory(); lastXYPeaks.push({ x: 0, y: 0.5, note: "Manual alignment entry" }); buildXyPeakTableHTML(); replotWithModifiedXyPeaks(); }
function replotWithModifiedXyPeaks() { syncXyTableToMemory(); const w = document.getElementById("xy-plot-wrapper"); if (!w.data) return; renderCanvasTracesAndLayout(w.data.filter(t => t.name !== undefined), lastXYPeaks, document.getElementById("xyBold").checked ? "Arial Black, Arial" : "Georgia, serif", w, 'xy'); }


function toggleXyPeakSectionVisibility() {
  const check = document.getElementById("xyShowPeaks").checked;
  document.getElementById("xyPeakTableSection").style.display = (check && lastXYPeaks.length) ? "block" : "none";
}

