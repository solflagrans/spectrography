import { spectralDatabase } from "../data/spectralDatabase.js";

export const state = {
  wavelengths: [],
  intensities: [],
  peaks: [],
  matches: [],
  database: structuredClone(spectralDatabase),
  hoverPeak: null,
  showPeakLabels: true,
  databaseMode: "view",
  threshold: null,
  sort: { key: "wavelength", direction: "asc" },
};

export function setDatasetState(wavelengths, intensities) {
  const paired = wavelengths.map((wavelength, index) => ({
    wavelength,
    intensity: intensities[index],
  }));
  paired.sort((a, b) => a.wavelength - b.wavelength);
  state.wavelengths = paired.map((item) => item.wavelength);
  state.intensities = paired.map((item) => item.intensity);
  state.peaks = [];
  state.matches = [];
  state.threshold = null;
  state.hoverPeak = null;
}

export function setAnalysisState(result) {
  state.peaks = result.peaks;
  state.matches = result.matches;
  state.threshold = result.threshold;
}

export function setSortState(key) {
  if (state.sort.key === key) {
    state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
  } else {
    state.sort = { key, direction: "asc" };
  }
}
