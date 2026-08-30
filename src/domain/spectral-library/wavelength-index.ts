import type { SpectralLine } from "./types";

export interface SpectralLibraryWavelengthIndex {
  readonly lines: readonly SpectralLine[];
  readonly byElement: ReadonlyMap<string, readonly SpectralLine[]>;
}

/** Builds an immutable, deterministic wavelength index once per library. */
export function createSpectralLibraryWavelengthIndex(
  lines: readonly SpectralLine[],
): SpectralLibraryWavelengthIndex {
  const sorted = [...lines].sort((left, right) => (
    left.preferredWavelength.valueNm - right.preferredWavelength.valueNm
      || left.id.localeCompare(right.id)
  ));
  const grouped = new Map<string, SpectralLine[]>();
  for (const line of sorted) {
    const current = grouped.get(line.element.symbol) ?? [];
    current.push(line);
    grouped.set(line.element.symbol, current);
  }
  return { lines: sorted, byElement: grouped };
}

export function findSpectralLinesInRange(
  index: SpectralLibraryWavelengthIndex,
  minimumNm: number,
  maximumNm: number,
): readonly SpectralLine[] {
  const start = lowerBound(index.lines, minimumNm);
  const end = upperBound(index.lines, maximumNm);
  return index.lines.slice(start, end);
}

function lowerBound(lines: readonly SpectralLine[], wavelength: number): number {
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle].preferredWavelength.valueNm < wavelength) low = middle + 1;
    else high = middle;
  }
  return low;
}

function upperBound(lines: readonly SpectralLine[], wavelength: number): number {
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle].preferredWavelength.valueNm <= wavelength) low = middle + 1;
    else high = middle;
  }
  return low;
}
