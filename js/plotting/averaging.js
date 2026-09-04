/* ═══════════════════════════════════════════════════════════
   RAMAN PROCESSING + GROUP AVERAGING + OFFSETS + ERROR BARS
════════════════════════════════════════════════════════════ */

function processSpec(spec) {

  const xmin = parseFloat(document.getElementById("xmin").value);
  const xmax = parseFloat(document.getElementById("xmax").value);

  // Safegaurd: if input is cleared, default to limits so data isn't destroyed
  if (isNaN(xmin)) xmin = -Infinity;
  if (isNaN(xmax)) xmax = Infinity;


  const mask = spec.x
    .map((v, i) => (v >= xmin && v <= xmax ? i : -1))
    .filter(i => i >= 0);

  const xx = mask.map(i => spec.x[i]);
  const raw = mask.map(i => spec.y[i]);

  // Working copy
  let yy = raw.slice();

  yy = applyDespike(yy);
  const despiked = yy.slice();

  const { corrected, baseline } = applyBaseline(xx, yy);

  let smoothed = applySmoothing(
    corrected,
    document.getElementById("smoothType").value,
    parseInt(document.getElementById("smParam1").value) || 5,
    parseInt(document.getElementById("smParam2").value) || 2,
    parseFloat(document.getElementById("smParam3").value) || 2
  );

  yy = normalizeData(
    smoothed,
    document.getElementById("normType").value
  );

  return {
    xx,
    raw,
    yy,
    baseline,
    despiked,
    corrected,
    smoothed
  };
}

/* ==========================================================
   GROUP AVERAGING
========================================================== */

function averageSpecs(specList) {

    if (!specList.length) return null;

    const processed = specList.map(processSpec);

    const sharedX = processed[0].xx.slice();

    const n = processed.length;

    const mean = [];
    const sd = [];
    const sem = [];

    for (let k = 0; k < sharedX.length; k++) {

        const tx = sharedX[k];

        const vals = processed.map(p =>
            interpolate(p.xx, p.yy, tx)
        );

        const m =
            vals.reduce((a, b) => a + b, 0) / n;

        let variance = 0;

        vals.forEach(v => {

            variance += (v - m) * (v - m);

        });

        const s =
            n > 1
                ? Math.sqrt(variance / (n - 1))
                : 0;

        mean.push(m);
        sd.push(s);
        sem.push(
            n > 1
                ? s / Math.sqrt(n)
                : 0
        );

    }

    return {
        x: sharedX,
        mean,
        sd,
        sem,
        n
    };

}


/* ==========================================================
   ERROR BARS
========================================================== */

function buildErrorBarObj(axis, errArr) {

    const mode = document.getElementById(
        axis === "y"
            ? "errBarY"
            : "errBarX"
    ).value;

    if (mode === "none" || !errArr)
        return undefined;

    return {

        type: "data",

        array: errArr,

        visible: true,

        thickness: 1.2,

        width: 2,

        color: "rgba(80,80,80,0.55)"

    };

}


/* ==========================================================
   SHADED ERROR BAND
========================================================== */

function buildErrorBandTrace(
    x,
    y,
    err,
    color,
    opacity = 0.20,
    name = ""
) {

    if (!err) return null;

    const upper =
        y.map((v, i) => v + err[i]);

    const lower =
        y.map((v, i) => v - err[i]);

    return {

        type: "scatter",

        mode: "lines",

        x: [
            ...x,
            ...x.slice().reverse()
        ],

        y: [
            ...upper,
            ...lower.slice().reverse()
        ],

        fill: "toself",

        fillcolor: hexToRgba(
            color,
            opacity
        ),

        line: {
            width: 0,
            color: "rgba(0,0,0,0)"
        },

        hoverinfo: "skip",

        showlegend: false,

        name: name + " Error Band"

    };

}