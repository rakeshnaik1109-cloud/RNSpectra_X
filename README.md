# RNSpectraX™ — Spectral Analysis & Scientific Plotting Suite

RNSpectraX turns raw experimental data into analysed, publication-ready figures,
entirely inside your web browser. There is nothing to install, no account to
create, and your data never leave your computer.

It has two workspaces:

1. **Raman / Spectral mode** — for Raman and SERS spectroscopists. Load raw
   spectrometer files, remove cosmic-ray spikes, correct the baseline, smooth,
   average replicates with SD/SEM bands, detect and assign bands, and compare
   which bands are shared or unique across samples.
2. **XY Plotting & Fitting mode** — a general scientific plotter for any
   discipline. If your data are X–Y pairs (a calibration curve, an I–V
   characteristic, a decay, an absorbance or diffraction pattern, a thermogram,
   a simulation output), you can plot them with error bars and fit them with
   proper least-squares regression and parameter uncertainties.

**Version 3.2** · **Authors:** Rakesh Naik<sup>1</sup>, Sachin Kumar Srivastava<sup>1,2</sup>
<sup>1</sup>Centre for Photonics and Quantum Communication Technology, IIT Roorkee ·
<sup>2</sup>Department of Physics, IIT Roorkee
© 2026 Rakesh Naik and Sachin Kumar Srivastava. All rights reserved.

---

## Who it is for

- **Spectroscopists** who need a repeatable Raman/SERS processing pipeline
  without scripting it from scratch.
- **Students and researchers in any field** (physics, chemistry, biology,
  materials science, engineering, environmental science) who need a clean graph
  with error bars and a trustworthy fit, quickly.
- **Teaching labs**, where a browser tool that runs on any machine avoids
  installation and licence problems.
- **Reviewers and collaborators**, who can open the same tool and reproduce a
  figure from the same settings.

---

## Where your data go

Nowhere. Parsing, despiking, baseline fitting, averaging, peak detection, curve
fitting and export all run in JavaScript inside your browser tab. There is no
backend, no analytics, and no network request carrying your data. Processing
settings are stored in `localStorage` on your own machine so a recipe survives a
reload; your files are not.

---

## What it does

### ① Raman / spectral mode

| Capability | Detail |
|---|---|
| Format fingerprinting | Ocean Optics, Horiba/LabSpec, Renishaw WiRE, Bruker, WITec, JCAMP-DX, generic 2-column |
| Despiking | Modified Z-score and Whitaker–Hayes cosmic-ray removal with adjustable threshold and repair window |
| Baseline correction | Linear (2-point), polynomial, rubber band, rolling ball, with an optional overlay of the fitted baseline |
| Smoothing | Moving average, Savitzky–Golay, Gaussian, median |
| Normalisation | Per-spectrum scaling for cross-sample comparison |
| Group statistics | Group averages and grand average with SD or SEM, drawn as capped bars or shaded bands |
| Peak detection | Local maxima with prominence control, cross-referenced against a biomolecular assignment library (Amide I/II/III, phenylalanine, tyrosine, lipids and others) |
| Cross-file analyser | Clusters peaks across all loaded spectra into common bands and sample-specific bands |
| Editable peak table | Correct positions, retitle assignments, delete rows, and re-plot from the edited table |

### ② XY plotting and fitting mode

| Capability | Detail |
|---|---|
| Data entry | Paste values, paste columns, or upload `.csv` / `.txt` / `.dat` / `.tsv` files, with optional Y-error and X-error columns |
| Axis presets | General, FTIR, UV-Vis, fluorescence/PL, XRD, XPS, I–V, time series/kinetics, thermal analysis and calibration curves. A preset only fills in axis labels; the data are never treated differently |
| Axis limits | X Min / X Max with Y Min / Y Max directly below. Blank means automatic, and one side can be pinned on its own |
| Plot styles | Lines, scatter, bar, fill-under, per-dataset X/Y offsets for stacked plots, inverted X axis |
| Regression models | Linear, polynomial (up to order 10), exponential, power, logarithmic, Gaussian peak, Lorentzian peak |
| Fitting engine | Exact weighted least squares for linear-in-parameter models; Levenberg–Marquardt for non-linear models. Points are weighted by 1/σ² when Y-errors are given |
| Fit reporting | Every parameter ± its standard error, plus R², adjusted R², residual sum of squares, reduced χ² (weighted fits), and derived quantities (time constant τ, FWHM, peak area) |
| Cross-file comparison | Finds maxima shared by all uploaded files and those unique to some |

### Figures and export

- Journal presets for figure size and fonts, independent bold control for
  title, labels, ticks and legend, and LaTeX in titles and axis labels.
- Click-to-edit titles, axis labels and legend entries; text, arrow and shape
  annotations; data-accurate scale bars; zoomed inset plots.
- High-resolution PNG / JPG / TIFF / SVG export at a chosen DPI.
- Processed data as CSV (exactly what was plotted), fit reports as `.txt` and
  `.csv`, and PDF / `.txt` peak and comparison tables.

The mathematics behind every processing and fitting step is written out in
[`docs/METHODS.md`](docs/METHODS.md), so the pipeline can be described exactly in
a methods section. Step-by-step usage is in
[`docs/USER_MANUAL.md`](docs/USER_MANUAL.md).

---

## New in 3.2

- **XY mode is now a general-purpose scientific plotter.** Raman-specific peak
  markers and the peak-coordinate table were removed from it, and the default
  title and axis labels are neutral.
- **Y Min / Y Max sit directly below X Min / X Max**, update the plot as you
  type, and each limit can be set on its own.
- **New axis presets:** XPS, I–V, time series/kinetics, thermal analysis and
  calibration curves. FTIR and XPS presets reverse the X axis, as is
  conventional.
- **More rigorous curve fitting:** Levenberg–Marquardt refinement, 1/σ²
  weighting from error columns, parameter standard errors, reduced χ², and
  derived τ, FWHM and peak area. High-order polynomials are now numerically
  stable on large X values, and peak fits handle downward (absorption) peaks.
- **Bar plot** now draws bars. Before, it only changed the layout setting.
- **Fixes:** inverting X now works together with a manual X range; a trailing
  comma or space in pasted values no longer adds a spurious zero; mismatched X/Y
  lengths are reported instead of silently mis-paired; the Raman **Update
  Markers** and **Compare** actions no longer fail; comparison bands from one
  mode no longer appear on the other mode's plot.

---

## Project layout

```
RNSpectra_X/
├── index.html               Application shell and all control markup
├── css/
│   ├── style.css            Design tokens, components, light + dark themes
│   └── layout.css           Dockable workspace layout engine
├── js/
│   ├── config.js            Homepage link used in the header
│   ├── app.js               Boot
│   ├── core/                state.js · utils.js · advancedLayout.js
│   ├── io/                  parser.js · fileLoader.js · exporter.js
│   ├── processing/          despike.js · baseline.js · smoothing.js
│   ├── plotting/            averaging.js · plotting.js · xyPlot.js · comparison.js
│   ├── analysis/            peaks.js · fitting.js
│   └── ui/                  sidebar.js · layout.js · theme.js · session.js · workspaceExtras.js
├── docs/
│   ├── USER_MANUAL.md       How to use each workspace
│   └── METHODS.md           The mathematics behind each processing and fitting step
├── dist/
│   └── rnspectrax-standalone.html   Single-file build of the whole app
├── build-standalone.py      Regenerates the single-file build
└── assets/favicon.svg
```

The single-file build in `dist/` contains the whole application in one HTML
file, so it can be shared as one attachment. Regenerate it with
`python3 build-standalone.py` after changing anything in `css/` or `js/`.

### Linking back to the homepage

`js/config.js` holds the single line that controls the header link:

```js
window.RNSPX_HOME_URL = "../index.html";
```

Change it to your live homepage URL if the two sites are not served from the
same domain.

---

## Built with

HTML5 · CSS3 (custom flex/grid dock engine) · modular vanilla ES6 ·
[Plotly.js](https://plotly.com/javascript/) for rendering ·
[jsPDF](https://github.com/parallax/jsPDF) for PDF export ·
MathJax for typeset notation.

There is no framework and no bundler, so a reviewer or collaborator can read the
source of any calculation directly.

---

## Citing RNSpectraX

If RNSpectraX contributes to published work, please cite it. A
[`CITATION.cff`](CITATION.cff) file is included, so GitHub shows a
"Cite this repository" box with ready-made BibTeX and APA entries.

---

## Licence

Proprietary. Copying, modification, redistribution or commercial use in any
medium requires the written consent of the authors. See [`LICENSE`](LICENSE).
