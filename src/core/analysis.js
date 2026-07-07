import { matchPeaks } from "./matching.js";
import { detectPeaks } from "./peakDetection.js";
import { smoothValues } from "./spectrum.js";
import { validateDataset } from "./validation.js";

export function runAnalysis({ wavelengths, intensities, database, options }) {
  validateDataset(wavelengths, intensities);
  const analysisIntensities = smoothValues(intensities, options.smoothing);
  const detected = detectPeaks(wavelengths, analysisIntensities, options);
  const identified = matchPeaks(detected.peaks, database, options.tolerance);

  return {
    detected,
    peaks: identified.matches,
    matches: identified.elementsRanked,
    threshold: detected.threshold,
    stats: detected.stats,
  };
}
