import type {
  RelativeIntensity,
  SourceNumericValue,
  SpectralEnergyLevel,
  SpectralLibrary,
  SpectralLibraryManifest,
  SpectralLine,
  SpectralLineBibliography,
  SpectralTransition,
  SpectralWavelength,
} from "./types";

type SerializedWavelength = readonly [number, "air" | "vacuum", number | null, string, string | null];
type SerializedSourceNumber = readonly [string, number | null];
type SerializedEnergyLevel = readonly [
  SerializedSourceNumber | null,
  string | null,
  string | null,
  string | null,
  number | null,
];
type SerializedTransition = readonly [
  string | null,
  number | null,
  string | null,
  SerializedEnergyLevel | null,
  SerializedEnergyLevel | null,
];

export interface SerializedSpectralLine {
  readonly id: string;
  readonly element: readonly [number, string, string];
  readonly ionization: readonly [number, string];
  readonly observed?: SerializedWavelength;
  readonly ritz?: SerializedWavelength;
  readonly preferred: readonly [number, "air" | "vacuum", "observed" | "ritz", number | null];
  readonly intensity?: readonly [string, number | null, readonly string[]];
  readonly transition?: SerializedTransition;
  readonly references?: readonly [readonly string[] | null, readonly string[] | null];
}

export interface SerializedSpectralLibraryArtifact {
  readonly recordSchema: "nist-asd-line-v1";
  readonly manifest: SpectralLibraryManifest;
  readonly records: readonly SerializedSpectralLine[];
}

export function serializeSpectralLines(lines: readonly SpectralLine[]): readonly SerializedSpectralLine[] {
  return lines.map((line) => ({
    id: line.id,
    element: [line.element.atomicNumber, line.element.symbol, line.element.name],
    ionization: [line.ionizationStage, line.ionizationLabel],
    ...(line.observedWavelength ? { observed: serializeWavelength(line.observedWavelength) } : {}),
    ...(line.ritzWavelength ? { ritz: serializeWavelength(line.ritzWavelength) } : {}),
    preferred: [
      line.preferredWavelength.valueNm,
      line.preferredWavelength.medium,
      line.preferredWavelength.origin,
      line.preferredWavelength.uncertaintyNm ?? null,
    ],
    ...(line.relativeIntensity ? { intensity: serializeIntensity(line.relativeIntensity) } : {}),
    ...(line.transition ? { transition: serializeTransition(line.transition) } : {}),
    ...(line.bibliography ? { references: serializeBibliography(line.bibliography) } : {}),
  }));
}

export function hydrateSpectralLibrary(artifact: SerializedSpectralLibraryArtifact): SpectralLibrary {
  if (artifact.recordSchema !== "nist-asd-line-v1") throw new Error("Неподдерживаемая схема записей спектральной библиотеки.");
  const source = {
    name: "NIST ASD" as const,
    datasetVersion: artifact.manifest.nistAsdVersion,
    retrievedAt: artifact.manifest.retrievedAt,
  };
  return {
    manifest: artifact.manifest,
    lines: artifact.records.map((record): SpectralLine => ({
      id: record.id,
      element: { atomicNumber: record.element[0], symbol: record.element[1], name: record.element[2] },
      ionizationStage: record.ionization[0],
      ionizationLabel: record.ionization[1],
      ...(record.observed ? { observedWavelength: hydrateWavelength(record.observed) } : {}),
      ...(record.ritz ? { ritzWavelength: hydrateWavelength(record.ritz) } : {}),
      preferredWavelength: {
        valueNm: record.preferred[0],
        medium: record.preferred[1],
        origin: record.preferred[2],
        ...(record.preferred[3] !== null ? { uncertaintyNm: record.preferred[3] } : {}),
      },
      ...(record.intensity ? { relativeIntensity: hydrateIntensity(record.intensity) } : {}),
      ...(record.transition ? { transition: hydrateTransition(record.transition) } : {}),
      ...(record.references ? { bibliography: hydrateBibliography(record.references) } : {}),
      source,
    })),
  };
}

function serializeWavelength(value: SpectralWavelength): SerializedWavelength {
  return [value.valueNm, value.medium, value.uncertaintyNm ?? null, value.rawValue, value.notation ?? null];
}

function hydrateWavelength(value: SerializedWavelength): SpectralWavelength {
  return {
    valueNm: value[0], medium: value[1], rawValue: value[3],
    ...(value[2] !== null ? { uncertaintyNm: value[2] } : {}),
    ...(value[4] !== null ? { notation: value[4] } : {}),
  };
}

function serializeIntensity(value: RelativeIntensity): readonly [string, number | null, readonly string[]] {
  return [value.rawValue, value.numericValue ?? null, value.notations];
}

function hydrateIntensity(value: readonly [string, number | null, readonly string[]]): RelativeIntensity {
  return { rawValue: value[0], ...(value[1] !== null ? { numericValue: value[1] } : {}), notations: value[2] };
}

function serializeTransition(value: SpectralTransition): SerializedTransition {
  return [
    value.type ?? null,
    value.transitionProbabilityPerSecond ?? null,
    value.transitionProbabilityAccuracy ?? null,
    value.lowerLevel ? serializeLevel(value.lowerLevel) : null,
    value.upperLevel ? serializeLevel(value.upperLevel) : null,
  ];
}

function hydrateTransition(value: SerializedTransition): SpectralTransition {
  return {
    ...(value[0] !== null ? { type: value[0] } : {}),
    ...(value[1] !== null ? { transitionProbabilityPerSecond: value[1] } : {}),
    ...(value[2] !== null ? { transitionProbabilityAccuracy: value[2] } : {}),
    ...(value[3] !== null ? { lowerLevel: hydrateLevel(value[3]) } : {}),
    ...(value[4] !== null ? { upperLevel: hydrateLevel(value[4]) } : {}),
  };
}

function serializeLevel(value: SpectralEnergyLevel): SerializedEnergyLevel {
  return [
    value.energyEv ? serializeSourceNumber(value.energyEv) : null,
    value.configuration ?? null,
    value.term ?? null,
    value.totalAngularMomentum ?? null,
    value.statisticalWeight ?? null,
  ];
}

function hydrateLevel(value: SerializedEnergyLevel): SpectralEnergyLevel {
  return {
    ...(value[0] !== null ? { energyEv: hydrateSourceNumber(value[0]) } : {}),
    ...(value[1] !== null ? { configuration: value[1] } : {}),
    ...(value[2] !== null ? { term: value[2] } : {}),
    ...(value[3] !== null ? { totalAngularMomentum: value[3] } : {}),
    ...(value[4] !== null ? { statisticalWeight: value[4] } : {}),
  };
}

function serializeSourceNumber(value: SourceNumericValue): SerializedSourceNumber {
  return [value.rawValue, value.numericValue ?? null];
}

function hydrateSourceNumber(value: SerializedSourceNumber): SourceNumericValue {
  return { rawValue: value[0], ...(value[1] !== null ? { numericValue: value[1] } : {}) };
}

function serializeBibliography(value: SpectralLineBibliography): readonly [readonly string[] | null, readonly string[] | null] {
  return [value.transitionProbabilityReferences ?? null, value.lineReferences ?? null];
}

function hydrateBibliography(value: readonly [readonly string[] | null, readonly string[] | null]): SpectralLineBibliography {
  return {
    ...(value[0] !== null ? { transitionProbabilityReferences: value[0] } : {}),
    ...(value[1] !== null ? { lineReferences: value[1] } : {}),
  };
}
