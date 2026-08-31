import { round } from "./math";
import { IDENTIFICATION_QUALITY_PROFILE } from "./quality-profile";
import type { DetectedPeak, PeakSearchParameters, SpectrumDataset } from "./types";

export interface PeakDetectionInput {
  readonly channelId: string;
  readonly preparedDataset: SpectrumDataset;
  readonly rawDataset: SpectrumDataset;
  readonly noiseDataset: SpectrumDataset;
  readonly sourceIndices: readonly number[];
}

export interface PeakDetectionResult {
  readonly peaks: readonly DetectedPeak[];
  readonly thresholdDataset: SpectrumDataset;
}

export function detectInteractivePeaks(
  input: PeakDetectionInput,
  parameters: PeakSearchParameters,
): PeakDetectionResult {
  validatePeakSearchParameters(parameters);
  const { wavelengths, intensities } = input.preparedDataset;
  const thresholds = input.noiseDataset.intensities.map((noise) => parameters.minimumSnr * noise);
  const candidates: DetectedPeak[] = [];
  const prominenceRadiusNm = Math.max(parameters.minimumDistance, parameters.maximumWidth * 1.5);

  for (let index = 1; index < intensities.length - 1; index += 1) {
    const current = intensities[index];
    if (current <= intensities[index - 1] || current < intensities[index + 1] || current < thresholds[index]) continue;
    const leftStart = lowerBound(wavelengths, wavelengths[index] - prominenceRadiusNm);
    const rightEnd = upperBound(wavelengths, wavelengths[index] + prominenceRadiusNm);
    const leftMinimum = minimumInRange(intensities, leftStart, index + 1);
    const rightMinimum = minimumInRange(intensities, index, rightEnd);
    const prominence = current - Math.max(leftMinimum, rightMinimum);
    if (prominence < parameters.prominence) continue;
    const widthNm = fullWidthAtHalfProminence(wavelengths, intensities, index, prominence);
    if (widthNm < parameters.minimumWidth || widthNm > parameters.maximumWidth) continue;
    const noise = input.noiseDataset.intensities[index];
    const snr = noise > 0 ? current / noise : current > 0 ? Number.POSITIVE_INFINITY : 0;
    if (snr < parameters.minimumSnr) continue;
    const sourceIndex = input.sourceIndices[index];
    const localGridStepNm = localGridStep(wavelengths, index);
    const refinement = refinePeakPosition(
      wavelengths,
      intensities,
      index,
      widthNm,
      snr,
      prominence,
      parameters,
      localGridStepNm,
    );
    candidates.push({
      id: `peak-${input.channelId}-point-${sourceIndex + 1}`,
      channelId: input.channelId,
      index,
      sourceIndex,
      sampledWavelength: wavelengths[index],
      refinedWavelength: refinement.wavelength,
      wavelength: refinement.wavelength,
      refinementOffsetNm: round(refinement.wavelength - wavelengths[index], 8),
      localGridStepNm: round(localGridStepNm, 8),
      positionUncertaintyNm: round(refinement.uncertaintyNm, 8),
      positionMethod: refinement.applied ? "quadratic-local-profile" : "sample-maximum",
      positionRefined: refinement.applied,
      rawIntensity: input.rawDataset.intensities[sourceIndex],
      intensity: round(current, 8),
      prominence: round(prominence, 8),
      snr: Number.isFinite(snr) ? round(snr, 4) : snr,
      widthNm: round(widthNm, 6),
    });
  }

  candidates.sort((left, right) => right.snr - left.snr || right.prominence - left.prominence || left.sourceIndex - right.sourceIndex);
  const selected: DetectedPeak[] = [];
  for (const candidate of candidates) {
    if (selected.every((peak) => Math.abs(peak.wavelength - candidate.wavelength) >= parameters.minimumDistance)) selected.push(candidate);
  }
  selected.sort((left, right) => left.wavelength - right.wavelength || left.sourceIndex - right.sourceIndex);

  return {
    peaks: selected,
    thresholdDataset: { wavelengths, intensities: thresholds.map((value) => round(value, 8)) },
  };
}

interface PeakPositionRefinement {
  readonly wavelength: number;
  readonly uncertaintyNm: number;
  readonly applied: boolean;
}

function refinePeakPosition(
  wavelengths: readonly number[],
  values: readonly number[],
  peakIndex: number,
  widthNm: number,
  snr: number,
  prominence: number,
  parameters: PeakSearchParameters,
  gridStepNm: number,
): PeakPositionRefinement {
  const profile = IDENTIFICATION_QUALITY_PROFILE.peakRefinement;
  const gridFloor = gridStepNm / Math.sqrt(12);
  const snrPosition = Number.isFinite(snr) && snr > 0
    ? widthNm / (2.355 * snr)
    : 0;
  const fallbackUncertainty = Math.max(gridFloor, snrPosition, gridStepNm / 2);
  if (
    snr < parameters.minimumSnr * profile.minimumSnrFactor
    || prominence < parameters.prominence * profile.minimumProminenceFactor
    || peakIndex < profile.halfWindowPoints
    || peakIndex + profile.halfWindowPoints >= values.length
  ) return { wavelength: wavelengths[peakIndex], uncertaintyNm: fallbackUncertainty, applied: false };

  const center = wavelengths[peakIndex];
  const samples = Array.from({ length: profile.halfWindowPoints * 2 + 1 }, (_, offset) => {
    const index = peakIndex + offset - profile.halfWindowPoints;
    return { x: wavelengths[index] - center, y: values[index] };
  });
  const coefficients = fitQuadratic(samples);
  if (!coefficients || coefficients.a >= 0 || Math.abs(coefficients.a) <= Number.EPSILON) {
    return { wavelength: center, uncertaintyNm: fallbackUncertainty, applied: false };
  }
  const offset = -coefficients.b / (2 * coefficients.a);
  if (!Number.isFinite(offset) || Math.abs(offset) > profile.maximumOffsetInGridSteps * gridStepNm) {
    return { wavelength: center, uncertaintyNm: fallbackUncertainty, applied: false };
  }
  const residualRms = Math.sqrt(samples.reduce((sum, sample) => {
    const fitted = coefficients.a * sample.x * sample.x + coefficients.b * sample.x + coefficients.c;
    return sum + Math.pow(sample.y - fitted, 2);
  }, 0) / samples.length);
  const profileTerm = gridStepNm * Math.min(1, residualRms / Math.max(prominence, Number.EPSILON));
  const uncertaintyNm = Math.max(gridFloor, Math.sqrt(snrPosition * snrPosition + profileTerm * profileTerm));
  return { wavelength: round(center + offset, 8), uncertaintyNm, applied: true };
}

function fitQuadratic(samples: readonly { x: number; y: number }[]): { a: number; b: number; c: number } | null {
  let x1 = 0; let x2 = 0; let x3 = 0; let x4 = 0;
  let y = 0; let xy = 0; let x2y = 0;
  for (const sample of samples) {
    const squared = sample.x * sample.x;
    x1 += sample.x;
    x2 += squared;
    x3 += squared * sample.x;
    x4 += squared * squared;
    y += sample.y;
    xy += sample.x * sample.y;
    x2y += squared * sample.y;
  }
  const matrix = [
    [x4, x3, x2, x2y],
    [x3, x2, x1, xy],
    [x2, x1, samples.length, y],
  ];
  for (let pivot = 0; pivot < 3; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < 3; row += 1) if (Math.abs(matrix[row][pivot]) > Math.abs(matrix[best][pivot])) best = row;
    [matrix[pivot], matrix[best]] = [matrix[best], matrix[pivot]];
    if (Math.abs(matrix[pivot][pivot]) <= Number.EPSILON) return null;
    const divisor = matrix[pivot][pivot];
    for (let column = pivot; column < 4; column += 1) matrix[pivot][column] /= divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === pivot) continue;
      const factor = matrix[row][pivot];
      for (let column = pivot; column < 4; column += 1) matrix[row][column] -= factor * matrix[pivot][column];
    }
  }
  return { a: matrix[0][3], b: matrix[1][3], c: matrix[2][3] };
}

function localGridStep(wavelengths: readonly number[], index: number): number {
  const steps = [
    index > 0 ? wavelengths[index] - wavelengths[index - 1] : 0,
    index + 1 < wavelengths.length ? wavelengths[index + 1] - wavelengths[index] : 0,
  ].filter((value) => Number.isFinite(value) && value > 0).sort((left, right) => left - right);
  return steps.length === 2 ? (steps[0] + steps[1]) / 2 : steps[0] || Number.EPSILON;
}

export function validatePeakSearchParameters(parameters: PeakSearchParameters): void {
  if (!Object.values(parameters).every(Number.isFinite)) throw new Error("Заполните все параметры поиска пиков числовыми значениями.");
  if (parameters.minimumSnr < 0) throw new Error("Минимальный SNR не может быть отрицательным.");
  if (parameters.prominence < 0) throw new Error("Минимальная выраженность не может быть отрицательной.");
  if (parameters.minimumWidth < 0) throw new Error("Минимальная ширина пика не может быть отрицательной.");
  if (parameters.maximumWidth <= 0 || parameters.maximumWidth < parameters.minimumWidth) throw new Error("Максимальная ширина должна быть больше нуля и не меньше минимальной.");
  if (parameters.minimumDistance <= 0) throw new Error("Укажите минимальное расстояние больше 0 нм.");
}

function fullWidthAtHalfProminence(wavelengths: readonly number[], values: readonly number[], peakIndex: number, prominence: number): number {
  const halfHeight = values[peakIndex] - prominence / 2;
  let left = peakIndex;
  while (left > 0 && values[left] > halfHeight) left -= 1;
  let right = peakIndex;
  while (right < values.length - 1 && values[right] > halfHeight) right += 1;
  if (left === 0 && values[left] > halfHeight) return Number.POSITIVE_INFINITY;
  if (right === values.length - 1 && values[right] > halfHeight) return Number.POSITIVE_INFINITY;
  const leftCrossing = interpolateCrossing(wavelengths[left], values[left], wavelengths[left + 1], values[left + 1], halfHeight);
  const rightCrossing = interpolateCrossing(wavelengths[right - 1], values[right - 1], wavelengths[right], values[right], halfHeight);
  return Math.max(0, rightCrossing - leftCrossing);
}

function interpolateCrossing(x1: number, y1: number, x2: number, y2: number, level: number): number {
  if (y2 === y1) return (x1 + x2) / 2;
  return x1 + ((level - y1) / (y2 - y1)) * (x2 - x1);
}

function minimumInRange(values: readonly number[], from: number, to: number): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = from; index < to; index += 1) minimum = Math.min(minimum, values[index]);
  return minimum;
}

function lowerBound(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function upperBound(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}
