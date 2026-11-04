
// Reference Raman band library (biological / SERS work). Each entry is a band
// centre with a matching half-width in cm⁻¹; a detected peak takes the entry
// whose centre is nearest, provided it lies within that half-width.
// Sources: Movasaghi, Rehman & Rehman, Appl. Spectrosc. Rev. 42, 493 (2007);
// Talari et al., Appl. Spectrosc. Rev. 50, 46 (2015). This is the default
// library; a subcellular library (Nowakowska et al. 2025) follows below.
const RAMAN_BAND_LIBRARY = [
  { c: 510,  hw: 6,  mode: "S–S stretch",                         assign: "Disulfide bridges (proteins)" },
  { c: 520.7,hw: 3,  mode: "Si optical phonon",                   assign: "Silicon substrate / calibration line" },
  { c: 621,  hw: 4,  mode: "C–C twist",                           assign: "Phenylalanine" },
  { c: 643,  hw: 4,  mode: "C–C twist",                           assign: "Tyrosine" },
  { c: 668,  hw: 4,  mode: "C–S stretch / ring breathing",         assign: "Cystine; thymine, guanine" },
  { c: 725,  hw: 6,  mode: "Ring breathing",                      assign: "Adenine" },
  { c: 758,  hw: 4,  mode: "Indole ring breathing",               assign: "Tryptophan" },
  { c: 785,  hw: 6,  mode: "Ring breathing (U, T, C) + O–P–O",    assign: "Nucleic acids" },
  { c: 830,  hw: 6,  mode: "Fermi doublet / O–P–O asym. stretch",  assign: "Tyrosine; DNA backbone" },
  { c: 853,  hw: 5,  mode: "Ring breathing (Fermi doublet)",      assign: "Tyrosine; proline" },
  { c: 937,  hw: 7,  mode: "C–C stretch (α-helix)",               assign: "Protein backbone" },
  { c: 1003, hw: 4,  mode: "Symmetric ring breathing",            assign: "Phenylalanine" },
  { c: 1031, hw: 4,  mode: "C–H in-plane bend",                   assign: "Phenylalanine" },
  { c: 1065, hw: 8,  mode: "C–C stretch (trans chains)",          assign: "Lipids" },
  { c: 1093, hw: 6,  mode: "PO₂⁻ symmetric stretch",              assign: "DNA / phospholipid backbone" },
  { c: 1127, hw: 6,  mode: "C–C / C–N stretch",                   assign: "Lipids; proteins" },
  { c: 1157, hw: 5,  mode: "C–C stretch",                         assign: "Carotenoids" },
  { c: 1175, hw: 5,  mode: "C–H in-plane bend",                   assign: "Tyrosine; phenylalanine" },
  { c: 1245, hw: 15, mode: "Amide III (β-sheet / random coil)",   assign: "Protein secondary structure" },
  { c: 1275, hw: 10, mode: "Amide III (α-helix)",                 assign: "Protein secondary structure" },
  { c: 1302, hw: 6,  mode: "CH₂ twist",                           assign: "Lipids" },
  { c: 1340, hw: 8,  mode: "CH₃/CH₂ wag; G, A ring",              assign: "Proteins; nucleic acids" },
  { c: 1450, hw: 10, mode: "CH₂/CH₃ deformation",                 assign: "Lipids and proteins" },
  { c: 1525, hw: 6,  mode: "C=C stretch",                         assign: "Carotenoids" },
  { c: 1555, hw: 6,  mode: "Indole ring stretch",                 assign: "Tryptophan" },
  { c: 1578, hw: 5,  mode: "Ring stretch",                        assign: "Guanine, adenine" },
  { c: 1605, hw: 4,  mode: "C=C ring stretch",                    assign: "Phenylalanine; tyrosine" },
  { c: 1617, hw: 4,  mode: "C=C stretch",                         assign: "Tyrosine; tryptophan" },
  { c: 1655, hw: 7,  mode: "Amide I (α-helix); C=C",              assign: "Proteins; unsaturated lipids" },
  { c: 1670, hw: 6,  mode: "Amide I (β-sheet)",                   assign: "Protein secondary structure" },
  { c: 1740, hw: 8,  mode: "C=O ester stretch",                   assign: "Lipids (triglycerides, phospholipids)" },
  { c: 2850, hw: 8,  mode: "CH₂ symmetric stretch",               assign: "Lipids" },
  { c: 2885, hw: 6,  mode: "CH₂ asymmetric stretch",              assign: "Lipids" },
  { c: 2935, hw: 10, mode: "CH₃ symmetric stretch",               assign: "Proteins" }
];

// Subcellular band library: Table 1 of "The Raman Map of the Human Cell"
// (Nowakowska et al., Anal. Chem. 97, 16374–16382, 2025; CC BY 4.0).
// Bands of human aortic endothelial cells imaged at 532 nm, with the
// organelle(s) in which each band is characteristic. Where the table lists
// several assignments for one position they are joined with "; ". The
// paper's own literature references are not repeated here — see Table 1.
// Abbreviations as in the paper: ν stretch (s symmetric, as asymmetric),
// δ deformation, α scissoring, ω wagging, τ twisting; pyr porphyrin ring;
// cyt. cytochromes; A, C, G, T, U nucleobases; p phosphorylated; LDs lipid droplets.
const RAMAN_CELL_MAP_LIBRARY = [
  { c: 605,  hw: 8, mode: "Reduced cytochrome c",                                       assign: "Mitochondria" },
  { c: 722,  hw: 8, mode: "νs(N⁺(CH₃)₃) of the choline group",                          assign: "Perinuclear area; lipid droplets (phospholipids)" },
  { c: 753,  hw: 8, mode: "ν15 pyrrole breathing; ν(CαCβ) in cytochromes",                assign: "Perinuclear area; mitochondria (cytochromes) — key marker" },
  { c: 788,  hw: 8, mode: "C, U ring breathing; νs(PO₂⁻) of the DNA backbone; pThr",      assign: "Nucleus & nucleoli (DNA) — key marker; cytoplasm (pThr)" },
  { c: 1009, hw: 6, mode: "Phe ring breathing",                                         assign: "Nucleus & nucleoli; cytoplasm (phenylalanine) — key marker" },
  { c: 1088, hw: 4, mode: "ν(P–O) in phospholipids; ν(C–C) in lipids; pThr, pSer",       assign: "Perinuclear area; lipid droplets; cytoplasm (pThr, pSer)" },
  { c: 1095, hw: 4, mode: "νs(PO₂⁻) of the DNA backbone",                                assign: "Nucleus & nucleoli" },
  { c: 1131, hw: 8, mode: "ν(C–C); ν22 pyrrole, νsym(pyr half ring), νas(CαN) in cytochromes", assign: "Perinuclear area; lipid droplets; mitochondria (cytochromes)" },
  { c: 1255, hw: 6, mode: "A, C, G ring breathing, νas(PO₂⁻); amide III (albumin)",        assign: "Nucleus & nucleoli; cytoplasm (proteins)" },
  { c: 1267, hw: 5, mode: "δ(=CH)",                                                     assign: "Lipid droplets (unsaturated lipids)" },
  { c: 1307, hw: 8, mode: "A (B-, Z-DNA marker); τ(CH₂, CH₃) in fatty acids; ν21 pyrrole, δ(CmH) in cytochromes", assign: "Nucleus & nucleoli; perinuclear area; lipid droplets; mitochondria" },
  { c: 1340, hw: 4, mode: "A (B-, Z-DNA marker), ω(CH₃, CH₂) in purines; Thr δ(C–H)",     assign: "Nucleus & nucleoli; perinuclear area (Thr)" },
  { c: 1342, hw: 4, mode: "Ser, Thr δ(C–H)",                                             assign: "Cytoplasm" },
  { c: 1449, hw: 10, mode: "δ(C–H) in deoxyribose; α(CH₂/CH₃), β(CH₂), δ(C–H) of albumin in lipids and proteins", assign: "Nucleus & nucleoli; perinuclear area; lipid droplets; cytoplasm" },
  { c: 1580, hw: 4, mode: "G, A ring breathing",                                         assign: "Nucleus & nucleoli (DNA)" },
  { c: 1584, hw: 4, mode: "ν19 pyrrole, νas(CαCm) in cytochromes",                        assign: "Perinuclear area; mitochondria" },
  { c: 1658, hw: 10, mode: "T, G, C ring breathing; amide I (proteins); ν10 pyrrole, νas(CαCm) in cytochromes; ν(C=C)", assign: "Nucleus & nucleoli; perinuclear area; cytoplasm; mitochondria; lipid droplets" },
  { c: 1742, hw: 8, mode: "ν(C=O) ester",                                                assign: "Perinuclear area; lipid droplets (esterified lipids)" },
  { c: 2853, hw: 8, mode: "νs(CH₂)",                                                     assign: "Perinuclear area; lipid droplets — key marker" },
  { c: 2890, hw: 8, mode: "νas(CH₂)",                                                    assign: "Lipid droplets" },
  { c: 2932, hw: 10, mode: "νs(CH₃/CH₂)",                                                assign: "Perinuclear area; lipid droplets" },
  { c: 3012, hw: 10, mode: "ν(=C–H)",                                                    assign: "Perinuclear area; lipid droplets (unsaturated lipids) — key marker" }
];

// The band libraries a user can choose from (Raman mode → Peak Detection).
const BAND_LIBRARIES = {
  tissue: {
    label: "Biological tissue (Movasaghi 2007; Talari 2015)",
    cite: "Z. Movasaghi, S. Rehman, I. U. Rehman, Appl. Spectrosc. Rev. 42, 493–541 (2007); A. C. S. Talari, Z. Movasaghi, S. Rehman, I. U. Rehman, Appl. Spectrosc. Rev. 50, 46–111 (2015).",
    bands: () => RAMAN_BAND_LIBRARY
  },
  cell: {
    label: "Human cell organelles (Nowakowska et al. 2025)",
    cite: "A. M. Nowakowska, A. Pieczara, W. Korona, A. Borek-Dorosz, A. Adamczyk, P. Dawiec, P. Leszczenko, J. Orleanska, E. Machalska, B. Orzechowska, S. Orzechowska, K. Brzozowski, W. Krynicka, K. Majzner, K. Malek, M. Baranska, \"The Raman Map of the Human Cell\", Anal. Chem. 97, 16374–16382 (2025), https://doi.org/10.1021/acs.analchem.5c02035 — Table 1, CC BY 4.0.",
    bands: () => RAMAN_CELL_MAP_LIBRARY
  },
  both: {
    label: "Both (nearest band from either)",
    cite: null,
    bands: () => RAMAN_BAND_LIBRARY.map(b => ({ ...b, src: "tissue" })).concat(RAMAN_CELL_MAP_LIBRARY.map(b => ({ ...b, src: "cell" })))
  }
};

function selectedBandLibrary() {
  const v = document.getElementById("bandLibrary")?.value;
  return BAND_LIBRARIES[v] ? v : "tissue";
}

// Citation line(s) for the library in use — shown under the peak table and
// written into the .txt / PDF peak reports.
function bandLibraryCitation() {
  const k = selectedBandLibrary();
  if (k === "both") return "Band assignments: " + BAND_LIBRARIES.tissue.cite + " Subcellular bands: " + BAND_LIBRARIES.cell.cite;
  return "Band assignments: " + BAND_LIBRARIES[k].cite;
}

function lookUpDefaultBiomolecularAssignment(wavenumber) {
  const k = selectedBandLibrary();
  let best = null, bestD = Infinity;
  BAND_LIBRARIES[k].bands().forEach(b => {
    const d = Math.abs(wavenumber - b.c);
    if (d <= b.hw && d < bestD) { best = b; bestD = d; }
  });
  if (!best) return { mode: "Unassigned", assign: "—" };
  const tag = (k === "both" && best.src === "cell") ? " [Nowakowska 2025]" : "";
  return { mode: best.mode, assign: best.assign + tag };
}

// Switching library relabels the peaks of the current plot.
function onBandLibraryChange() {
  const note = document.getElementById("bandLibraryCite");
  if (note) note.textContent = bandLibraryCitation();
  const wrapper = document.getElementById("plot-wrapper");
  if (wrapper && wrapper.data && typeof plotSpectrum === "function") plotSpectrum();
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
                last.xTrue = pk.xTrue;
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
  // The table rows are indexed against lastPeaksData by the sync/delete
  // handlers, so the merged list must become lastPeaksData itself.
  lastPeaksData = mergeNearbyPeaks(lastPeaksData, 3);
  const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  lastPeaksData.forEach((pk, i) => {
    tbody.innerHTML += `
      <tr id="ocean-pk-row-${i}">
        <td>${i + 1}</td>
        <td><input type="number" step="0.1" id="ocean-pk-x-${i}" value="${pk.x.toFixed(1)}" onchange="syncOceanTableToMemory()"></td>
        <td><input type="number" step="0.001" id="ocean-pk-y-${i}" value="${pk.y.toFixed(4)}" onchange="syncOceanTableToMemory()"></td>
        <td><input type="text" id="ocean-pk-mode-${i}" value="${esc(pk.mode)}" title="${esc(pk.mode)}" onchange="this.title=this.value;syncOceanTableToMemory()"></td>
        <td><input type="text" id="ocean-pk-assign-${i}" value="${esc(pk.assign)}" title="${esc(pk.assign)}" onchange="this.title=this.value;syncOceanTableToMemory()"></td>
        <td><button class="btn-danger-action" onclick="deleteOceanPeakRow(${i})">✕ Delete</button></td>
      </tr>`;
  });
  const note = document.getElementById("bandLibraryCite");
  if (note) note.textContent = bandLibraryCitation();
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
  syncOceanTableToMemory(); const font = resolveFont("", "boldTick");
  const wrapper = document.getElementById("plot-wrapper"); if (!wrapper.data) return;
  const currentTraces = wrapper.data.filter(t => t.name !== undefined);
  renderCanvasTracesAndLayout(currentTraces, lastPeaksData, font, wrapper, 'ocean');
}


function togglePeakSectionVisibility() {
  const check = document.getElementById("showPeaks").checked;
  document.getElementById("peakTableSection").style.display = (check && lastPeaksData.length) ? "block" : "none";
}


