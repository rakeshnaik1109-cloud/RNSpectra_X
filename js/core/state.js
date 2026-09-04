let spectra = [];
let xyDatasets = [];
let xyFiles = [];
let currentMode = 'ocean';
let extraDatasetCount = 0;

let lastPeaksData = [];
let lastXYPeaks = [];

let xyGlobalIdx = 0;
let xyFileNames = {};

let oceanGlobalIdx = 0;
let oceanFileNames = {};

let analyzedCommonPeaks = [];
let analyzedDistinctPeaks = [];

let activeComparisonSubTab = 'common';

let lastPlottedSeries = [];
let lastXYSeries = [];

let lastFitResults = [];

const GROUP_COLORS = [
"#2563eb",
"#dc2626",
"#16a34a",
"#7c3aed",
"#ea580c",
"#0891b2",
"#db2777",
"#ca8a04",
"#0f766e",
"#9333ea"
];