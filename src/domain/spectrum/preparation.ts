import { sortDatasetByWavelength } from "./dataset";
import { estimateLocalNoise } from "./local-noise";
import { getSpectrumStats, round } from "./math";
import { estimateRobustBaseline } from "./robust-baseline";
import type { SpectrumDataset, SpectrumProcessingParameters } from "./types";

export interface PreparedSpectrumResult {
  readonly dataset: SpectrumDataset;
  readonly baselineDataset: SpectrumDataset;
  readonly noiseDataset: SpectrumDataset;
  readonly residualDataset: SpectrumDataset;
  readonly stats: ReturnType<typeof getSpectrumStats>;
  readonly sourceIndices: readonly number[];
  readonly normalizationDivisor: number;
}

export function prepareSpectrum(
  dataset: SpectrumDataset,
  parameters: SpectrumProcessingParameters,
): PreparedSpectrumResult {
  validateProcessingParameters(parameters);
  const sorted = sortDatasetByWavelength(dataset);
  const sourceIndexByWavelength = new Map(dataset.wavelengths.map((value, index) => [value, index] as const));
  const sourceIndices = sorted.wavelengths.map((value) => {
    const sourceIndex = sourceIndexByWavelength.get(value);
    if (sourceIndex === undefined) throw new Error("Не удалось связать рабочую точку с исходным спектром.");
    return sourceIndex;
  });
  const smoothed = savitzkyGolaySmooth(sorted.intensities, parameters.smoothingWindow);
  const baseline = estimateRobustBaseline(sorted.wavelengths, smoothed, {
    smoothness: parameters.baselineSmoothness,
    asymmetry: parameters.baselineAsymmetry,
    iterations: parameters.baselineIterations,
  });
  const residual = smoothed.map((value, index) => value - baseline[index]);
  const corrected = residual.map((value) => Math.max(0, value));
  const noise = estimateLocalNoise(
    sorted.wavelengths,
    residual,
    parameters.noiseWindowNm,
    parameters.noiseClippingSnr,
  );
  const maximum = Math.max(...corrected, 0);
  const normalizationDivisor = parameters.normalization === "maximum" && maximum > 0 ? maximum : 1;
  const normalize = (values: readonly number[]) => values.map((value) => round(value / normalizationDivisor, 8));
  const preparedIntensities = normalize(corrected);

  return {
    dataset: { wavelengths: sorted.wavelengths, intensities: preparedIntensities },
    baselineDataset: { wavelengths: sorted.wavelengths, intensities: baseline.map((value) => round(value, 8)) },
    noiseDataset: { wavelengths: sorted.wavelengths, intensities: normalize(noise) },
    residualDataset: { wavelengths: sorted.wavelengths, intensities: normalize(residual) },
    stats: getSpectrumStats(preparedIntensities),
    sourceIndices,
    normalizationDivisor,
  };
}

/** Quadratic Savitzky–Golay smoothing for an odd, symmetric sample window. */
export function savitzkyGolaySmooth(values: readonly number[], windowSize: number): readonly number[] {
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
  return values.map((_, index) => coefficients.reduce((result, coefficient, coefficientIndex) => (
    result + coefficient * values[reflectIndex(index + coefficientIndex - radius, values.length)]
  ), 0));
}

export function validateProcessingParameters(parameters: SpectrumProcessingParameters): void {
  validateSmoothingWindow(parameters.smoothingWindow);
  if (parameters.normalization !== "maximum" && parameters.normalization !== "none") {
    throw new Error("Выбранный способ нормализации недоступен. Выберите один из вариантов в списке.");
  }
  if (!Number.isFinite(parameters.baselineSmoothness) || parameters.baselineSmoothness <= 0) throw new Error("Гладкость базовой линии должна быть больше нуля.");
  if (!Number.isFinite(parameters.baselineAsymmetry) || parameters.baselineAsymmetry <= 0 || parameters.baselineAsymmetry >= 0.5) throw new Error("Асимметрия базовой линии должна быть больше 0 и меньше 0,5.");
  if (!Number.isInteger(parameters.baselineIterations) || parameters.baselineIterations < 1 || parameters.baselineIterations > 50) throw new Error("Число итераций базовой линии должно быть целым от 1 до 50.");
  if (!Number.isFinite(parameters.noiseWindowNm) || parameters.noiseWindowNm <= 0) throw new Error("Окно оценки шума должно быть больше нуля.");
  if (!Number.isFinite(parameters.noiseClippingSnr) || parameters.noiseClippingSnr <= 0) throw new Error("Порог исключения пиков из оценки шума должен быть больше нуля.");
}

function validateSmoothingWindow(windowSize: number): void {
  if (!Number.isFinite(windowSize) || !Number.isInteger(windowSize)) throw new Error("Укажите размер окна сглаживания целым числом.");
  if (windowSize < 1 || windowSize > 51 || windowSize % 2 === 0) throw new Error("Выберите нечётный размер окна сглаживания от 1 до 51.");
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
