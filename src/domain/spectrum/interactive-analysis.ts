import type { SpectralElement } from "@/domain/spectral-library/types";

import { sortDatasetByWavelength } from "./dataset";
import { getSpectrumStats, round } from "./math";
import { matchPeaks } from "./matching";
import type {
  AnalyzedPeak,
  DetectedPeak,
  ElementHypothesis,
  ElementInterpretation,
  ElementInterpretationStatus,
  InteractiveAnalysisParameters,
  InteractiveSpectrumAnalysis,
  PeakSearchParameters,
  SpectrumDataset,
  SpectrumProcessingParameters,
} from "./types";

export const DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS: InteractiveAnalysisParameters = {
  processing: {
    smoothingWindow: 15,
    normalization: "maximum",
  },
  peakSearch: {
    threshold: 0.15,
    prominence: 0.05,
    minimumDistance: 1.2,
    tolerance: 0.3,
  },
};

export function runInteractiveSpectrumAnalysis(
  dataset: SpectrumDataset,
  library: readonly SpectralElement[],
  parameters: InteractiveAnalysisParameters = DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
): InteractiveSpectrumAnalysis {
  validateInteractiveAnalysisParameters(parameters);
  const prepared = prepareSpectrum(dataset, parameters.processing);
  const detection = detectInteractivePeaks(prepared.dataset, parameters.peakSearch);
  const matched = matchPeaks(detection.peaks, library, parameters.peakSearch.tolerance);
  const sourceIndexByWavelength = new Map(
    dataset.wavelengths.map((wavelength, index) => [wavelength, index] as const),
  );
  const peaks: readonly AnalyzedPeak[] = matched.peaks.map((peak) => {
    const sourceIndex = sourceIndexByWavelength.get(peak.wavelength);
    if (sourceIndex === undefined) {
      throw new Error("Не удалось связать найденный пик с исходной точкой спектра.");
    }
    return { ...peak, sourceIndex, id: `peak-point-${sourceIndex + 1}` };
  });
  const hypotheses = matched.hypotheses.map((hypothesis) => interpretHypothesis(hypothesis, peaks));
  const unmatchedPeaks = peaks.filter((peak) => !peak.match);

  return {
    preparedDataset: prepared.dataset,
    preparedStats: detection.stats,
    baseline: prepared.baseline,
    threshold: detection.threshold,
    peaks,
    hypotheses,
    unmatchedPeaks,
    conclusion: buildConclusion(hypotheses, unmatchedPeaks.length, peaks.length),
  };
}

export function prepareSpectrum(
  dataset: SpectrumDataset,
  parameters: SpectrumProcessingParameters,
): { readonly dataset: SpectrumDataset; readonly baseline: number } {
  validateProcessingParameters(parameters);
  const normalizedDataset = sortDatasetByWavelength(dataset);
  const smoothed = savitzkyGolaySmooth(
    normalizedDataset.intensities,
    parameters.smoothingWindow,
  );
  const baseline = Math.min(...smoothed);
  const corrected = smoothed.map((value) => Math.max(0, value - baseline));
  const maximum = Math.max(...corrected);
  const intensities = parameters.normalization === "maximum" && maximum > 0
    ? corrected.map((value) => round(value / maximum, 6))
    : corrected.map((value) => round(value, 6));

  return {
    dataset: { wavelengths: normalizedDataset.wavelengths, intensities },
    baseline: round(baseline, 6),
  };
}

/** Quadratic Savitzky-Golay smoothing for an odd, symmetric sample window. */
export function savitzkyGolaySmooth(
  values: readonly number[],
  windowSize: number,
): readonly number[] {
  validateSmoothingWindow(windowSize);
  if (windowSize === 1 || values.length < 3) return [...values];

  const radius = Math.floor(windowSize / 2);
  let sumSquared = 0;
  let sumFourth = 0;

  for (let offset = -radius; offset <= radius; offset += 1) {
    const squared = offset * offset;
    sumSquared += squared;
    sumFourth += squared * squared;
  }

  const denominator = windowSize * sumFourth - sumSquared * sumSquared;
  const coefficients = Array.from({ length: windowSize }, (_, coefficientIndex) => {
    const offset = coefficientIndex - radius;
    return (sumFourth - sumSquared * offset * offset) / denominator;
  });

  return values.map((_, index) => {
    let result = 0;
    for (let coefficientIndex = 0; coefficientIndex < coefficients.length; coefficientIndex += 1) {
      const offset = coefficientIndex - radius;
      result += coefficients[coefficientIndex] * values[reflectIndex(index + offset, values.length)];
    }
    return result;
  });
}

export function detectInteractivePeaks(
  dataset: SpectrumDataset,
  parameters: PeakSearchParameters,
): { readonly peaks: readonly DetectedPeak[]; readonly threshold: number; readonly stats: ReturnType<typeof getSpectrumStats> } {
  validatePeakSearchParameters(parameters);
  const normalizedDataset = sortDatasetByWavelength(dataset);
  const { wavelengths, intensities } = normalizedDataset;
  const stats = getSpectrumStats(intensities);
  const range = stats.maximum - stats.minimum;
  const threshold = stats.minimum + parameters.threshold * range;
  const minimumProminence = parameters.prominence * range;
  const wavelengthStep = getMedianWavelengthStep(wavelengths);
  const prominenceRadius = Math.max(2, Math.ceil(parameters.minimumDistance / wavelengthStep));
  const candidates: DetectedPeak[] = [];

  for (let index = 1; index < intensities.length - 1; index += 1) {
    const current = intensities[index];
    if (current < threshold || current < intensities[index - 1] || current <= intensities[index + 1]) {
      continue;
    }

    const leftMinimum = minimumInRange(intensities, Math.max(0, index - prominenceRadius), index);
    const rightMinimum = minimumInRange(
      intensities,
      index + 1,
      Math.min(intensities.length, index + prominenceRadius + 1),
    );
    const prominence = current - Math.max(leftMinimum, rightMinimum);
    if (prominence >= minimumProminence) {
      candidates.push({ index, wavelength: wavelengths[index], intensity: current, prominence });
    }
  }

  candidates.sort((left, right) => right.intensity - left.intensity);
  const selected: DetectedPeak[] = [];
  for (const candidate of candidates) {
    if (selected.every((peak) => Math.abs(peak.wavelength - candidate.wavelength) >= parameters.minimumDistance)) {
      selected.push(candidate);
    }
  }
  selected.sort((left, right) => left.wavelength - right.wavelength);

  return { peaks: selected, threshold, stats };
}

export function validateInteractiveAnalysisParameters(
  parameters: InteractiveAnalysisParameters,
): void {
  validateProcessingParameters(parameters.processing);
  validatePeakSearchParameters(parameters.peakSearch);
}

function validateProcessingParameters(parameters: SpectrumProcessingParameters): void {
  validateSmoothingWindow(parameters.smoothingWindow);
  if (parameters.normalization !== "maximum" && parameters.normalization !== "none") {
    throw new Error("Выбранный способ нормализации недоступен. Выберите один из вариантов в списке.");
  }
}

function validateSmoothingWindow(windowSize: number): void {
  if (!Number.isFinite(windowSize) || !Number.isInteger(windowSize)) {
    throw new Error("Укажите размер окна сглаживания целым числом.");
  }
  if (windowSize < 1 || windowSize > 51 || windowSize % 2 === 0) {
    throw new Error("Выберите нечётный размер окна сглаживания от 1 до 51.");
  }
}

function validatePeakSearchParameters(parameters: PeakSearchParameters): void {
  if (!Object.values(parameters).every(Number.isFinite)) {
    throw new Error("Заполните все параметры поиска пиков числовыми значениями.");
  }
  if (parameters.threshold < 0 || parameters.threshold > 1) {
    throw new Error("Укажите порог обнаружения от 0 до 1.");
  }
  if (parameters.prominence < 0 || parameters.prominence > 1) {
    throw new Error("Укажите минимальную выраженность от 0 до 1.");
  }
  if (parameters.minimumDistance <= 0) {
    throw new Error("Укажите минимальное расстояние больше 0 нм.");
  }
  if (parameters.tolerance <= 0 || parameters.tolerance > 5) {
    throw new Error("Укажите допуск сопоставления больше 0 и не более 5 нм.");
  }
}

function interpretHypothesis(
  hypothesis: ElementHypothesis,
  peaks: readonly AnalyzedPeak[],
): ElementInterpretation {
  const status = getHypothesisStatus(hypothesis.peaks.length);
  const evidence = hypothesis.peaks.flatMap((hypothesisPeak) => {
    if (!hypothesisPeak.match) return [];
    const peak = peaks.find((candidate) => candidate.index === hypothesisPeak.index);
    if (!peak) return [];
    return [{
      peakId: peak.id,
      peakWavelength: round(peak.wavelength, 2),
      observedWavelength: round(peak.wavelength, 2),
      referenceWavelength: round(hypothesisPeak.match.line, 2),
      delta: round(hypothesisPeak.match.delta, 3),
      elementSymbol: hypothesis.elementSymbol,
      ion: hypothesisPeak.match.ion,
    }];
  });

  return {
    symbol: hypothesis.elementSymbol,
    name: hypothesis.elementName,
    status,
    heuristicScore: hypothesis.heuristicScore,
    explanation: getHypothesisExplanation(hypothesis.elementSymbol, status, evidence.length),
    evidence,
  };
}

function getHypothesisStatus(lineCount: number): ElementInterpretationStatus {
  if (lineCount >= 3) return "confirmed";
  if (lineCount === 2) return "possible";
  return "review";
}

function getHypothesisExplanation(
  symbol: string,
  status: ElementInterpretationStatus,
  lineCount: number,
): string {
  if (status === "confirmed") return `${lineCount} согласованных линий поддерживают гипотезу ${symbol}.`;
  if (status === "possible") return `${lineCount} линии согласуются с ${symbol}, но данных недостаточно для подтверждения.`;
  return `Найдена одна линия ${symbol}; гипотеза требует независимого подтверждения.`;
}

function buildConclusion(
  hypotheses: readonly ElementInterpretation[],
  unmatchedCount: number,
  totalPeakCount: number,
): string {
  if (totalPeakCount === 0) {
    return "При текущих параметрах пики не обнаружены. Элементный состав остаётся неопределённым.";
  }
  const confirmed = hypotheses.filter((hypothesis) => hypothesis.status === "confirmed");
  const possible = hypotheses.filter((hypothesis) => hypothesis.status !== "confirmed");
  const confirmedNames = formatElements(confirmed);
  const possibleNames = formatElements(possible);
  const confirmedText = confirmedNames
    ? `Набор линий согласуется с присутствием: ${confirmedNames}.`
    : "Подтверждённых элементов не обнаружено.";
  const possibleText = possibleNames
    ? `Дополнительной проверки требуют: ${possibleNames}.`
    : "Дополнительных гипотез нет.";
  const unmatchedText = unmatchedCount
    ? `Без совпадения со справочной библиотекой: ${unmatchedCount}.`
    : "Все обнаруженные пики связаны со справочными линиями.";
  return `${confirmedText} ${possibleText} ${unmatchedText}`;
}

function formatElements(hypotheses: readonly ElementInterpretation[]): string {
  return hypotheses.map((hypothesis) => `${hypothesis.name} (${hypothesis.symbol})`).join(", ");
}

function minimumInRange(values: readonly number[], from: number, to: number): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = from; index < to; index += 1) minimum = Math.min(minimum, values[index]);
  return minimum;
}

function getMedianWavelengthStep(wavelengths: readonly number[]): number {
  const steps = wavelengths.slice(1).map((value, index) => value - wavelengths[index]).sort((a, b) => a - b);
  return steps[Math.floor(steps.length / 2)] || 1;
}

function reflectIndex(index: number, length: number): number {
  if (length <= 1) return 0;
  let reflected = index;
  while (reflected < 0 || reflected >= length) {
    if (reflected < 0) reflected = -reflected;
    if (reflected >= length) reflected = 2 * length - reflected - 2;
  }
  return reflected;
}
