# RNSpectraX™ (Spectral Plotter and Analytics Suite) — User Manual

**Author:** Rakesh Naik
**Date:** June 2026

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
  *Rubber Band* (lower convex hull, no parameters), or *Rolling Ball*. Turn on
  "Show Baseline Overlay" to check the estimated baseline against the raw data.
* **Smoothing:** *Moving Average*, *Savitzky–Golay* (recommended: keeps band
  positions and heights), *Gaussian* (set σ in points) or *Median*. Keep the
  window well below the width of your narrowest band.
* **Normalisation:** *Max*, *Min–Max*, *Area*, *Vector*, or *Reference band*,
  which divides each spectrum by its intensity at a band you choose (e.g.
  1003 cm⁻¹ phenylalanine, 1450 cm⁻¹ CH₂, or 520.7 cm⁻¹ silicon).

### 2.3 Averaging & Error Bands
To compare aggregate data:
1. Ensure your files are assigned matching "Group" names in their respective cards.
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
    `PBS_3` become group `PBS`.
  * **Clear groups** empties them.
* **Plot as → Group means ± spread** draws each group's mean, labelled with
  its replicate count (e.g. `PBS (n=3)`), with **± SD** or **± SEM** shown as a
  shaded band, error bars, or both.

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
* **Trace Style** (④ Trace Appearance): *Lines*, *Markers* (scatter) or
  *Lines + markers*, with adjustable **Marker Size** and **Marker Shape**.
  *Vary per dataset* gives each dataset its own symbol, so curves stay
  distinguishable in black-and-white print.

### 3.2 Axis limits
In **Axes & Labels**, X Min / X Max are followed directly by Y Min / Y Max.
Leave a field blank to let that side follow the data; fill only one side to pin
just that limit. Limits update the plot as you type, and work together with
**Invert X**.

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

### 3.4 Cross-file comparison
With two or more files loaded in the Upload File tab, **🔍 Compare** lists the
maxima that occur in every file and those unique to some files. The match window
(in X-axis units) is set under **Cross-File Comparison**.

---

## 4. Exporting Your Work

RNSpectraX™ features sticky action buttons pinned to the bottom of the control panel for rapid extraction of processed data.
* **▶ Plot:** Renders the canvas based on current parameters.
* **↓ Image:** Downloads a high-resolution snapshot of the Plotly canvas in your chosen format (`.png`, `.jpg`, `.svg`).
* **↓ CSV:** Downloads the *processed* array matrices (post-smoothing, post-baseline correction) for external use.
* **↓ Fit (XY Mode):** Exports a `.txt` and a `.csv` report of every fitted parameter with its standard error and the goodness-of-fit statistics.
* **↓ PDF (Peak Tables):** Each data table contains independent export buttons to generate cleanly formatted PDF matrices of your peak assignments and comparison data.

---

## 5. Working faster

### Drag and drop
Drop spectrum files anywhere on the window. Whichever mode is active receives
them, so switch to XY mode first if you are loading XY data.

### Session memory
Every processing and styling control is written to this browser's local storage
and restored on your next visit, so an analysis recipe survives a reload. Your
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
