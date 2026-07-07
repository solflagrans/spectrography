export function createReport(state) {
  return {
    createdAt: new Date().toISOString(),
    points: state.wavelengths.length,
    peaks: state.peaks,
    elements: state.matches,
  };
}

export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
