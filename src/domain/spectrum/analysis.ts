import type { SpectralElement } from "@/domain/spectral-library/types";

import { normalizeDataset } from "./dataset";
import { getSpectrumStats } from "./math";
import { matchPeaks } from "./matching";
import type {
  AnalysisOptions,
  DetectedPeak,
  PeakDetectionResult,
  SpectrumAnalysisResult,
  SpectrumDataset,
} from "./types";

export const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptions = {
  sigma: 1,
  prominence: 0.06,
  distance: 8,
  tolerance: 0.35,
  smoothing: 1,
};

export function analyzeSpectrum(
  dataset: SpectrumDataset,
  library: readonly SpectralElement[],
  options: AnalysisOptions = DEFAULT_ANALYSIS_OPTIONS,
): SpectrumAnalysisResult {
  validateAnalysisOptions(options);
  const normalizedDataset = normalizeDataset(dataset);
  const analysisIntensities = smoothValues(normalizedDataset.intensities, options.smoothing);
  const detection = detectPeaks(normalizedDataset.wavelengths, analysisIntensities, options);
  const matched = matchPeaks(detection.peaks, library, options.tolerance);

  return {
    detection,
    peaks: matched.peaks,
    hypotheses: matched.hypotheses,
  };
}

export function smoothValues(values: readonly number[], windowSize: number): readonly number[] {
  const size = Math.max(1, Math.round(windowSize));
  if (size <= 1) return [...values];

  const radius = Math.floor(size / 2);
  return values.map((_, index) => {
    const from = Math.max(0, index - radius);
    const to = Math.min(values.length - 1, index + radius);
    let sum = 0;

    for (let cursor = from; cursor <= to; cursor += 1) {
      sum += values[cursor];
    }

    return sum / (to - from + 1);
  });
}

export function detectPeaks(
  wavelengths: readonly number[],
  intensities: readonly number[],
  options: AnalysisOptions,
): PeakDetectionResult {
  const stats = getSpectrumStats(intensities);
  const threshold = stats.mean + options.sigma * stats.standardDeviation;
  const minimumProminence = options.prominence * Math.max(stats.standardDeviation, 1);
  const candidates: DetectedPeak[] = [];

  for (let index = 1; index < intensities.length - 1; index += 1) {
    const current = intensities[index];
    const left = intensities[index - 1];
    const right = intensities[index + 1];
    const prominence = current - Math.max(left, right);

    if (
      current > threshold &&
      current >= left &&
      current > right &&
      prominence >= minimumProminence
    ) {
      candidates.push({ index, wavelength: wavelengths[index], intensity: current, prominence });
    }
  }

  candidates.sort((left, right) => right.intensity - left.intensity);
  const selected: DetectedPeak[] = [];

  for (const candidate of candidates) {
    const tooClose = selected.some(
      (peak) => Math.abs(peak.index - candidate.index) < options.distance,
    );
    if (!tooClose) selected.push(candidate);
  }

  selected.sort((left, right) => left.wavelength - right.wavelength);
  return { peaks: selected, threshold, stats };
}

function validateAnalysisOptions(options: AnalysisOptions): void {
  const finiteValues = Object.values(options).every(Number.isFinite);
  if (!finiteValues) throw new Error("Параметры анализа должны быть конечными числами.");
  if (options.sigma < 0) throw new Error("Порог поиска пиков не может быть отрицательным.");
  if (options.prominence < 0) throw new Error("Минимальная выраженность пика не может быть отрицательной.");
  if (options.distance < 1) throw new Error("Минимальное расстояние между пиками должно быть не меньше 1.");
  if (options.smoothing < 1) throw new Error("Окно сглаживания должно быть не меньше 1.");
  if (options.tolerance <= 0) throw new Error("Допуск совпадения должен быть больше 0.");
}
