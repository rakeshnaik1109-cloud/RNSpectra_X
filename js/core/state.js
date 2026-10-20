let spectra = [];
let xyDatasets = [];
let xyFiles = [];
let currentMode = 'ocean';
let extraDatasetCount = 0;

let lastPeaksData = [];

let xyGlobalIdx = 0;
let xyFileNames = {};

let oceanGlobalIdx = 0;
let oceanFileNames = {};

let analyzedCommonPeaks = [];
let analyzedDistinctPeaks = [];
let analyzedComparisonMode = null; // 'ocean' | 'xy' — which plot the comparison bands belong to

let activeComparisonSubTab = 'common';

let lastPlottedSeries = [];
let lastXYSeries = [];

let lastFitResults = [];

// Twelve clearly distinguishable trace colours (the Tableau 10 set, which is
// designed so neighbouring entries never look alike, plus black and grey).
// Beyond twelve curves the colours repeat with a different dash pattern.
const GROUP_COLORS = [
"#1f77b4", // blue
"#d62728", // red
"#2ca02c", // green
"#ff7f0e", // orange
"#9467bd", // purple
"#8c564b", // brown
"#e377c2", // pink
"#17becf", // cyan
"#bcbd22", // olive
"#000000", // black
"#7f7f7f", // grey
"#003f5c"  // dark navy
];
const TRACE_DASHES = ["solid", "dash", "dot", "dashdot"];