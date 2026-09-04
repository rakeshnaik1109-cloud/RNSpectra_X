# Methods

What each processing step actually computes, so a result from RNSpectraX can be
described precisely in a manuscript.

Throughout, a spectrum is a pair of vectors $(x_i, y_i)$ for $i = 1 \dots N$,
with $x$ in cm⁻¹ (Raman shift), nm (wavelength) or degrees (2θ), and $y$ in
counts or arbitrary intensity units.

---

## 1. Despiking (cosmic-ray removal)

A cosmic ray striking the CCD produces a narrow, high-amplitude spike that is
uncorrelated with any vibrational mode. Both methods detect spikes on the
**first difference** of the signal, where a genuine Raman band is smooth and a
spike is not.

Let $\nabla y_i = y_i - y_{i-1}$.

### Modified Z-score

Standard z-scores are themselves distorted by the outliers they are meant to
find, so the median and the median absolute deviation are used instead:

$$
Z_i = \frac{0.6745\,\bigl(\nabla y_i - \tilde{\nabla y}\bigr)}{\mathrm{MAD}},
\qquad
\mathrm{MAD} = \operatorname{median}\bigl(\,\lvert \nabla y_i - \tilde{\nabla y}\rvert\,\bigr)
$$

The constant 0.6745 is the 0.75 quantile of the standard normal distribution,
which makes the MAD a consistent estimator of $\sigma$ for normally distributed
noise. A point is flagged when $\lvert Z_i \rvert$ exceeds the threshold.

### Whitaker–Hayes

The same detector, followed by the repair rule from Whitaker & Hayes (2018):
each flagged point is replaced by the mean of the unflagged points inside a
window of $\pm w$ samples. Points that are themselves flagged are excluded from
that mean, so a cluster of spikes cannot repair itself.

**Choosing a threshold.** Start at 6. Lower it if visible spikes survive; raise
it if sharp genuine bands are being clipped. Compare a corrected spectrum to the
raw trace before committing.

---

## 2. Baseline correction

Fluorescence background, substrate scattering and detector offset add a slowly
varying $b(x)$ to the true signal. Each method estimates $b$ and returns
$y_i - b(x_i)$.

### Linear (two-point)

$b$ is the straight line through the signal at the two anchor wavenumbers you
specify. Fast, transparent, and adequate over a narrow window.

### Polynomial

A degree-$p$ polynomial is fitted by least squares:

$$
\min_{c_0 \dots c_p} \sum_{i=1}^{N} \Bigl( y_i - \sum_{k=0}^{p} c_k x_i^{\,k} \Bigr)^2
$$

Low orders (2–4) capture broad fluorescence. High orders start absorbing the
bands you are trying to measure — if the corrected peak heights change sharply
as you increase the order, the order is too high.

### Rubber band

The convex hull of the spectrum from below, evaluated as a piecewise-linear
function. Geometrically it is the curve a rubber band would take if stretched
under the spectrum: it touches the signal only at hull vertices and never rises
above it, so the corrected spectrum is non-negative by construction. No
parameters, which makes it a good neutral default.

### Rolling ball

A ball of radius $r$ (in sample points) is rolled along the underside of the
spectrum; the baseline is the surface traced by its top. Equivalent to a
grey-scale morphological opening — an erosion followed by a dilation with a
ball-shaped structuring element. Set $r$ larger than the widest genuine band and
smaller than the background curvature.

---

## 3. Smoothing

All four filters trade noise variance against band distortion. The signal-to-noise
gain is roughly $\sqrt{m}$ for a window of $m$ points, while a band narrower than
the window is broadened and flattened. **Keep the window well below the FWHM of
your narrowest band.**

| Filter | Computation | Behaviour |
|---|---|---|
| Moving average | Mean of $m$ neighbours | Strongest noise reduction, worst peak distortion |
| Savitzky–Golay | Local least-squares polynomial of order $p$ over $m$ points, evaluated at the centre | Preserves peak height, width and area far better; the standard choice for spectroscopy |
| Gaussian | Convolution with $\exp(-x^2/2\sigma^2)$ | Smooth response, no ringing |
| Median | Median of $m$ neighbours | Non-linear; removes residual impulses without blurring edges |

Savitzky–Golay is a convolution with fixed coefficients, so it costs the same as
a moving average and is almost always the better choice.

---

## 4. Normalisation

Applied after correction, so it acts on the signal rather than the background.
Options rescale each spectrum by its maximum, its area, or a chosen reference
band, which is what makes relative band ratios comparable across samples whose
absolute intensities differ (laser power drift, focus, integration time).

---

## 5. Group statistics

For a group of $n$ spectra sharing a common $x$ axis, at each point:

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

A point is a candidate peak when it exceeds both neighbours. Candidates are then
filtered by prominence — the height of the peak above the highest saddle
separating it from any taller peak — which is the property that distinguishes a
real band from a ripple riding on a shoulder.

Detected positions are matched against a biomolecular assignment table (Amide I
≈ 1650–1680, Amide III ≈ 1230–1300, phenylalanine ring breathing ≈ 1002,
tyrosine doublet ≈ 830/850 cm⁻¹, and others) within a tolerance window.

**Assignments are suggestions, not identifications.** Band positions shift with
environment, protonation state and substrate coupling. Confirm against reference
spectra before reporting.

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

Linear-in-parameters models (linear, polynomial) are solved directly by least
squares. Exponential, power and logarithmic models are linearised by the
appropriate transform, fitted, and back-transformed — note that this weights the
residuals in the transformed space.

Peak models are fitted iteratively:

$$
\text{Gaussian:}\quad y = A \exp\!\left(-\frac{(x-x_0)^2}{2\sigma^2}\right)
\qquad
\text{Lorentzian:}\quad y = \frac{A\,\gamma^2}{(x-x_0)^2 + \gamma^2}
$$

Choose by physics, not by R². A Lorentzian is the natural lineshape for a
homogeneously broadened vibrational transition (lifetime broadening); a Gaussian
arises from inhomogeneous broadening across an ensemble of environments. Real
SERS bands are often between the two, and a Lorentzian will usually fit the tails
better while a Gaussian fits the core.

Reported quality metrics:

$$
R^2 = 1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2},
\qquad
\mathrm{RSS} = \sum_i (y_i - \hat{y}_i)^2
$$

$R^2$ rises whenever a parameter is added, so it cannot be used to choose between
models of different complexity — inspect the residuals for structure instead. A
good fit leaves residuals that look like noise; a poor one leaves a pattern.

---

## Reporting checklist

For reproducibility, a methods section should state:

1. Despiking method and threshold.
2. Baseline method, and its order or radius.
3. Smoothing filter, window length, and polynomial order.
4. Normalisation basis.
5. Number of replicates per group, and whether bands are SD or SEM.
6. Peak detection prominence, and the tolerance used for assignment.
7. Fit model, and the reported R² and RSS.

---

## References

- Whitaker, D. A. & Hayes, K. (2018). A simple algorithm for despiking Raman spectra. *Chemometrics and Intelligent Laboratory Systems*, 179, 82–84.
- Savitzky, A. & Golay, M. J. E. (1964). Smoothing and differentiation of data by simplified least squares procedures. *Analytical Chemistry*, 36(8), 1627–1639.
- Lieber, C. A. & Mahadevan-Jansen, A. (2003). Automated method for subtraction of fluorescence from biological Raman spectra. *Applied Spectroscopy*, 57(11), 1363–1367.
- Movasaghi, Z., Rehman, S. & Rehman, I. U. (2007). Raman spectroscopy of biological tissues. *Applied Spectroscopy Reviews*, 42(5), 493–541.
