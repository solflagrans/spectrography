import { round } from "./math";
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
    candidates.push({
      channelId: input.channelId,
      index,
      sourceIndex,
      wavelength: wavelengths[index],
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

export function validatePeakSearchParameters(parameters: PeakSearchParameters): void {
  if (!Object.values(parameters).every(Number.isFinite)) throw new Error("Заполните все параметры поиска пиков числовыми значениями.");
  if (parameters.minimumSnr < 0) throw new Error("Минимальный SNR не может быть отрицательным.");
  if (parameters.prominence < 0) throw new Error("Минимальная выраженность не может быть отрицательной.");
  if (parameters.minimumWidth < 0) throw new Error("Минимальная ширина пика не может быть отрицательной.");
  if (parameters.maximumWidth <= 0 || parameters.maximumWidth < parameters.minimumWidth) throw new Error("Максимальная ширина должна быть больше нуля и не меньше минимальной.");
  if (parameters.minimumDistance <= 0) throw new Error("Укажите минимальное расстояние больше 0 нм.");
  if (parameters.tolerance <= 0 || parameters.tolerance > 5) throw new Error("Укажите допуск сопоставления больше 0 и не более 5 нм.");
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
