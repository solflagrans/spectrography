export const MAX_POINTS = 10000;

export function parseFiniteNumber(value, location) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${location}: значение "${String(value)}" не является числом.`);
  }
  return number;
}

export function validateDataset(wavelengths, intensities) {
  if (!wavelengths.length || !intensities.length) {
    throw new Error("Оба массива должны содержать данные.");
  }
  if (wavelengths.length !== intensities.length) {
    throw new Error("Массивы длин волн и интенсивностей должны быть одинаковой длины.");
  }
  if (wavelengths.length > MAX_POINTS) {
    throw new Error(`Максимум ${MAX_POINTS} точек в каждом массиве.`);
  }
  if ([...wavelengths, ...intensities].some((value) => !Number.isFinite(value))) {
    const invalidWavelength = wavelengths.findIndex((value) => !Number.isFinite(value));
    if (invalidWavelength !== -1) {
      throw new Error(`Длины волн: значение ${invalidWavelength + 1} не является числом.`);
    }
    const invalidIntensity = intensities.findIndex((value) => !Number.isFinite(value));
    throw new Error(`Интенсивности: значение ${invalidIntensity + 1} не является числом.`);
  }
}
