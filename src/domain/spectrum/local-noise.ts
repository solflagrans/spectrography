const MAD_TO_STANDARD_DEVIATION = 1.4826;

/** Robust local noise curve on an uneven wavelength grid. */
export function estimateLocalNoise(
  wavelengths: readonly number[],
  residual: readonly number[],
  windowNm: number,
  clippingSnr: number,
): readonly number[] {
  if (wavelengths.length !== residual.length) throw new Error("Длины массивов остаточного сигнала не совпадают.");
  if (!Number.isFinite(windowNm) || windowNm <= 0) throw new Error("Окно оценки шума должно быть больше нуля.");
  if (!Number.isFinite(clippingSnr) || clippingSnr <= 0) throw new Error("Порог исключения пиков из шума должен быть больше нуля.");
  if (residual.length === 0) return [];
  if (residual.length === 1) return [0];

  // First differences suppress a slowly varying baseline and broad peak shape.
  // Division by sqrt(2) converts the robust scale of independent differences
  // back to the scale of individual samples.
  const differenceWavelengths = residual.slice(1).map((_, index) => (wavelengths[index] + wavelengths[index + 1]) / 2);
  const differences = residual.slice(1).map((value, index) => value - residual[index]);

  let left = 0;
  let right = 0;
  return wavelengths.map((wavelength) => {
    while (left < differenceWavelengths.length && differenceWavelengths[left] < wavelength - windowNm) left += 1;
    while (right < differenceWavelengths.length && differenceWavelengths[right] <= wavelength + windowNm) right += 1;
    const local = differences.slice(left, right);
    return clippedMad(local, clippingSnr) / Math.SQRT2;
  });
}

function clippedMad(values: readonly number[], clippingSnr: number): number {
  if (values.length < 2) return 0;
  let retained = [...values];
  for (let pass = 0; pass < 2; pass += 1) {
    const center = median(retained);
    const scale = MAD_TO_STANDARD_DEVIATION * median(retained.map((value) => Math.abs(value - center)));
    if (scale === 0) return 0;
    const clipped = retained.filter((value) => Math.abs(value - center) <= clippingSnr * scale);
    if (clipped.length < 2 || clipped.length === retained.length) return scale;
    retained = clipped;
  }
  const center = median(retained);
  return MAD_TO_STANDARD_DEVIATION * median(retained.map((value) => Math.abs(value - center)));
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}
