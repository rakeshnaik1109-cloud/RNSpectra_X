# RNSpectraX™ — Raman & SERS Spectral Analysis Suite

A browser-based workspace for processing, plotting and comparing experimental
optical spectra. Load raw spectrometer files, clean the signal, average groups,
assign peaks, fit curves, and export publication-ready figures — without
installing anything and without uploading a single data point.

**Version 3.1** · **Authors:** Rakesh Naik<sup>1</sup>, Sachin Kumar Srivastava<sup>1,2</sup>
<sup>1</sup>Centre for Photonics and Quantum Communication Technology, IIT Roorkee ·
<sup>2</sup>Department of Physics, IIT Roorkee
© 2026 Rakesh Naik and Sachin Kumar Srivastava. All rights reserved.

---

## Run it

No build step, no package manager, no server required.

```bash
git clone https://github.com/<your-username>/rnspectrax.git
cd rnspectrax
open index.html        # macOS  ·  Windows: start index.html  ·  Linux: xdg-open index.html
```

If your browser blocks local module loading, serve the folder instead:

```bash
python3 -m http.server 8000     # then visit http://localhost:8000
```

### Deploy on GitHub Pages

1. Push this repository.
2. **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`.**
3. The app is live at `https://<your-username>.github.io/rnspectrax/`.

---

## Where your data goes

Nowhere. Parsing, despiking, baseline fitting, averaging, peak detection, curve
fitting and export all run in JavaScript inside your tab. There is no backend,
no analytics, and no network request carrying spectral data. Processing settings
are stored in `localStorage` on your own machine so a recipe survives a reload;
your files are not.

---

## What it does

### ① Raman / spectral mode

| Capability | Detail |
|---|---|
| Format fingerprinting | Ocean Optics, Horiba/LabSpec, Renishaw WiRE, Bruker, WITec, JCAMP-DX, generic 2-column |
| Despiking | Modified Z-score and Whitaker–Hayes cosmic-ray removal with adjustable threshold and repair window |
| Baseline correction | Linear (2-point), polynomial, rubber band, rolling ball — with an optional overlay of the fitted baseline |
| Smoothing | Moving average, Savitzky–Golay, Gaussian, median |
| Normalisation | Per-spectrum scaling for cross-sample comparison |
| Group statistics | Group averages and grand average with SD or SEM, drawn as capped bars or shaded bands |
| Peak detection | Local maxima with prominence control, cross-referenced against a biomolecular assignment library (Amide I/II, tyrosine ring breathing, phenylalanine, and others) |
| Cross-file analyser | Clusters peaks across all loaded spectra into common bands and trace-specific bands |
| Editable peak table | Correct positions, retitle assignments, delete rows, and re-plot from the edited table |

### ② XY plotting and fitting mode

| Capability | Detail |
|---|---|
| Data entry | CSV upload, clipboard paste, or manual entry, with optional Y-error and X-error columns |
| Regression models | Linear, polynomial, exponential, power, logarithmic, Gaussian, Lorentzian |
| Fit reporting | R², residual sum of squares, amplitude, centre and width, per dataset |
| Presets | FTIR, UV-Vis, XRD and fluorescence axis presets |
| Styling | Colour inheritance for fitted traces, fill-to-zero, legend placement, journal figure presets |

### Export

High-resolution PNG / JPG / SVG figures, processed CSV matrices (post-correction,
so what you export is what you plotted), curve-fit reports as `.txt` and `.csv`,
and PDF peak tables.

---

## New in 3.1

- **Dark workspace** (moon icon, top right). The figure canvas stays white in
  both modes on purpose, so what you see matches the exported image.
- **Drag and drop.** Drop spectra anywhere on the window; the active mode
  decides which loader receives them.
- **Session memory.** Every processing and styling control is restored on your
  next visit. Clear it from the keyboard sheet at any time.
- **Keyboard reference.** Press <kbd>?</kbd>.
- **Homepage link** in the header, back to the research site.
- Re-themed interface, accessible focus states, and a skip link.

---

## Project layout

```
rnspectrax/
├── index.html               Application shell and all control markup
├── css/
│   ├── style.css            Design tokens, components, light + dark themes
│   └── layout.css           Dockable workspace layout engine
├── js/
│   ├── config.js            ← edit this to point the header link at your homepage
│   ├── app.js               Boot
│   ├── core/                state.js · utils.js · advancedLayout.js
│   ├── io/                  parser.js · fileLoader.js · exporter.js
│   ├── processing/          despike.js · baseline.js · smoothing.js
│   ├── plotting/            averaging.js · plotting.js · xyPlot.js · comparison.js
│   ├── analysis/            peaks.js · fitting.js
│   └── ui/                  sidebar.js · layout.js · theme.js · session.js · workspaceExtras.js
├── docs/
│   ├── USER_MANUAL.md
│   └── METHODS.md           The mathematics behind each processing step
└── assets/favicon.svg
```

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

No framework, no bundler, no build step — the whole point is that a reviewer or
collaborator can open one file and reproduce your figure.

---

## Cite it

> Naik, R. and Srivastava, S. K. (2026). *RNSpectraX: a client-side suite for
> Raman and SERS spectral processing and comparative analysis* (Version 3.1)
> [Computer software].

A `CITATION.cff` file is included so GitHub renders a citation box automatically.

---

## Licence

Proprietary. Copying, modification, redistribution or commercial use in any
medium requires the written consent of the authors. See [`LICENSE`](LICENSE).

---

## Single-file build

`dist/rnspectrax-standalone.html` is the whole application inlined into one
file — useful when you want to email the suite to a collaborator or hand a
reviewer something that opens with a double-click. Only the Plotly, jsPDF and
MathJax CDN scripts remain external.

Rebuild it after any change to `css/` or `js/`:

```bash
python3 build-standalone.py
```
