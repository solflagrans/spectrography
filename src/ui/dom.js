const $ = (selector) => document.querySelector(selector);

export function getElements() {
  return {
    canvas: $("#spectrumCanvas"),
    tooltip: $("#tooltip"),
    presetSelect: $("#presetSelect"),
    jsonInput: $("#jsonInput"),
    jsonFileInput: $("#jsonFileInput"),
    peakLabelsToggle: $("#peakLabelsToggle"),
    filterPeakLabelsInput: $("#filterPeakLabelsInput"),
    chartFiltersButton: $("#chartFiltersButton"),
    chartFiltersPopover: $("#chartFiltersPopover"),
    filterMatchedOnlyInput: $("#filterMatchedOnlyInput"),
    filterElementInput: $("#filterElementInput"),
    filterMinInput: $("#filterMinInput"),
    filterMaxInput: $("#filterMaxInput"),
    filterIntensityInput: $("#filterIntensityInput"),
    filterConfidenceInput: $("#filterConfidenceInput"),
    resetZoom: $("#resetZoom"),
    settingsShortcut: $("#settingsShortcut"),
    wavelengthInput: $("#wavelengthInput"),
    intensityInput: $("#intensityInput"),
    manualRowNumbers: $("#manualRowNumbers"),
    databaseInput: $("#databaseInput"),
    databaseEditor: $("#databaseEditor"),
    editDatabase: $("#editDatabase"),
    applyDatabase: $("#applyDatabase"),
    addDatabaseRow: $("#addDatabaseRow"),
    datasetMeta: $("#datasetMeta"),
    pointCountStat: $("#pointCountStat"),
    rangeStat: $("#rangeStat"),
    avgStat: $("#avgStat"),
    currentSourceStat: $("#currentSourceStat"),
    currentRangeStat: $("#currentRangeStat"),
    currentPointCountStat: $("#currentPointCountStat"),
    updatedStat: $("#updatedStat"),
    qualityStatus: $("#qualityStatus"),
    analysisSummary: $("#analysisSummary"),
    analysisConclusion: $("#analysisConclusion"),
    elementResults: $("#elementResults"),
    groupedPeaks: $("#groupedPeaks"),
    analysisPeakCount: $("#analysisPeakCount"),
    analysisPeakSort: $("#analysisPeakSort"),
    analysisPeakTable: $("#analysisPeakTable"),
    exportPeakTable: $("#exportPeakTable"),
    peakTable: $("#peakTable"),
    peakSearch: $("#peakSearch"),
    peakMatchFilter: $("#peakMatchFilter"),
    peakMinInput: $("#peakMinInput"),
    peakMaxInput: $("#peakMaxInput"),
    matchedOnlyInput: $("#matchedOnlyInput"),
    sigmaInput: $("#sigmaInput"),
    prominenceInput: $("#prominenceInput"),
    distanceInput: $("#distanceInput"),
    toleranceInput: $("#toleranceInput"),
    smoothingInput: $("#smoothingInput"),
  };
}

export function readAnalysisOptions(elements) {
  return {
    sigma: Number(elements.sigmaInput.value) || 0,
    prominence: Number(elements.prominenceInput.value) || 0,
    distance: Math.max(1, Math.round(Number(elements.distanceInput.value) || 1)),
    tolerance: Math.max(0.01, Number(elements.toleranceInput.value) || 0.35),
    smoothing: Math.max(1, Math.round(Number(elements.smoothingInput.value) || 1)),
  };
}

export function readPeakFilters(elements) {
  return {
    query: elements.peakSearch.value,
    matchType: elements.peakMatchFilter.value,
    min: elements.peakMinInput.value,
    max: elements.peakMaxInput.value,
    matchedOnly: elements.matchedOnlyInput.checked,
  };
}
