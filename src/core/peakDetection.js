import { getStats } from "./math.js";

export function detectPeaks(wavelengths, intensities, options) {
  const stats = getStats(intensities);
  const threshold = stats.mean + options.sigma * stats.std;
  const minProminence = options.prominence * Math.max(stats.std, 1);
  const candidates = [];

  for (let i = 1; i < intensities.length - 1; i += 1) {
    const current = intensities[i];
    const left = intensities[i - 1];
    const right = intensities[i + 1];
    const prominence = current - Math.max(left, right);
    if (current > threshold && current >= left && current > right && prominence >= minProminence) {
      candidates.push({
        index: i,
        wavelength: wavelengths[i],
        intensity: current,
        prominence,
      });
    }
  }

  candidates.sort((a, b) => b.intensity - a.intensity);
  const selected = [];
  candidates.forEach((candidate) => {
    const tooClose = selected.some((peak) => Math.abs(peak.index - candidate.index) < options.distance);
    if (!tooClose) selected.push(candidate);
  });
  selected.sort((a, b) => a.wavelength - b.wavelength);
  return { peaks: selected, threshold, stats };
}
