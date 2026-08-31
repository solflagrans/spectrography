import type { MolecularCharacteristicRegion } from "./types";

const BOLTZMANN_WAVENUMBER_PER_KELVIN = 0.69503476;

export function renderMolecularReferenceProfile(
  region: MolecularCharacteristicRegion,
  wavelengths: readonly number[],
  resolutionFwhmNm: number,
  temperatureKelvin: number,
): readonly number[] {
  if (!wavelengths.length) return [];
  const sticks = new Array<number>(wavelengths.length).fill(0);
  let totalWeight = 0;
  for (const transition of region.transitions) {
    const population = (2 * transition.upperJ + 1) * Math.exp(
      -transition.upperVibrationalEnergyCm / (BOLTZMANN_WAVENUMBER_PER_KELVIN * temperatureKelvin)
      -transition.upperRotationalEnergyCm / (BOLTZMANN_WAVENUMBER_PER_KELVIN * temperatureKelvin),
    );
    const weight = transition.einsteinAPerSecond * population;
    if (!Number.isFinite(weight) || weight <= 0) continue;
    depositLinear(sticks, wavelengths, transition.wavelengthNm, weight);
    totalWeight += weight;
  }
  if (!totalWeight) return sticks;
  const normalized = sticks.map((value) => value / totalWeight);
  const step = medianStep(wavelengths);
  if (!step || resolutionFwhmNm <= step) return normalizeMaximum(normalized);
  const sigmaPoints = resolutionFwhmNm / 2.354820045 / step;
  const radius = Math.max(1, Math.ceil(sigmaPoints * 4));
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, index) => {
    const distance = index - radius;
    return Math.exp(-0.5 * (distance / sigmaPoints) ** 2);
  });
  const kernelSum = kernel.reduce((sum, value) => sum + value, 0);
  const smoothed = normalized.map((_, index) => kernel.reduce((sum, value, kernelIndex) => {
    const sourceIndex = index + kernelIndex - radius;
    return sourceIndex >= 0 && sourceIndex < normalized.length
      ? sum + normalized[sourceIndex] * value / kernelSum
      : sum;
  }, 0));
  return normalizeMaximum(smoothed);
}

export function shiftProfile(
  wavelengths: readonly number[],
  profile: readonly number[],
  shiftNm: number,
): readonly number[] {
  return wavelengths.map((wavelength) => interpolate(wavelengths, profile, wavelength - shiftNm));
}

function depositLinear(values: number[], wavelengths: readonly number[], wavelength: number, weight: number): void {
  let low = 0;
  let high = wavelengths.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (wavelengths[middle] < wavelength) low = middle + 1;
    else high = middle;
  }
  if (low <= 0) {
    if (Math.abs(wavelengths[0] - wavelength) <= medianStep(wavelengths)) values[0] += weight;
    return;
  }
  if (low >= wavelengths.length) {
    if (Math.abs(wavelengths.at(-1)! - wavelength) <= medianStep(wavelengths)) values[values.length - 1] += weight;
    return;
  }
  const left = low - 1;
  const span = wavelengths[low] - wavelengths[left];
  const rightWeight = span > 0 ? (wavelength - wavelengths[left]) / span : 0;
  values[left] += weight * (1 - rightWeight);
  values[low] += weight * rightWeight;
}

function interpolate(x: readonly number[], y: readonly number[], target: number): number {
  if (target < x[0] || target > x.at(-1)!) return 0;
  let low = 0;
  let high = x.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (x[middle] <= target) low = middle;
    else high = middle;
  }
  const span = x[high] - x[low];
  return span > 0 ? y[low] + (y[high] - y[low]) * (target - x[low]) / span : y[low];
}

function medianStep(values: readonly number[]): number {
  const steps = values.slice(1).map((value, index) => value - values[index]).filter((value) => value > 0).sort((a, b) => a - b);
  if (!steps.length) return 0;
  const middle = Math.floor(steps.length / 2);
  return steps.length % 2 ? steps[middle] : (steps[middle - 1] + steps[middle]) / 2;
}

function normalizeMaximum(values: readonly number[]): readonly number[] {
  const maximum = Math.max(...values, 0);
  return maximum > 0 ? values.map((value) => value / maximum) : [...values];
}
