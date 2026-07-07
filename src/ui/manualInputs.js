export function syncInputs(elements, state) {
  elements.wavelengthInput.value = state.wavelengths.join("\n");
  elements.intensityInput.value = state.intensities.join("\n");
  updateManualRowNumbers(elements);
  elements.jsonInput.value = JSON.stringify(
    { wavelengths: state.wavelengths, intensities: state.intensities },
    null,
    2,
  );
}

export function updateManualRowNumbers(elements) {
  const wavelengthRows = countTextRows(elements.wavelengthInput.value);
  const intensityRows = countTextRows(elements.intensityInput.value);
  const rowCount = Math.max(wavelengthRows, intensityRows, 1);
  elements.manualRowNumbers.textContent = Array.from({ length: rowCount }, (_, index) => index + 1).join("\n");
  syncManualScroll(elements, elements.wavelengthInput);
}

export function syncManualScroll(elements, source) {
  const scrollTop = source.scrollTop;
  if (elements.wavelengthInput !== source) elements.wavelengthInput.scrollTop = scrollTop;
  if (elements.intensityInput !== source) elements.intensityInput.scrollTop = scrollTop;
  elements.manualRowNumbers.scrollTop = scrollTop;
}

function countTextRows(text) {
  if (!text) return 1;
  return text.split("\n").length;
}
