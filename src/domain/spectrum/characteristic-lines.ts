import type { SpectralLine } from "@/domain/spectral-library/types";

import { groupSpectralLines } from "./spectral-groups";
import type { CharacteristicLineSummary, CharacteristicSpectralGroupSummary } from "./types";

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

export interface CharacteristicSpectralGroupCollection {
  readonly elementSymbol: string;
  readonly elementName: string;
  readonly atomicNumber: number;
  readonly ionizationStage: number;
  readonly ionizationLabel: string;
  readonly groups: readonly CharacteristicSpectralGroupSummary[];
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

/**
 * Selects characteristic evidence after resolution grouping. A multiplet uses
 * the strongest member for ordering, so neighboring components do not consume
 * several positions in the characteristic set.
 */
export function selectCharacteristicSpectralGroups(
  library: readonly SpectralLine[],
  coveredRanges: readonly CoveredWavelengthRange[],
  resolutionNm: number,
): readonly CharacteristicSpectralGroupCollection[] {
  const grouped = groupSpectralLines(library, resolutionNm).map((group) => ({
    group,
    eligibleLines: group.lines.filter((line) => (
      Boolean(line.observedWavelength)
        && line.relativeIntensity?.numericValue !== undefined
        && isCovered(line.observedWavelength!.valueNm, coveredRanges)
        && !hasExcludedNotation(line.relativeIntensity.notations)
    )),
  })).filter((item) => item.eligibleLines.length > 0);
  const collections = new Map<string, typeof grouped>();
  for (const item of grouped) {
    const { group } = item;
    const key = `${group.atomicNumber}:${group.ionizationStage}`;
    collections.set(key, [...(collections.get(key) ?? []), item]);
  }

  return [...collections.values()].map((groups) => {
    const ordered = [...groups].sort((left, right) => (
      eligibleGroupIntensity(right.eligibleLines) - eligibleGroupIntensity(left.eligibleLines)
        || left.group.minimumWavelength - right.group.minimumWavelength
        || left.group.id.localeCompare(right.group.id)
    )).slice(0, MAX_CHARACTERISTIC_LINES_PER_ELEMENT_ION);
    const first = ordered[0].group;
    return {
      elementSymbol: first.elementSymbol,
      elementName: first.elementName,
      atomicNumber: first.atomicNumber,
      ionizationStage: first.ionizationStage,
      ionizationLabel: first.ionizationLabel,
      groups: ordered.map(({ group, eligibleLines }, index) => ({
        id: group.id,
        representativeWavelength: [...eligibleLines].sort((left, right) => (
          (right.relativeIntensity!.numericValue! - left.relativeIntensity!.numericValue!)
            || left.observedWavelength!.valueNm - right.observedWavelength!.valueNm
        ))[0].observedWavelength!.valueNm,
        minimumWavelength: group.minimumWavelength,
        maximumWavelength: group.maximumWavelength,
        ionizationStage: group.ionizationStage,
        ionizationLabel: group.ionizationLabel,
        relativeIntensity: eligibleGroupIntensity(eligibleLines),
        rankWithinIonization: index + 1,
        key: index < KEY_CHARACTERISTIC_LINES_PER_ELEMENT_ION,
        lines: eligibleLines.map((line) => ({
          lineId: line.id,
          wavelength: line.observedWavelength!.valueNm,
          ionizationStage: line.ionizationStage,
          ionizationLabel: line.ionizationLabel,
          relativeIntensity: line.relativeIntensity!.numericValue!,
        })),
      })),
    };
  }).sort((left, right) => left.atomicNumber - right.atomicNumber || left.ionizationStage - right.ionizationStage);
}

function eligibleGroupIntensity(lines: readonly SpectralLine[]): number {
  return Math.max(...lines.map((line) => line.relativeIntensity?.numericValue ?? 0));
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
