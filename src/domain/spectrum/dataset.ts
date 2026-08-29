import type { SpectrumDataset } from "./types";

export const MAX_POINTS = 10_000;
export const MIN_POINTS = 3;

export function parseFiniteNumber(value: unknown, location: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${location}: значение "${String(value)}" не является числом.`);
  }
  return number;
}

export function validateDataset(dataset: SpectrumDataset): void {
  const { wavelengths, intensities } = dataset;

  if (!wavelengths.length || !intensities.length) {
    throw new Error("Оба массива должны содержать данные.");
  }
  if (wavelengths.length !== intensities.length) {
    throw new Error("Массивы длин волн и интенсивностей должны быть одинаковой длины.");
  }
  if (wavelengths.length > MAX_POINTS) {
    throw new Error(`Максимум ${MAX_POINTS} точек в каждом массиве.`);
  }
  if (wavelengths.length < MIN_POINTS) {
    throw new Error(`Для анализа требуется минимум ${MIN_POINTS} точки.`);
  }

  const invalidWavelength = wavelengths.findIndex((value) => !Number.isFinite(value));
  if (invalidWavelength !== -1) {
    throw new Error(`Длины волн: значение ${invalidWavelength + 1} не является числом.`);
  }

  const invalidIntensity = intensities.findIndex((value) => !Number.isFinite(value));
  if (invalidIntensity !== -1) {
    throw new Error(`Интенсивности: значение ${invalidIntensity + 1} не является числом.`);
  }

  const seenWavelengths = new Set<number>();
  for (let index = 0; index < wavelengths.length; index += 1) {
    const wavelength = wavelengths[index];
    if (seenWavelengths.has(wavelength)) {
      throw new Error(`Длины волн: значение ${wavelength} повторяется в позиции ${index + 1}.`);
    }
    seenWavelengths.add(wavelength);
  }
}

export function sortDatasetByWavelength(dataset: SpectrumDataset): SpectrumDataset {
  validateDataset(dataset);

  const points = dataset.wavelengths
    .map((wavelength, index) => ({ wavelength, intensity: dataset.intensities[index] }))
    .sort((left, right) => left.wavelength - right.wavelength);

  return {
    wavelengths: points.map((point) => point.wavelength),
    intensities: points.map((point) => point.intensity),
  };
}

export function isDatasetSortedByWavelength(dataset: SpectrumDataset): boolean {
  return dataset.wavelengths.every((wavelength, index) => (
    index === 0 || dataset.wavelengths[index - 1] < wavelength
  ));
}
