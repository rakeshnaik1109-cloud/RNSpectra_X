# RNSpectraX™ (Spectral Plotter and Analytics Suite) — User Manual

**Authors:** [Rakesh Naik](https://scholar.google.com/citations?user=xDMzlr0AAAAJ&hl=en) and Sachin Kumar Srivastava
**Version:** 3.4 (October 2026)

> **How to cite:** Naik, R., & Srivastava, S. K. (2026). *RNSpectraX (Spectral Plotter and Analytics Suite)* (Version 3.4) [Computer software]. Zenodo. https://doi.org/10.5281/zenodo.23593680
> BibTeX: see [§9](#9-citing-rnspectrax), or **File ▾ → 📑 Cite RNSpectraX** in the app.

---

## 1. Introduction
RNSpectraX™ (Spectral Plotter and Analytics Suite) is a browser-based spectral analytics suite. The application interface is divided into two primary workspaces, accessible via the top navigation bar:
1. **Raman / Spectral Text Data:** Tailored for complex spectrometer outputs, automated peak assignments, and group averaging.
2. **Other Plots (XY + Fitting):** A general scientific XY plotter with error bars and weighted curve fitting, for data from any field.

The workspace utilizes a professional dock system. You can use the layout toolbar at the top of the interface (or keyboard shortcuts `Ctrl+1` through `Ctrl+4`) to snap the control panel to the left, right, top, or bottom of your screen. 

---

## 2. Operating in Raman / Spectral Mode

### 2.1 Data Ingestion
Click **+ Add Files** to upload your raw spectrometer data. RNSpectraX™ will automatically fingerprint the file type. 
* Supported formats: plain-text exports (`.txt`, `.csv`, `.dat`, `.asc`, `.dpt`, `.tsv`) from Ocean Optics, Horiba, Renishaw, Bruker and WITec software, JCAMP-DX (`.jdx`, `.dx`, uncompressed), and binary Thermo/Galactic SPC (`.spc`, new format; the first sub-spectrum of multi-spectrum files). Files whose X axis runs high-to-low are reordered automatically.
* Once loaded, each file generates a "Spectrum Card" in the control panel where you can assign custom labels, trace colors, and grouping tags (e.g., "Control", "Sample A").

### 2.2 Signal Processing
Before plotting, you may apply corrections to your raw data. They run in this
order: despiking → baseline → smoothing → normalisation.
* **Despiking (cosmic rays):** *Modified Z-Score* (spike replaced by interpolation)
  or *Whitaker–Hayes* (spike replaced by the mean of its clean neighbours within
  the Repair Window). Only narrow, isolated jumps are treated as spikes, so strong
  sharp bands are left alone. Start with a threshold of 6.
* **Baseline Correction:** *Linear* (two anchor points), *Polynomial*
  (iterative ModPoly, which runs underneath the bands instead of through them),
  *Rubber Band* (lower convex hull, no parameters), *Rolling Ball*, or
  *Asymmetric Least Squares (ALS)*. For ALS, **λ** (entered as log₁₀ λ, start
  at 5) sets how stiff the baseline is (raise it if the baseline climbs into
  broad bands) and **p** (start at 0.01) how tightly it hugs the bottom of the
  spectrum. ALS copes well with the curved fluorescence background of
  biological samples. Turn on
  "Show Baseline Overlay" to check the estimated baseline against the raw data.
* **Smoothing:** *Moving Average*, *Savitzky–Golay* (recommended: keeps band
  positions and heights), *Gaussian* (set σ in points) or *Median*. Keep the
  window well below the width of your narrowest band.
* **Normalisation:** *Max*, *Min–Max*, *Area*, *Vector*, *SNV* (standard normal
  variate: each spectrum minus its own mean, divided by its own standard
  deviation, the usual choice before PCA or classification), or *Reference band*,
  which divides each spectrum by its intensity at a band you choose (e.g.
  1003 cm⁻¹ phenylalanine, 1450 cm⁻¹ CH₂, or 520.7 cm⁻¹ silicon).
* **Calibration, Regions & Derivative:**
  * *Shift correction* adds a constant to every Raman shift. To measure it,
    load a reference spectrum (e.g. a silicon wafer), choose it under
    **Reference spectrum**, keep 520.7 cm⁻¹ (or type 1001.4 for polystyrene,
    1332 for diamond) and press **🎯 Measure shift from reference band**.
  * *Exclude regions* removes ranges such as `1540-1560; 2320-2340` (substrate
    bands, a detector artefact) before any processing.
  * *Derivative* (1st or 2nd, Savitzky–Golay) is applied last. A
    2nd-derivative minimum marks every band, including shoulders hidden in a
    broad envelope. Identify always matches the spectrum before the derivative.

### 2.3 Averaging & Error Bands
To compare aggregate data:
1. Ensure your files are assigned matching "Group" names in their respective cards.
   With two or more files loaded, **Quick grouping** (under Plot Mode) fills
   them for you: **By name** (`PBS_1`, `PBS_2`, `PBS_3` → `PBS`;
   `0.3125_2` → `0.3125`; time-stamped saves such as
   `Giardia_1_D1_RamanShift__0__12-54-42-123` → `Giardia_1_D1`, since the
   time/date stamp, spectrum index and words like *RamanShift* are ignored),
   **Every N files** (→ G1, G2, …) or **Reset** (all
   in one group). It also switches Plot Mode to *Group averages*.
2. Under Averaging & Error Bars, set the Plot Mode to **Group Averages**.
3. Select your error metric (SD or SEM) and style (Capped Bars or Shaded Band). The engine will calculate and render the statistics dynamically.

### 2.4 Peak Detection & Comparison
* **Detect Peaks:** marks every band whose prominence (height above the
  surrounding signal) is at least **Min Prominence** % of the spectrum's
  intensity range. Raise it to ignore noise; lower it to catch weak bands.
* **Peak table:** lists every detected band with its position, intensity and a
  suggested assignment from the built-in Raman band library. Edit any cell,
  delete rows or add your own, then click **Update Markers**.
* **Label Spacing / Max Labels:** only thin out the text labels on the plot so
  they do not overlap. Every peak stays in the table.
* **Cross-File Analyzer:** click **🔍 Compare** to sort bands across all loaded
  files into:
  * *Common Peaks:* found in every file (drawn as faint guide lines).
  * *Distinct/Unique:* found only in some files. Bands closer than **Compare
    Match ±cm⁻¹** are treated as the same band.

### 2.5 Identify — reference-library match
**🧬 Identify** compares a processed spectrum with the reference spectra of the
open **RamanBiolib** library (202 spectra of 141 biomolecules: proteins,
lipids, saccharides, amino acids, nucleic acids, metabolites, pigments,
vitamins) and ranks the closest matches.
1. Process the spectra as usual (despiking, baseline, smoothing). Matching uses
   exactly the processed spectrum you see.
2. Choose the **spectrum to identify** — a single file, a group average or the
   grand average.
3. Choose a **score**:
   * *Correlation HQI* (default) — 100·r² between the two spectra.
   * *Derivative HQI* — the same on first derivatives; tolerant of leftover
     background.
   * *Peak match* — band positions within ± tolerance; best for sharp-band
     spectra, less reliable for broad-band molecules such as proteins.
4. Optionally restrict to a **class** (e.g. Lipids) and press **🔍 Identify**.

The results list the top matches with their score and a quality label, how
each reference was measured (technique, laser wavelength) and the
**publication each reference spectrum comes from** (with DOI). Click a row to
overlay that reference on your spectrum. The box under the plot gives the full
citation of the selected reference and of the RamanBiolib library;
**↓ Results with citations** exports all of it as CSV.

**Read the result as a hypothesis.** The references are spontaneous (non-SERS)
spectra of pure compounds digitised from published figures. SERS enhancement,
mixtures, substrate bands and a different laser wavelength all change relative
band intensities. A strong score with a clear lead over the next match is good
evidence; confirm it against a measured standard before reporting.

### 2.6 Analysis — peak fitting, band ratios, PCA, difference spectra
**🔬 Analysis** works on the spectra exactly as processed for the plot. Pick a
**Tool**; the result (table, plot, **↓ Results .csv**, **↓ Plot .png**) appears
under the main plot.

* **Peak fitting (deconvolution).** Choose a spectrum (a file, a group average,
  the grand average, or *Every file, one by one*), the region (e.g. 1580–1720
  for Amide I) and either type the band positions (`1610, 1655`) or leave them
  blank and give the number of bands to find them automatically (2nd-derivative
  minima). Pick *Gaussian*, *Lorentzian* or *Pseudo-Voigt* bands and a *None*,
  *Constant* or *Linear* background. Each band's centre, FWHM, height, area and
  share of the total area are reported ± their standard errors; the plot shows
  the data, every band, their sum and the residual. In batch mode every file is
  fitted from the same start positions and each band's parameters are summarised
  per group (mean ± SD), e.g. for comparing secondary-structure fractions.
* **Band ratio / area.** Band A (a position such as `1004`, used with the ±
  window, or a range `990-1020`) and optionally band B (`1450`); *Height* or
  *Area*. Every spectrum gets a value; groups get mean, SD and SEM, a bar chart
  with the individual spectra as dots, and a significance test: Welch's t-test
  for two groups, one-way ANOVA (plus pairwise Welch tests) for three or more.
  Tick *Local baseline* only when no baseline correction was applied; the
  window must then cover the whole band.
* **PCA.** Principal component analysis of the individual spectra (≥ 3), over
  an optional region, mean-centred or autoscaled. The score plot colours each
  group and draws its 95 % confidence ellipse; the loading plot shows which
  bands drive each component (a positive loading is stronger in spectra with a
  high score). Choose which PCs to plot after the run.
* **Difference spectrum.** A − B for two groups or files, with a ± SD (or SEM)
  band from the two spreads added in quadrature, and A and B drawn above. The
  strongest positive and negative differences are listed; * marks those larger
  than twice the band.

---

## 3. Operating in XY Mode

XY mode is a general-purpose scientific plotter. It makes no assumption about
what X and Y are: calibration curves, I–V characteristics, kinetics, absorbance,
diffraction patterns, thermograms and simulation output are all handled the same
way. Peak markers and band assignments belong to the Raman mode and are not drawn
here.

### 3.1 Data Entry
* **CSV / Paste:** paste X values and Y values (comma, space or semicolon
  separated), with optional Y-error and X-error lists. If X and Y have different
  lengths, the first matching pairs are used and you are told.
* **Columns:** paste rows of `X Y [Yerr] [Xerr]`.
* **Upload File:** load one or more `.csv`, `.txt`, `.dat`, `.tsv` or Excel
  (`.xlsx`, `.xls`, `.ods`) files.
  * A file with columns `X Y [Yerr] [Xerr]` gives one dataset with error bars.
  * A **multi-column table** — one X column followed by several Y columns, such
    as a spectrometer export with a wavelength column and one column per
    spectrum — gives one dataset per column, all plotted together. Each dataset
    is named from the header row just above the numbers, and the X-axis title
    is taken from the first header cell (e.g. "Wavelength [nm]").
  * Instrument header rows ending in `-->` (e.g. `Int.time[ms]-->`,
    `NrOfAverages-->` in Avantes exports) are shown on each dataset's card.
  * In an Excel workbook every sheet that contains data is read.
  * **One measurement per file with several quantities** — e.g. an AvaSoft
    export (`mmt_1.txt`) with a title line, settings lines, a header
    `Wave;Sample;Dark;Reference;Reflectance` and a units row
    `[nm];[counts];[counts];[counts];[%]`. Every column is loaded as
    "*measurement* · *quantity*" (e.g. `mmt_1 · Reflectance`), with the units
    in the axis titles and the settings on the card. Only **Reflectance** (or
    transmittance, absorbance or irradiance; otherwise the last column) is
    ticked; switch with **Plot quantity**. Load several such files together
    and **By name** groups `mmt_1`, `mmt_2`, `mmt_3` → `mmt`, ready for group
    means ± SD and resonance tracking.
  * Semicolon-separated files with decimal commas (`175,204;-172,47`) are read
    correctly.

### 3.1a Choosing columns and averaging replicates
When more than one dataset is loaded from files, a **Columns to plot &
grouping** panel appears.
* **Plot** tick-box on each dataset card (or **All / None**) chooses which
  columns are drawn.
* **Group** box on each card: datasets with the same group name are averaged
  point by point. Columns with no group are still plotted on their own.
* **Quick grouping** fills the Group boxes of the ticked columns, in order:
  * **Every N columns** — e.g. 15 columns with N = 3 → five groups G1 … G5.
  * **By name** — the label without a trailing number, so `PBS`, `PBS_2`,
    `PBS_3` become group `PBS`. Columns with no name in the file (shown as
    "*file* · column *N*") are never grouped this way; give them a Group by
    hand if they belong together. Unnamed columns take their name from an
    instrument `Filename-->` row when the file has one.
  * **Clear groups** empties them.
* **Plot as → Group means ± spread** draws each group's mean, labelled with
  its replicate count (e.g. `PBS (n=3)`), with **± SD** or **± SEM** shown as a
  shaded band, as mean points with error bars, or both.
* **Error bars every N points.** A spectrum has thousands of points, and bars
  at every one merge into a smear. The mean curve keeps every point, while the
  mean markers and their error bars are drawn at evenly spaced points. Leave
  the field blank for automatic spacing (every point up to 60 points,
  otherwise about 40 bars), or enter N for a bar every N points. Individual
  datasets with an error column use the same spacing.

**Scale normalized Y to** (under Normalization) multiplies the normalised
curves: enter 100 to put *Max* or *Min–Max* on a 0–100 scale (%), or keep 1
for 0–1. It has no effect when Normalization is *None*.

Smoothing and normalisation are applied to every column before averaging. If
the columns of a group do not share the same X values, they are interpolated
onto the first column's X values over the range they all cover. The **CSV**
export then contains each group's mean and its SD or SEM. With **Fit** on, a
group mean is fitted weighted by its SD or SEM.

**Data Type** only pre-fills the axis labels (and reverses X for FTIR and XPS,
where that is the convention). It never changes how the data are processed.

### 3.1b Smoothing and trace style
* **Smoothing** (② Preprocessing) is applied to every plotted dataset at once —
  all pasted datasets and every column of an uploaded multi-column file. Tick
  **Show original (unsmoothed) underneath** to draw the raw data faintly behind
  each smoothed curve and judge how much the filter changed it.
* **Colours** (④ Trace Appearance): *Distinct* (default) gives every plotted
  curve — each group mean or ungrouped column — its own colour from a
  12-colour set in plot order; beyond 12 curves the colours repeat with dashed,
  dotted and dash-dot lines. *Use each dataset's own colour* uses the colour
  chosen on each card instead.
* **Trace Style** (④ Trace Appearance): *Lines*, *Markers* (scatter) or
  *Lines + markers*, with adjustable **Marker Size** and **Marker Shape**.
  *Vary per dataset* gives each dataset its own symbol, so curves stay
  distinguishable in black-and-white print.

### 3.2 Axis limits
In **Axes & Labels**, X Min / X Max are followed directly by Y Min / Y Max.
Leave a field blank to let that side follow the data; fill only one side to pin
just that limit. Limits update the plot as you type, and work together with
**Invert X**.

**Second Y axis.** Tick **Right Y axis** on a dataset (on its file card, or
under a pasted dataset) to plot it against an axis on the right, e.g.
reflectance on the left and phase or transmittance on the right. Its title and
optional limits are **Right Y label**, **Right Y Min** and **Right Y Max**.
A fit of that dataset is drawn on the same right axis.

### 3.3 Curve Fitting & Regression
1. Choose a model: linear, polynomial, exponential, power, logarithmic, Gaussian
   or Lorentzian.
2. Leave "Fit all datasets" off to fit only the first dataset, or turn it on to fit
   every dataset (fit lines then take the colour of their data).
3. Click ▶ Plot. Every parameter is reported with its 1σ standard error, along
   with R², adjusted R² and the residual sum of squares. Exponential fits also
   give the time constant τ; peak fits also give the FWHM and the area.
4. If your data include Y-errors, the fit is weighted by 1/σ² and the reduced χ²
   is reported.

### 3.3a Resonance tracking (dip vs concentration)
For SPR / LSPR sensors, or any sensor read out by the position of a dip or
peak: **⑤ Resonance Tracking**.
1. Load the spectra, tick the ones to use and group the replicates (for
   example **By name**: `PBS`, `PBS_2`, `PBS_3` → `PBS`; `2.5`, `2.5_2` → `2.5`).
2. Set the **search window** (e.g. 550–750 nm) around the resonance, choose
   **Dip** or **Peak**, and a method:
   * *Parabola fit* (default) — a least-squares parabola through the points
     within ± the half-width of the lowest point; its vertex gives a sub-pixel
     position.
   * *Centroid* — the centre of the part of the dip deeper than half its depth.
   * *Lowest point* — the lowest data point itself.
3. Press **◎ Find resonances & plot vs concentration**. The position is found
   in every replicate, then averaged per group (mean, SD, SEM; the individual
   replicate positions are listed too).
4. **Concentrations** are read from group names (`10`, `2.5`, `0.3125`,
   `10 nM` …; `PBS`, `blank`, `buffer` → 0). Edit any value, or untick a row
   to leave it out — the plot updates immediately.
5. Plot the **shift from a reference** (the blank group; its uncertainty is
   added in quadrature), the **absolute position**, or the line shape — the
   **FWHM**, the **Q factor** (position / FWHM) or the **depth** — with ± SD or
   ± SEM, on a linear or log concentration axis. The table lists the mean FWHM,
   Q and depth of every group. Width and depth are measured at half the depth
   below the mean level at the two ends of the search window, so set the window
   to include some flat signal on both sides of the resonance.
6. **Calibration fit:** *Linear* reports the sensitivity (slope, ± error), the
   limit of detection LOD = 3·SD(blank)/|slope| and of quantification
   LOQ = 10·SD(blank)/|slope|, and the same two limits from the scatter of the
   calibration points about the line (3.3 and 10 × s<sub>y/x</sub>/|slope|,
   ICH Q2). For a refractive-index calibration type **RIU** as the
   concentration unit and the sensitivity is reported in nm/RIU. *Langmuir* and *Hill*
   report the apparent K<sub>D</sub> and the maximum response; *Logarithmic*
   and *Polynomial* are also available. Fits are weighted by the error bars.
7. Download the results table (**.csv**, including every replicate position
   and the fit parameters) and the calibration plot (**.png**).

### 3.4 Cross-file comparison
With two or more files loaded in the Upload File tab, **🔍 Compare** lists the
maxima that occur in every file and those unique to some files. The match window
(in X-axis units) is set under **Cross-File Comparison**.

---

## 4. Exporting Your Work

The action bar of the control panel holds **▶ Plot** and an **↓ Export ▾** menu:
* **↓ Image:** Downloads a high-resolution snapshot of the figure in the format chosen beside it (`.png`, `.jpg`, `.tiff`, `.svg`).
* **↓ Plotted CSV** (Raman) / **↓ CSV** (XY): The *processed* data exactly as plotted.
* **↓ Stage-by-Stage Data** (Raman): One CSV per file with every processing stage.
* **↓ Fit (XY Mode):** Exports a `.txt` and a `.csv` report of every fitted parameter with its standard error and the goodness-of-fit statistics.
* **↓ PDF (Peak Tables):** Each data table contains independent export buttons to generate cleanly formatted PDF matrices of your peak assignments and comparison data.

---

## 5. Working faster

### Undo and redo
**Ctrl+Z** (⌘+Z on a Mac) undoes the last change and **Ctrl+Y** or
**Ctrl+Shift+Z** redoes it; the **↶ Undo** and **↷ Redo** buttons in the layout
bar do the same, and their tooltips name the step. One timeline covers every
setting (baseline, smoothing, normalisation, grouping, styles, figure size,
axis-title positions, analysis options …) and every annotation. A button that
changes several boxes at once, such as *Quick grouping* or a journal preset,
is undone in one step. The plot is redrawn after each undo or redo. While you
are typing in a text box, Ctrl+Z undoes the typing instead. Loading or
removing files is not part of the history, and opening a project starts a new
history.

### Finding your way around
* **Results under the plot** (peak table, Identify, Analysis, Compare,
  Resonance) are shown one at a time. When more than one exists, a row of tabs
  appears above them; a newly produced result opens its own tab.
* **Step guide:** the buttons at the top of each control panel (① Data,
  ② Process, …) get a ✓ once that step is in use; hover one to see what was
  done. Before any data is loaded *① Data* pulses, and after loading *▶ Plot*
  pulses until the first plot is drawn.
* **Fine-tuning controls** that are rarely changed sit in folds marked ▸ inside
  their section (e.g. *Baseline overlay style*, *Legend box style*, *Ticks,
  colours, label spacing & notation*). Click the fold to open it; everything
  works exactly as before.
* **File ▾** in the header holds *Save project*, *Open project* and *Methods
  text*.

### Drag and drop
Drop spectrum files anywhere on the window. Whichever mode is active receives
them, so switch to XY mode first if you are loading XY data.

### Project files (Save / Open)
**File ▾ → Save project** downloads one `.rnsx` file holding every loaded spectrum
and XY dataset, the labels, colours and groups typed on the file cards, every
setting, renamed legend entries and your annotations. **File ▾ → Open project** loads it back
and redraws the figure exactly, on any computer, so a figure can be revised
months later or sent to a co-author or supervisor. The file stays on your
computer; nothing is uploaded.

### Methods text
**File ▾ → Methods text** writes a paragraph for the Methods section of a paper
from the settings in use: number of spectra and groups, shift calibration,
excluded regions, despiking, baseline, smoothing, normalisation and derivative
with their parameters, the averaging, and the last analysis run (peak fit, band
ratio test, PCA, difference spectrum; in XY mode the fit, resonance method,
calibration and LOD/LOQ), followed by the references for the methods used.
Edit it, then **Copy** or download it as `.txt`.

### Session memory
Every processing and styling control is written to this browser's local storage
and restored on your next visit, so an analysis recipe survives a reload. The
app also reopens in the workspace you were last using (Raman or XY), on the same
XY input tab. A link ending in `#xy` (or `#raman`) always opens that workspace
first. Your
spectrum files are never stored — reload them each session. To start from
defaults, press `?` and choose **Clear saved settings**.

### Dark workspace
The moon icon in the header switches the interface to dark. The figure canvas
stays white in both modes on purpose: what you see on screen is what lands in
the exported image.

### Keyboard
Press `?` for the full sheet. The essentials:

| Action | Keys |
|---|---|
| Dock panel left / right / top / bottom | `Ctrl` `1` – `4` |
| Collapse or restore the panel | `Ctrl` `\\` |
| Open the shortcut sheet | `?` |
| Close any overlay | `Esc` |

---

### Moving the axis titles
Drag the X or Y axis title on the plot to put it anywhere in the figure; click
it (without dragging) to edit its text. A moved title can be dragged again, is
kept after a reload and in `.rnsx` projects, and appears exactly there in every
exported image. It always stays inside the figure so it cannot be cut off.
**↺ Reset title positions** (under *Axes & Labels*) puts both titles back.

### Legend text
In the **Legend** panel (both workspaces), **🔤 Legend Text** sets the legend's
**Font** (*Same as figure*, or its own typeface), **Size** (the same setting
as *Figure Size & Font → Legend Size*; the two boxes stay linked) and
**Colour**, and **Bold** (the same setting as *Figure Size & Font → Bold →
Legend*). Changes apply to the plot at once.

### Axis numbers
In **Axis Frame, Grid & Notation** (both workspaces), **🔢 Axis Numbers** sets
the **Font** of the numbers on both axes (*Same as figure*, or its own
typeface), their **Size** (linked to *Figure Size & Font → Tick Size*),
**Colour** and **Bold**. Their number format (scientific, SI prefix, plain) is
under the *Ticks, colours, label spacing & notation* fold below.

### Axis lines and tick marks
In **Axis Frame, Grid & Notation** (both workspaces): **Axis Line Width** makes
the axes / frame bold, **Tick Width** and **Tick Length** style the tick marks,
and **Axis Colour** sets the colour of both. **Bold** under *🔢 Axis Numbers* makes the
axis numbers bold (the same setting as **Figure Size & Font → Bold → Tick
Labels**; the two boxes stay linked). Title, axis-label and legend boldness are
under **Figure Size & Font → Bold**.

---

### Annotating the plot
The bar above each plot adds labels that are saved with the session and appear
in every export. Its single row holds the everyday actions — label text,
**🅣 Text**, **↗ Arrow**, **📍 Label point**, **🗑 Delete**, **↶ Undo** — and
**⋯ More** opens a second row with symbols, marker lines, regions, font and
colour, **🎨 Apply style**, **⧉ Duplicate** and **Clear all** (it stays open
or closed as you left it).

- **🅣 Text / ↗ Arrow**: type the text in the box first (or leave it empty for
  a bare arrow). **Ω Symbol** inserts cm⁻¹, ±, °, µ, λ, Δ, Å and similar;
  `H<sub>2</sub>O`, `cm<sup>-1</sup>`, `<b>…</b>` and `<i>…</i>` also work.
- **📍 Label point**: click the button, then click a point on a curve. An arrow
  with the X value (e.g. *1004 cm⁻¹*) is pinned to that data point, so it stays
  put when you zoom or change the axis range.
- **┆ Marker line**: dashed vertical line(s) at the X values you type, e.g.
  `1004, 1450, 1655`, each labelled at the top.
- **▥ Region**: a translucent band between two X values (`1600-1700`) with an
  optional label such as *Amide I*.
- Boxes, circles and free lines: ▭ ○ ╱ in the chart's own toolbar.

**Editing one item.** Click a text or arrow to select it (a dashed blue outline
appears; for shapes, click the shape). Then:
**Delete** (or the Delete / Backspace key) removes only that item,
**⧉ Duplicate** copies it, and **🎨 Apply style** gives it the font, size, bold /
italic, box and colour currently set in the bar (and the typed text, if any).
Drag to move; double-click text to rewrite it. **↶ Undo** (Ctrl/⌘+Z) reverses
the last change, including a Delete or **Clear all**. Esc cancels a selection
or point picking.

---

## 6. Getting a figure a journal will accept

1. **Set the canvas size before you export,** not after. Scaling a raster image
   afterwards is what makes axis labels look soft.
2. **Export SVG** when the journal accepts vector art; it stays sharp at any size
   and reviewers can zoom into your bands.
3. **Use the journal presets** in the styling section to match common column
   widths and font sizes.
4. **Say what the shaded band is.** SD and SEM answer different questions, and a
   caption that omits which one was plotted is not reproducible.
5. **Report the pipeline.** Despiking threshold, baseline method and order,
   smoothing window, normalisation, and replicate count. `docs/METHODS.md` lists
   exactly what each step computes so you can describe it precisely.

---

## 7. If something looks wrong

| What you see | Likely cause |
|---|---|
| The file loads but the plot is empty | The parser found no numeric pairs — open the file and check for a header block the format detector did not recognise |
| Peaks disappear after smoothing | The smoothing window is wider than your narrowest band; reduce it, or switch to Savitzky–Golay |
| The corrected spectrum dips below zero | The baseline is over-fitted; lower the polynomial order or increase the rolling-ball radius |
| Too many or too few peaks marked | Adjust **Min Prominence**; smoothing first also suppresses noise peaks |
| A sharp genuine band is flattened by despiking | Raise the despike threshold; bands only 1–2 pixels wide cannot be told apart from spikes, so leave despiking off for such data |
| Group averaging produces nothing | Group names must match exactly, including case and spacing |
| Fitted curve ignores the peak | Peak models fit one dominant peak; for data with several peaks, fit the region around the one you want, or pick the model that matches the physics |
| "This model could not be fitted" | Too few points for the model, or power/log models with no x > 0 |
| Reduced χ² far from 1 | The model is missing something, or the Y-errors are mis-scaled |

---

## 8. A note on assignments

Band assignments are **suggestions from a reference table**, matched by position
within a tolerance. Positions shift with environment, protonation state and
plasmonic coupling. Treat every assignment as a hypothesis to confirm against
reference spectra, not as an identification.

---

## 9. Citing RNSpectraX

If RNSpectraX contributes to published work, please cite it. **File ▾ → 📑 Cite
RNSpectraX** in the app shows these entries with copy buttons, and the
**Methods text** includes the citation automatically.

> Naik, R., & Srivastava, S. K. (2026). RNSpectraX (Spectral Plotter and Analytics Suite) (Version 3.4) [Computer software]. Zenodo. https://doi.org/10.5281/zenodo.23593680

```bibtex
@software{naik_rnspectrax_2026,
  author    = {Naik, Rakesh and Srivastava, Sachin Kumar},
  title     = {{RNSpectraX (Spectral Plotter and Analytics Suite)}},
  version   = {3.4},
  year      = {2026},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.23593680},
  url       = {https://doi.org/10.5281/zenodo.23593680}
}
```
