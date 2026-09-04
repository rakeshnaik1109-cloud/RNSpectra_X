# RNSpectraX™ User Manual

**Author:** Rakesh Naik
**Date:** June 2026

---

## 1. Introduction
RNSpectraX™ is an advanced spectral analytics suite. The application interface is divided into two primary workspaces, accessible via the top navigation bar:
1. **Raman / Spectral Text Data:** Tailored for complex spectrometer outputs, automated peak assignments, and group averaging.
2. **Other Plots (XY + Fitting):** Tailored for general optical data, fluorescence, XRD, and mathematical curve fitting.

The workspace utilizes a professional dock system. You can use the layout toolbar at the top of the interface (or keyboard shortcuts `Ctrl+1` through `Ctrl+4`) to snap the control panel to the left, right, top, or bottom of your screen. 

---

## 2. Operating in Raman / Spectral Mode

### 2.1 Data Ingestion
Click **+ Add Files** to upload your raw spectrometer data. RNSpectraX™ will automatically fingerprint the file type. 
* Supported formats: `.txt`, `.csv`, `.dat`, `.asc`, `.spc`, `.jdx`, `.tsv`.
* Once loaded, each file generates a "Spectrum Card" in the control panel where you can assign custom labels, trace colors, and grouping tags (e.g., "Control", "Sample A").

### 2.2 Signal Processing
Before plotting, you may apply mathematical corrections to your raw data:
* **Despiking (Cosmic Ray):** Select *Modified Z-Score* or *Whitaker-Hayes*. Adjust the Z-Threshold to aggressively target anomalous spikes without distorting genuine Raman bands.
* **Baseline Correction:** Select from *Linear*, *Polynomial Fit*, *Rubber Band*, or *Rolling Ball*. Toggle "Show Baseline Overlay" to visualize the calculated baseline beneath your spectra.
* **Smoothing:** Apply *Moving Average*, *Savitzky-Golay*, *Gaussian*, or *Median* filters to reduce high-frequency noise.

### 2.3 Averaging & Error Bands
To compare aggregate data:
1. Ensure your files are assigned matching "Group" names in their respective cards.
2. Under Averaging & Error Bars, set the Plot Mode to **Group Averages**.
3. Select your error metric (SD or SEM) and style (Capped Bars or Shaded Band). The engine will calculate and render the statistics dynamically.

### 2.4 Peak Detection & Comparison
* **Detect Peaks:** Checking this box highlights local maxima on the plot. The Peak Table below the graph lists the coordinate, intensity, and estimated biomolecular assignment.
* **Cross-File Analyzer:** Click the **🔍 Compare** button to run the clustering algorithm. This tool scans all loaded files and sorts peaks into two categories:
  * *Common Peaks:* Universal vibrations found across all loaded files (visualized as subtle background guide lines).
  * *Distinct/Unique:* Anomalous peaks found only in specific traces.

---

## 3. Operating in XY Mode

### 3.1 Data Entry
XY mode allows for manual data manipulation. You can upload standard CSVs, or use the **Data Entry** tabs to paste columns of data directly from your clipboard. Third and fourth columns are automatically parsed as Y-Error and X-Error respectively.

### 3.2 Curve Fitting & Regression
1. Under the Curve Fitting section, select a mathematical model (e.g., *Gaussian peak*, *Lorentzian peak*, *Polynomial*).
2. To fit a single trace, uncheck "Fit all datasets". To fit every trace on the canvas simultaneously, check "Fit all datasets" (the fitted lines will automatically inherit the color of their parent data).
3. Click ▶ Plot. The calculated coefficients (R², residual sum of squares, amplitude, center) will appear in a scrollable log window.

---

## 4. Exporting Your Work

RNSpectraX™ features sticky action buttons pinned to the bottom of the control panel for rapid extraction of processed data.
* **▶ Plot:** Renders the canvas based on current parameters.
* **↓ Image:** Downloads a high-resolution snapshot of the Plotly canvas in your chosen format (`.png`, `.jpg`, `.svg`).
* **↓ CSV:** Downloads the *processed* array matrices (post-smoothing, post-baseline correction) for external use.
* **↓ Fit (XY Mode):** Exports a detailed `.txt` and `.csv` report of all mathematical curve-fitting coefficients.
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
| Group averaging produces nothing | Group names must match exactly, including case and spacing |
| Fitted curve ignores the peak | Peak models need a starting region that contains the peak; crop the range or pick the model that matches the physics |

---

## 8. A note on assignments

Band assignments are **suggestions from a reference table**, matched by position
within a tolerance. Positions shift with environment, protonation state and
plasmonic coupling. Treat every assignment as a hypothesis to confirm against
reference spectra, not as an identification.
