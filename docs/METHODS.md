# Methods

What each processing step actually computes, so a result from RNSpectraX can be
described precisely in a manuscript.

> **Cite the software as:** Naik, R., & Srivastava, S. K. (2026). *RNSpectraX (Spectral Plotter and Analytics Suite)* (Version 3.4) [Computer software]. Zenodo. https://doi.org/10.5281/zenodo.23593680

Throughout, a spectrum is a pair of vectors $(x_i, y_i)$ for $i = 1 \dots N$,
with $x$ in cm⁻¹ (Raman shift), nm (wavelength) or degrees (2θ), and $y$ in
counts or arbitrary intensity units.

---

## 1. Despiking (cosmic-ray removal)

A cosmic ray striking the CCD produces a narrow, high-amplitude spike that is
uncorrelated with any vibrational mode. Spikes are found on the **first
difference** of the signal, $\nabla y_i = y_{i+1} - y_i$, with a robust
(modified) Z-score:

$$
Z_i = \frac{0.6745\,\bigl(\nabla y_i - \tilde{\nabla y}\bigr)}{\mathrm{MAD}},
\qquad
\mathrm{MAD} = \operatorname{median}\bigl(\,\lvert \nabla y_i - \tilde{\nabla y}\rvert\,\bigr)
$$

The median and MAD are used because ordinary means and standard deviations are
themselves distorted by the outliers they are meant to find; the constant 0.6745
makes the MAD a consistent estimator of $\sigma$ for normally distributed noise.

At high signal-to-noise ratio the flanks of a strong, sharp band also produce
outlying differences, so an outlier alone is not taken as a spike. A run of
points $a+1 \dots b$ is flagged only when

1. the jump into it is an outlier, $\lvert Z_a \rvert$ above the threshold;
2. within at most three points the signal returns to about the level before the
   jump, $\lvert y_{b+1} - y_a \rvert < \tfrac12 \lvert \nabla y_a \rvert$; and
3. the steps just outside the run are small compared with that jump,
   $\lvert \nabla y_{a-1} \rvert,\ \lvert \nabla y_{b+1} \rvert < \tfrac12 \lvert \nabla y_a \rvert$.

A spike rises out of locally smooth signal in a single step and drops back just
as abruptly; a genuine band rises over several comparable steps and stays up
for a band-width. Downward spikes (dead pixels) are treated the same way. A
band only one or two pixels wide cannot be distinguished from a spike in a
single spectrum. If your instrument undersamples that severely, leave
despiking off, or compare repeat acquisitions instead.

**Repair.**

- *Modified Z-score:* each flagged point is replaced by linear interpolation
  between the nearest unflagged neighbours.
- *Whitaker–Hayes:* each flagged point is replaced by the mean of the unflagged
  points within $\pm w$ samples (the Repair Window), following Whitaker & Hayes
  (2018). Flagged points are excluded, so a cluster of spikes cannot repair
  itself.

**Choosing a threshold.** Start at 6. Lower it if visible spikes survive; raise
it if anything else is being changed. Compare a corrected spectrum to the raw
trace (Show Original) before committing.

---

## 2. Baseline correction

Fluorescence background, substrate scattering and detector offset add a slowly
varying $b(x)$ to the true signal. Each method estimates $b$ and returns
$y_i - b(x_i)$.

### Linear (two-point)

$b$ is the straight line through the signal at the two anchor wavenumbers you
specify. Fast, transparent, and adequate over a narrow window.

### Polynomial (iterative, ModPoly)

A single least-squares polynomial passes *through* the Raman bands, so the
corrected spectrum dips below zero beside every band and band heights are
underestimated. RNSpectraX instead uses the modified polynomial method of
Lieber & Mahadevan-Jansen (2003):

$$
b^{(0)} = \operatorname{fit}_p(y), \qquad
y^{(k+1)}_i = \min\!\bigl(y^{(k)}_i,\ b^{(k)}(x_i)\bigr), \qquad
b^{(k+1)} = \operatorname{fit}_p\bigl(y^{(k+1)}\bigr)
$$

where $\operatorname{fit}_p$ is a least-squares polynomial of degree $p$. At each
iteration the signal is clipped to the current baseline wherever it rises above
it, so the bands progressively stop pulling the fit upward. Iteration stops when
the baseline changes by less than 0.1 % (relative RMS), or after 100 passes.
Before fitting, $x$ is centred and scaled to $[-1, 1]$; raw wavenumbers raised to
high powers would make the normal equations numerically singular.

Low orders (2–4) capture broad fluorescence. High orders start following broad
bands. If the corrected band heights change sharply as you increase the order,
the order is too high.

### Rubber band

The convex hull of the spectrum from below, evaluated as a piecewise-linear
function. Geometrically it is the curve a rubber band would take if stretched
under the spectrum: it touches the signal only at hull vertices and never rises
above it, so the corrected spectrum is non-negative by construction. No
parameters, which makes it a good neutral default.

### Rolling ball

A structuring element of half-width $r$ (in sample points) is rolled along the
underside of the spectrum, implemented as a grey-scale morphological opening:
a running minimum over $\pm r$ points (erosion) followed by a running maximum
over $\pm r$ points (dilation), with a flat element. Set $r$ larger than the
widest genuine band and smaller than the scale of the background curvature.

### Asymmetric least squares (ALS)

Following Eilers & Boelens (2005), the baseline $z$ minimises

$$\sum_i w_i (y_i - z_i)^2 + \lambda \sum_i (\Delta^2 z_i)^2,$$

where $\Delta^2$ is the second difference. Points above the current baseline
get weight $p$ and points below it $1-p$; with $p \ll 1$ the baseline is pushed
under the bands. The weights are updated and the system re-solved until they
stop changing (at most 15 passes). $W + \lambda D^\top D$ is pentadiagonal, so
each pass is an $O(n)$ banded Cholesky solve. λ is entered as $\log_{10}\lambda$
(typically 4–7, default 5); $p$ is typically 0.001–0.05 (default 0.01). λ is
per sample point, so a spectrum with a finer point spacing needs a larger λ
for the same stiffness.

---

## 3. Smoothing

All four filters trade noise variance against band distortion. The signal-to-noise
gain is roughly $\sqrt{m}$ for a window of $m$ points, while a band narrower than
the window is broadened and flattened. **Keep the window well below the FWHM of
your narrowest band.**

| Filter | Computation | Behaviour |
|---|---|---|
| Moving average | Mean of $m$ neighbours | Strongest noise reduction, worst peak distortion |
| Savitzky–Golay | Local least-squares polynomial of order $p$ over $m$ points, evaluated at the centre point (the window is truncated, not shifted, at the ends) | Preserves peak position, height and width far better; the standard choice for spectroscopy |
| Gaussian | Convolution with $\exp(-k^2/2\sigma^2)$, $\sigma$ in points, kernel truncated at $\pm 3\sigma$ | Smooth response, no ringing |
| Median | Median of $m$ neighbours | Non-linear; removes residual impulses without blurring edges |

Savitzky–Golay is a convolution with fixed coefficients, so it costs the same as
a moving average and is almost always the better choice.

---

## 4. Normalisation

Applied after baseline correction and smoothing, so it acts on the signal rather
than the background. It makes relative band intensities comparable across
samples whose absolute intensities differ (laser power drift, focus, integration
time).

| Method | Each spectrum is divided by |
|---|---|
| Max | its largest value |
| Min–Max | rescaled so its minimum is 0 and its maximum is 1 |
| Area | $\int \lvert y \rvert\,dx$, by the trapezoidal rule over its own $x$ values |
| Vector | its Euclidean norm $\sqrt{\sum y_i^2}$ |
| Reference band | its maximum within $\pm\Delta$ of a chosen band position, e.g. 1003 cm⁻¹ (phenylalanine), 1450 cm⁻¹ (CH₂) or 520.7 cm⁻¹ (silicon). Spectra with no positive signal there are left unscaled |

In XY mode the normalised curve can then be multiplied by a constant
(**Scale normalized Y to**), e.g. 100 to report Max or Min–Max as a percentage.

---

## 5. Group statistics

Spectra are averaged on the $x$ grid of the first spectrum in the group, with
every other spectrum linearly interpolated onto it. Only the range covered by
**all** spectra in the group is used, since outside it interpolation would only
repeat end values. Files whose $x$ axis is stored in descending order are put in
ascending order on loading. At each point:

$$
\bar{y} = \frac{1}{n}\sum_{j=1}^{n} y_j,
\qquad
s = \sqrt{\frac{1}{n-1}\sum_{j=1}^{n}\left(y_j - \bar{y}\right)^2},
\qquad
\mathrm{SEM} = \frac{s}{\sqrt{n}}
$$

**Which to plot.** SD describes how much individual spectra scatter — use it to
show sample heterogeneity. SEM describes how precisely the mean is known — use it
when comparing group means. SEM shrinks as you add replicates; SD does not.
State which one the shaded band represents in every figure caption.

---

## 6. Peak detection

Every local maximum (a flat top counts once, at its centre) is a candidate. Each
candidate's **topographic prominence** is computed: from the peak, walk left and
right until the signal rises above the peak or the spectrum ends; the prominence
is the peak height minus the higher of the two minima found on those walks.
A candidate is kept when its prominence is at least the **Min Prominence**
setting, expressed as a percentage of the spectrum's intensity range
(default 5 %).

Prominence is what distinguishes a real band from noise or a ripple riding on a
shoulder, and unlike an absolute height threshold it does not depend on the
baseline level or on display offsets. Raise the setting to ignore noise; lower
it to catch weak bands.

Every detected peak is listed in the peak table and marked on the plot. **Label
Spacing** and **Max Labels** only thin out the text labels so they do not
overlap; they never remove peaks from the table.

### Band assignments

Each peak is matched against a reference library of about 35 Raman bands
commonly reported for biological samples and SERS (e.g. phenylalanine
1003 cm⁻¹, tyrosine Fermi doublet 830/853 cm⁻¹, Amide III 1230–1285 cm⁻¹,
CH₂ deformation 1450 cm⁻¹, Amide I α-helix 1655 cm⁻¹ and β-sheet 1670 cm⁻¹,
lipid C=O ester 1740 cm⁻¹, CH stretches 2850–2935 cm⁻¹, and the silicon
phonon at 520.7 cm⁻¹, which often comes from the substrate or a calibration
wafer). Each library entry has its own matching half-width; a peak takes the
entry whose centre is nearest, provided it falls inside that half-width, and is
otherwise reported as *Unassigned*. Positions follow Movasaghi *et al.* (2007)
and Talari *et al.* (2015).

**Assignments are suggestions, not identifications.** Band positions shift with
environment, protonation state and substrate coupling. Confirm against reference
spectra before reporting. Every assignment can be edited in the peak table.

---

## 6a. Reference-library identification

The query is the processed spectrum (§1–4). It is linearly interpolated onto
the library grid (450–1800 cm⁻¹, 1 cm⁻¹) over the range it shares with the
library (at least 200 cm⁻¹ is required). By default a rubber-band baseline
(§2) is removed from it again, because the reference spectra are
baseline-free. Query and every reference are then min–max normalised over
that common range.

* **Correlation HQI** $= 100\,\max(r,0)^2$, with $r$ the Pearson correlation
  coefficient of query and reference.
* **Derivative HQI** — the same on first derivatives computed with the
  five-point stencil $y'_i = (-y_{i+2} + 8y_{i+1} - 8y_{i-1} + y_{i-2})/12$.
  Differentiation suppresses slowly varying background and emphasises band
  position and shape.
* **Peak match** — bands of the query are detected as in §6. Each is paired
  with the nearest unused reference band within $\pm\delta$, and the score is
  $100\,m/(N_q + N_r - m)$, with $m$ the number of pairs and $N_q$, $N_r$ the
  numbers of query and reference bands in the common range (intersection over
  union).

Reference spectra: **RamanBiolib** — M. Terán, J. J. Ruiz, P. Loza-Alvarez,
D. Masip, D. Merino, *Open Raman spectral library for biomolecule
identification*, Chemometr. Intell. Lab. Syst. 264, 105476 (2025),
doi:10.1016/j.chemolab.2025.105476; Open Database License v1.0. Every
reference spectrum in it is digitised from a published figure, and that
publication is cited with each match.

---

## 7. Cross-file comparison

Peaks from every loaded spectrum are pooled and clustered along the $x$ axis
with a tolerance window. A cluster containing a peak from every spectrum is
reported as a **common band**; a cluster confined to a subset is reported as
**distinct**, with the contributing traces listed. This is the operation you
want when asking "what is present in the treated sample that is absent in the
control".

---

## 8. Curve fitting

All models minimise the (optionally weighted) sum of squared residuals

$$
\chi^2 = \sum_{i=1}^{N} w_i \bigl( y_i - f(x_i;\,\boldsymbol\theta) \bigr)^2,
\qquad
w_i = \begin{cases} 1/\sigma_i^2 & \text{if a Y-error column is supplied} \\ 1 & \text{otherwise.} \end{cases}
$$

| Model | Function | Solver |
|---|---|---|
| Linear | $y = a x + b$ | Exact weighted least squares |
| Polynomial (order $p$) | $y = \sum_{k=0}^{p} a_k x^k$ | Exact weighted least squares |
| Exponential | $y = A\,e^{b x} + c$ | Levenberg–Marquardt |
| Power | $y = a\,x^{b}$ | Levenberg–Marquardt ($x > 0$) |
| Logarithmic | $y = a \ln x + b$ | Exact weighted least squares ($x > 0$) |
| Gaussian | $y = y_0 + A \exp\!\left(-\dfrac{(x-x_0)^2}{2\sigma^2}\right)$ | Levenberg–Marquardt |
| Lorentzian | $y = y_0 + \dfrac{A\,\gamma^2}{(x-x_0)^2 + \gamma^2}$ | Levenberg–Marquardt |

**Linear-in-parameters models** are solved in one step. Before solving, $x$ is
centred and scaled to $t = (x - \bar{x})/s$ so that high polynomial orders on
large abscissae (e.g. wavenumbers near 2000) stay numerically well conditioned;
the coefficients and their covariance are then transformed back to plain powers
of $x$.

**Non-linear models** are refined by Levenberg–Marquardt from a data-driven
starting point: a log-linearisation for the exponential and power laws, and the
height, position and half-width of the dominant feature for the peak models.
Peaks may point up (emission, diffraction) or down (absorption dips). The
exponential is tried with its asymptote both below and above the data, so decays,
growths and charging curves ($y = c - A' e^{-x/\tau}$) are all handled, and the
better of the two solutions is kept. Because the final fit is made on the
original data rather than on a transformed copy, residuals are weighted
correctly.

Choose a peak model by physics, not by R². A Lorentzian is the natural lineshape
for a homogeneously broadened transition (lifetime broadening); a Gaussian arises
from inhomogeneous broadening across an ensemble of environments. Real bands are
often between the two: a Lorentzian will usually fit the tails better while a
Gaussian fits the core.

### Uncertainties and quality metrics

Parameter standard errors are the square roots of the diagonal of

$$
\mathbf{C} = \bigl(\mathbf{J}^{\mathsf T}\mathbf{W}\mathbf{J}\bigr)^{-1}\,\chi^2_\nu,
\qquad
\chi^2_\nu = \frac{\chi^2}{N - k},
$$

where $\mathbf{J}$ is the Jacobian of the model with respect to the $k$ parameters
at the optimum. Scaling by $\chi^2_\nu$ means the errors reflect the observed
scatter about the fit, which is the default convention of most analysis
packages. Derived quantities are propagated through $\mathbf{C}$ (delta method):
the time constant $\tau = 1/|b|$ for exponentials, and the FWHM
($2\sqrt{2\ln 2}\,\sigma$ or $2\gamma$) and integrated area
($\sqrt{2\pi}A\sigma$ or $\pi A\gamma$) for peaks.

$$
R^2 = 1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2},
\qquad
\bar{R}^2 = 1 - (1 - R^2)\,\frac{N - 1}{N - k},
\qquad
\mathrm{RSS} = \sum_i (y_i - \hat{y}_i)^2
$$

When the fit is weighted, the reduced $\chi^2_\nu$ is also reported: a value near
1 means the model describes the data to within the stated errors; much larger
than 1 means the model is missing something or the errors are underestimated;
much smaller than 1 suggests the errors are overestimated. (It is hidden when Y
is normalised, because the errors are then no longer in the units of Y.)

$R^2$ rises whenever a parameter is added, so it cannot be used to choose between
models of different complexity — inspect the residuals for structure instead. A
good fit leaves residuals that look like noise; a poor one leaves a pattern.

---

## 9. Resonance tracking (XY mode)

For each spectrum, after smoothing and normalisation, the resonance is located
inside a user-defined window $[\lambda_a, \lambda_b]$:

* **Parabola fit.** Let $i^\*$ be the index of the extreme point. A parabola
  $y = c_0 + c_1(\lambda-\lambda_{i^\*}) + c_2(\lambda-\lambda_{i^\*})^2$ is fitted
  by least squares to the points with $|\lambda - \lambda_{i^\*}| \le h$, and the
  resonance is its vertex $\lambda_{\mathrm{res}} = \lambda_{i^\*} - c_1/(2c_2)$.
  If the parabola opens the wrong way or its vertex leaves the fitted range,
  the extreme point is used.
* **Centroid.** With depth $d = y_{\max} - y_{\min}$ inside the window, the
  contiguous region around the minimum with $y \le y_{\min} + d/2$ is taken and
  $\lambda_{\mathrm{res}} = \sum w_i\lambda_i / \sum w_i$, with
  $w_i = (y_{\min} + d/2) - y_i$.
* **Lowest point.** $\lambda_{\mathrm{res}} = \lambda_{i^\*}$.

Peaks are handled by applying the same rules to $-y$.

The position is found in **every replicate** and the replicates of a group are
then summarised by mean, SD and SEM. This is preferred over locating the
resonance of the averaged spectrum, because the replicate scatter of the
position is exactly what the error bar should describe.

The shift from a reference (blank) group is
$\Delta\lambda = \bar\lambda - \bar\lambda_{\mathrm{ref}}$, with
$\sigma_{\Delta} = \sqrt{\sigma^2 + \sigma_{\mathrm{ref}}^2}$ for every group other
than the reference.

Calibration models (weighted by $1/\sigma^2$, solved as in §8):

$$
\text{Langmuir: } \Delta\lambda = y_0 + \frac{A\,C}{K + C},
\qquad
\text{Hill: } \Delta\lambda = y_0 + \frac{A\,C^{\,n}}{K^{\,n} + C^{\,n}}
$$

$K$ is the concentration at half saturation (an apparent dissociation constant
when the surface response follows a 1:1 isotherm) and $A$ the response at
saturation. For a **linear** calibration the sensitivity is the slope $S$, and
the limit of detection is

$$
\mathrm{LOD} = \frac{3\,\sigma_{\mathrm{blank}}}{|S|},
$$

with $\sigma_{\mathrm{blank}}$ the SD of the blank group's replicate positions.
The LOD needs at least two blank replicates; more are better.

---

## 10. Shift calibration, excluded regions and derivatives

The shift correction $\delta$ is added to every abscissa before processing,
$\tilde\nu' = \tilde\nu + \delta$. Measured from a reference spectrum, the
band maximum within $\pm w$ of the literature position $\tilde\nu_{\mathrm{ref}}$
is refined by a parabola through the seven points around it, and
$\delta = \tilde\nu_{\mathrm{ref}} - \tilde\nu_{\mathrm{measured}}$.

Points inside excluded ranges are removed before despiking.

Derivatives use a Savitzky–Golay filter evaluated in the true abscissa offsets
$t_j = x_j - x_i$, so the result is in intensity per cm⁻¹ even for uneven
spacing: a local least-squares polynomial $\sum_k c_k t^k$ over the window
gives $dy/dx = c_1$ and $d^2y/dx^2 = 2c_2$.

## 11. Band fitting (deconvolution)

A region is modelled as
$y(x) = \sum_k A_k\,f(x; c_k, w_k) + b_0 + b_1 (x - \bar x)$ with
Gaussian $f = \exp[-4\ln 2\,(x-c)^2/w^2]$, Lorentzian
$f = 1/[1 + 4(x-c)^2/w^2]$ or pseudo-Voigt
$f = \eta L + (1-\eta) G$ ($w$ = FWHM, $0 \le \eta \le 1$ through a logistic
transform). Parameters are found by Levenberg–Marquardt. Start positions are
typed or taken from the deepest minima of the second derivative; start
heights from the data above a straight line through the region ends; start
widths from the half-height crossing. Standard errors come from
$(J^\top J)^{-1} s^2$ with $s^2 = \mathrm{RSS}/(n-p)$. Areas are
$1.0645\,A w$ (Gaussian), $\tfrac{\pi}{2} A w$ (Lorentzian) and their
η-weighted mean (pseudo-Voigt); their errors are propagated through the full
covariance matrix of $(A, w, \eta)$.

## 12. Band ratios and group tests

A band height is the maximum inside the band window, and its area the
trapezoidal integral; with *local baseline*, a straight line joining the
window ends is subtracted first. Two groups are compared by Welch's t-test,
$t = (\bar a - \bar b)/\sqrt{s_a^2/n_a + s_b^2/n_b}$ with the
Welch–Satterthwaite degrees of freedom; three or more by one-way ANOVA,
$F = [\mathrm{SS_B}/(k-1)]/[\mathrm{SS_W}/(N-k)]$. p-values come from the
regularised incomplete beta function. Pairwise tests after an ANOVA are not
corrected for multiple comparisons.

## 13. Principal component analysis

The $n$ spectra are interpolated onto the first spectrum's points, mean-centred
(optionally divided by the standard deviation at every point), and the $n\times n$
matrix $ZZ^\top$ is diagonalised by Jacobi rotations. With eigenvalues
$\lambda_k$ and unit eigenvectors $u_k$, the scores are $\sqrt{\lambda_k}\,u_k$,
the loadings $Z^\top u_k/\sqrt{\lambda_k}$, and the explained variance
$\lambda_k/\sum\lambda$. The 95 % ellipse of a group is
$\{z : (z-\bar z)^\top S^{-1}(z-\bar z) \le \chi^2_{2,0.95} = 5.991\}$ for its
score covariance $S$.

## 14. Difference spectra

$\Delta(x) = \bar y_A(x) - \bar y_B(x)$, with B linearly interpolated onto A's
points, and uncertainty $\sqrt{e_A^2 + e_B^2}$ with $e$ the SD or SEM of each
mean.

## 15. Resonance line shape, LOQ

For each replicate the depth is $D = |\bar y_{\mathrm{edge}} - y_{\mathrm{res}}|$,
with $\bar y_{\mathrm{edge}}$ the mean of the outer 5 % of the search window at
each end; the FWHM is the distance between the two half-depth crossings
(linearly interpolated), and $Q = \lambda_{\mathrm{res}}/\mathrm{FWHM}$.
$\mathrm{LOQ} = 10\,\sigma_{\mathrm{blank}}/|S|$. From the calibration
itself (ICH Q2), $\mathrm{LOD} = 3.3\,s_{y/x}/|S|$ and
$\mathrm{LOQ} = 10\,s_{y/x}/|S|$ with $s_{y/x} = \sqrt{\mathrm{RSS}/(n-2)}$.

---

## Reporting checklist

For reproducibility, a methods section should state:

1. Despiking method, threshold, and repair window.
2. Baseline method, and its order (ModPoly), radius (rolling ball) or λ and p (ALS).
3. Smoothing filter, window length, and polynomial order.
4. Normalisation basis (and the reference band, if used).
5. Number of replicates per group, and whether bands are SD or SEM.
6. Peak detection minimum prominence, and the band library used for assignment.
7. Fit model, whether it was weighted, the parameters with their standard errors, and R² (or reduced χ²).
8. Any shift correction, excluded regions and derivative order/window.

**File ▾ → Methods text** writes most of this from the settings in use.

---

## References

- Naik, R., & Srivastava, S. K. (2026). *RNSpectraX (Spectral Plotter and Analytics Suite)* (Version 3.4) [Computer software]. Zenodo. https://doi.org/10.5281/zenodo.23593680
- Whitaker, D. A. & Hayes, K. (2018). A simple algorithm for despiking Raman spectra. *Chemometrics and Intelligent Laboratory Systems*, 179, 82–84.
- Savitzky, A. & Golay, M. J. E. (1964). Smoothing and differentiation of data by simplified least squares procedures. *Analytical Chemistry*, 36(8), 1627–1639.
- Eilers, P. H. C. & Boelens, H. F. M. (2005). *Baseline correction with asymmetric least squares smoothing*. Leiden University Medical Centre report.
- Welch, B. L. (1947). The generalization of 'Student's' problem when several different population variances are involved. *Biometrika*, 34(1–2), 28–35.
- ICH Q2(R1) (2005). *Validation of analytical procedures: text and methodology*. International Council for Harmonisation.
- Lieber, C. A. & Mahadevan-Jansen, A. (2003). Automated method for subtraction of fluorescence from biological Raman spectra. *Applied Spectroscopy*, 57(11), 1363–1367.
- Movasaghi, Z., Rehman, S. & Rehman, I. U. (2007). Raman spectroscopy of biological tissues. *Applied Spectroscopy Reviews*, 42(5), 493–541.
- Talari, A. C. S., Movasaghi, Z., Rehman, S. & Rehman, I. U. (2015). Raman spectroscopy of biological tissues. *Applied Spectroscopy Reviews*, 50(1), 46–111.
- Marquardt, D. W. (1963). An algorithm for least-squares estimation of nonlinear parameters. *Journal of the Society for Industrial and Applied Mathematics*, 11(2), 431–441.
