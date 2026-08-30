import type {
  RelativeIntensity,
  SourceNumericValue,
  SpectralEnergyLevel,
  SpectralLine,
  SpectralLineElement,
  SpectralWavelength,
} from "@/domain/spectral-library/types";

import type { ParsedNistAsdLine } from "./parse-nist-asd-export";

export interface NormalizeNistAsdOptions {
  readonly datasetVersion: string;
  readonly retrievedAt: string;
  readonly elements: readonly SpectralLineElement[];
}

export function normalizeNistAsdLines(
  rows: readonly ParsedNistAsdLine[],
  options: NormalizeNistAsdOptions,
): readonly SpectralLine[] {
  const elements = new Map(options.elements.map((element) => [element.symbol, element] as const));
  const normalized = rows.map((row) => normalizeLine(row, options, elements));
  const grouped = new Map<string, SpectralLine[]>();

  for (const line of normalized) {
    const baseId = line.id;
    grouped.set(baseId, [...(grouped.get(baseId) ?? []), line]);
  }

  const lines = [...grouped.entries()].flatMap(([baseId, group]) => {
    if (group.length === 1) return group;
    return group.map((line, index) => ({ ...line, id: `${baseId}-${String(index + 1).padStart(2, "0")}` }));
  });

  lines.sort(compareLines);
  assertUniqueIds(lines);
  return lines;
}

export function parseRelativeIntensity(rawValue: string): RelativeIntensity | undefined {
  const raw = rawValue.trim();
  if (!raw) return undefined;
  const numberMatch = raw.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
  const numericValue = numberMatch ? Number(numberMatch[0]) : undefined;
  const remainder = numberMatch
    ? `${raw.slice(0, numberMatch.index)}${raw.slice((numberMatch.index ?? 0) + numberMatch[0].length)}`
    : raw;
  const notations = remainder
    .match(/\([^)]*\)|bl|[A-Za-z]+|[^\s,]/g)
    ?.filter(Boolean) ?? [];

  return {
    rawValue: raw,
    ...(numericValue !== undefined && Number.isFinite(numericValue) ? { numericValue } : {}),
    notations,
  };
}

function normalizeLine(
  row: ParsedNistAsdLine,
  options: NormalizeNistAsdOptions,
  elements: ReadonlyMap<string, SpectralLineElement>,
): SpectralLine {
  const element = elements.get(row.elementSymbol);
  if (!element) throw new Error(`Строка ${row.sourceRow}: элемент ${row.elementSymbol || "не указан"} отсутствует в параметрах выборки.`);
  const ionizationStage = parseRequiredPositiveInteger(row.ionizationStage, "степень ионизации", row.sourceRow);
  const observedWavelength = parseWavelength(row.observedWavelength, row.observedUncertainty, row.observedMedium, "наблюдаемая длина волны", row.sourceRow);
  const ritzWavelength = parseWavelength(row.ritzWavelength, row.ritzUncertainty, row.ritzMedium, "Ritz-длина волны", row.sourceRow);
  const preferred = observedWavelength ?? ritzWavelength;
  if (!preferred) throw new Error(`Строка ${row.sourceRow}: отсутствуют наблюдаемая и Ritz-длина волны.`);

  const transition = buildTransition(row);
  const bibliography = buildBibliography(row);
  const sourceValues = Object.fromEntries(
    Object.entries(row).filter(([key]) => key !== "sourceRow"),
  );
  const canonical = [element.atomicNumber, element.symbol, ionizationStage, JSON.stringify(sourceValues)].join("\u001f");
  const relativeIntensity = parseRelativeIntensity(row.relativeIntensity);

  return {
    id: `nist-asd-${options.datasetVersion}-${element.symbol.toLowerCase()}-${ionizationStage}-${fnv1a64(canonical)}`,
    element,
    ionizationStage,
    ionizationLabel: toRomanNumeral(ionizationStage),
    ...(observedWavelength ? { observedWavelength } : {}),
    ...(ritzWavelength ? { ritzWavelength } : {}),
    preferredWavelength: {
      valueNm: preferred.valueNm,
      medium: preferred.medium,
      origin: observedWavelength ? "observed" : "ritz",
      ...(preferred.uncertaintyNm !== undefined ? { uncertaintyNm: preferred.uncertaintyNm } : {}),
    },
    ...(relativeIntensity ? { relativeIntensity } : {}),
    ...(transition ? { transition } : {}),
    ...(bibliography ? { bibliography } : {}),
    source: { name: "NIST ASD", datasetVersion: options.datasetVersion, retrievedAt: options.retrievedAt },
  };
}

function parseWavelength(
  rawValue: string,
  rawUncertainty: string,
  medium: SpectralWavelength["medium"],
  label: string,
  sourceRow: number,
): SpectralWavelength | undefined {
  if (!rawValue) return undefined;
  const match = rawValue.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(.*)$/);
  if (!match) throw new Error(`Строка ${sourceRow}: ${label} имеет некорректное значение «${rawValue}».`);
  const valueNm = Number(match[1]);
  if (!Number.isFinite(valueNm) || valueNm <= 0) throw new Error(`Строка ${sourceRow}: ${label} должна быть положительным конечным числом.`);
  const uncertaintyNm = rawUncertainty ? Number(rawUncertainty) : undefined;
  if (uncertaintyNm !== undefined && (!Number.isFinite(uncertaintyNm) || uncertaintyNm < 0)) {
    throw new Error(`Строка ${sourceRow}: неопределённость ${label.toLowerCase()} некорректна.`);
  }
  return {
    valueNm,
    medium,
    rawValue,
    ...(uncertaintyNm !== undefined ? { uncertaintyNm } : {}),
    ...(match[2] ? { notation: match[2] } : {}),
  };
}

function buildTransition(row: ParsedNistAsdLine): SpectralLine["transition"] | undefined {
  const lowerLevel = buildLevel(row.lowerEnergy, row.lowerConfiguration, row.lowerTerm, row.lowerJ, row.lowerStatisticalWeight, row.sourceRow);
  const upperLevel = buildLevel(row.upperEnergy, row.upperConfiguration, row.upperTerm, row.upperJ, row.upperStatisticalWeight, row.sourceRow);
  const probability = parseOptionalFinite(row.transitionProbability, "вероятность перехода", row.sourceRow);
  if (!row.transitionType && probability === undefined && !row.transitionProbabilityAccuracy && !lowerLevel && !upperLevel) return undefined;
  return {
    ...(row.transitionType ? { type: row.transitionType } : {}),
    ...(probability !== undefined ? { transitionProbabilityPerSecond: probability } : {}),
    ...(row.transitionProbabilityAccuracy ? { transitionProbabilityAccuracy: row.transitionProbabilityAccuracy } : {}),
    ...(lowerLevel ? { lowerLevel } : {}),
    ...(upperLevel ? { upperLevel } : {}),
  };
}

function buildLevel(
  energy: string,
  configuration: string,
  term: string,
  totalAngularMomentum: string,
  statisticalWeight: string,
  sourceRow: number,
): SpectralEnergyLevel | undefined {
  const energyValue = parseSourceNumericValue(energy);
  const weight = parseOptionalFinite(statisticalWeight, "статистический вес", sourceRow);
  if (!energyValue && !configuration && !term && !totalAngularMomentum && weight === undefined) return undefined;
  return {
    ...(energyValue ? { energyEv: energyValue } : {}),
    ...(configuration ? { configuration } : {}),
    ...(term ? { term } : {}),
    ...(totalAngularMomentum ? { totalAngularMomentum } : {}),
    ...(weight !== undefined ? { statisticalWeight: weight } : {}),
  };
}

function parseSourceNumericValue(rawValue: string): SourceNumericValue | undefined {
  if (!rawValue) return undefined;
  const match = rawValue.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
  const numericValue = match ? Number(match[0]) : undefined;
  return {
    rawValue,
    ...(numericValue !== undefined && Number.isFinite(numericValue) ? { numericValue } : {}),
  };
}

function buildBibliography(row: ParsedNistAsdLine): SpectralLine["bibliography"] | undefined {
  const transitionProbabilityReferences = splitReferences(row.transitionProbabilityReference);
  const lineReferences = splitReferences(row.lineReference);
  if (!transitionProbabilityReferences.length && !lineReferences.length) return undefined;
  return {
    ...(transitionProbabilityReferences.length ? { transitionProbabilityReferences } : {}),
    ...(lineReferences.length ? { lineReferences } : {}),
  };
}

function splitReferences(value: string): readonly string[] {
  return value.split(/[;,]/).map((reference) => reference.trim()).filter(Boolean);
}

function parseRequiredPositiveInteger(value: string, label: string, sourceRow: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`Строка ${sourceRow}: ${label} должна быть положительным целым числом.`);
  return parsed;
}

function parseOptionalFinite(value: string, label: string, sourceRow: number): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Строка ${sourceRow}: ${label} имеет некорректное значение «${value}».`);
  return parsed;
}

function compareLines(left: SpectralLine, right: SpectralLine): number {
  return left.preferredWavelength.valueNm - right.preferredWavelength.valueNm
    || left.element.atomicNumber - right.element.atomicNumber
    || left.ionizationStage - right.ionizationStage
    || left.id.localeCompare(right.id);
}

function assertUniqueIds(lines: readonly SpectralLine[]): void {
  const ids = new Set<string>();
  for (const line of lines) {
    if (ids.has(line.id)) throw new Error(`Не удалось сформировать уникальный идентификатор линии ${line.id}.`);
    ids.add(line.id);
  }
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function toRomanNumeral(value: number): string {
  const numerals: readonly (readonly [number, string])[] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let remaining = value;
  let result = "";
  for (const [number, numeral] of numerals) {
    while (remaining >= number) {
      result += numeral;
      remaining -= number;
    }
  }
  return result;
}
