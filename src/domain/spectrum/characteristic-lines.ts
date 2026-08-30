import type { SpectralLine } from "@/domain/spectral-library/types";

import type { CharacteristicLineSummary } from "./types";

export const MAX_CHARACTERISTIC_LINES_PER_ELEMENT_ION = 10;
export const KEY_CHARACTERISTIC_LINES_PER_ELEMENT_ION = 3;
export const EXCLUDED_CHARACTERISTIC_INTENSITY_NOTATIONS = ["a", "bl", "?", ":", "*", "("] as const;

export interface CoveredWavelengthRange {
  readonly minimum: number;
  readonly maximum: number;
}

export interface CharacteristicLineGroup {
  readonly elementSymbol: string;
  readonly elementName: string;
  readonly atomicNumber: number;
  readonly ionizationStage: number;
  readonly ionizationLabel: string;
  readonly lines: readonly CharacteristicLineSummary[];
}

/**
 * Selects characteristic lines independently for each element and ion stage.
 * Relative intensity is used only for ordering inside that single group.
 */
export function selectCharacteristicLines(
  library: readonly SpectralLine[],
  coveredRanges: readonly CoveredWavelengthRange[],
): readonly CharacteristicLineGroup[] {
  const groups = new Map<string, { line: SpectralLine; items: SpectralLine[] }>();
  for (const line of library) {
    if (!line.observedWavelength || line.relativeIntensity?.numericValue === undefined) continue;
    if (!isCovered(line.observedWavelength.valueNm, coveredRanges)) continue;
    if (hasExcludedNotation(line.relativeIntensity.notations)) continue;
    const key = `${line.element.atomicNumber}:${line.ionizationStage}`;
    const group = groups.get(key) ?? { line, items: [] };
    group.items.push(line);
    groups.set(key, group);
  }

  return [...groups.values()].map(({ line, items }) => ({
    elementSymbol: line.element.symbol,
    elementName: line.element.name,
    atomicNumber: line.element.atomicNumber,
    ionizationStage: line.ionizationStage,
    ionizationLabel: line.ionizationLabel,
    lines: items
      .sort((left, right) => (
        (right.relativeIntensity?.numericValue ?? 0) - (left.relativeIntensity?.numericValue ?? 0)
          || (left.observedWavelength?.valueNm ?? 0) - (right.observedWavelength?.valueNm ?? 0)
          || left.id.localeCompare(right.id)
      ))
      .slice(0, MAX_CHARACTERISTIC_LINES_PER_ELEMENT_ION)
      .map((item) => ({
        lineId: item.id,
        wavelength: item.observedWavelength!.valueNm,
        ionizationStage: item.ionizationStage,
        ionizationLabel: item.ionizationLabel,
        relativeIntensity: item.relativeIntensity!.numericValue!,
      })),
  })).sort((left, right) => left.atomicNumber - right.atomicNumber || left.ionizationStage - right.ionizationStage);
}

function hasExcludedNotation(notations: readonly string[]): boolean {
  return notations.some((notation) => {
    const normalized = notation.toLowerCase();
    return EXCLUDED_CHARACTERISTIC_INTENSITY_NOTATIONS.some((excluded) => (
      excluded === "(" ? normalized.startsWith("(") : normalized === excluded
    ));
  });
}

function isCovered(wavelength: number, ranges: readonly CoveredWavelengthRange[]): boolean {
  return ranges.some((range) => wavelength >= range.minimum && wavelength <= range.maximum);
}
