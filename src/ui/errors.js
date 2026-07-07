export function clearErrorStatus(elements) {
  elements.qualityStatus.textContent = "";
  elements.qualityStatus.hidden = true;
}

export function showError(elements, message) {
  elements.qualityStatus.textContent = message;
  elements.qualityStatus.hidden = false;
  elements.analysisSummary.textContent = "";
  elements.analysisConclusion.innerHTML = "";
  elements.elementResults.innerHTML = "";
  elements.groupedPeaks.innerHTML = "";
  elements.peakTable.innerHTML = "";
}
