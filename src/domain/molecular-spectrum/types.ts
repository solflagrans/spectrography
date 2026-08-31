import type { ChannelPreparationResult } from "@/domain/spectrum/types";

export type MolecularHypothesisReason =
  | "spectrum-type-not-supported"
  | "insufficient-covered-regions"
  | "single-region"
  | "weak-profile-agreement"
  | "missing-key-region"
  | "random-like-profile";

export interface MolecularTransition {
  readonly sourceLineId: number;
  readonly wavelengthNm: number;
  readonly einsteinAPerSecond: number;
  readonly upperVibrationalEnergyCm: number;
  readonly upperRotationalEnergyCm: number;
  readonly upperJ: number;
  readonly upperV: number;
  readonly lowerV: number;
  readonly branch: string;
}

export interface MolecularCharacteristicRegion {
  readonly id: string;
  readonly label: string;
  readonly minimumWavelengthNm: number;
  readonly maximumWavelengthNm: number;
  readonly key: boolean;
  readonly transitions: readonly MolecularTransition[];
}

export interface MolecularDataSource {
  readonly name: string;
  readonly datasetVersion: string;
  readonly retrievedAt: string;
  readonly repository: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly attribution: string;
  readonly citations: readonly string[];
  readonly filteredSourceSha256: string;
}

export interface MolecularSystemDefinition {
  readonly id: string;
  readonly molecule: "N2";
  readonly formula: "N₂" | "N₂⁺";
  readonly charge: 0 | 1;
  readonly displayName: string;
  readonly systemName: string;
  readonly transition: string;
  readonly wavelengthRange: { readonly minimum: number; readonly maximum: number };
  readonly characteristicRegions: readonly MolecularCharacteristicRegion[];
  readonly source: MolecularDataSource;
  readonly preparation: MolecularReferencePreparation;
}

export interface MolecularReferencePreparation {
  readonly wavelengthMedium: "air";
  readonly maximumRotationalQuantumNumber: number;
  readonly rotationalTemperatureGridKelvin: readonly number[];
  readonly profile: string;
  readonly note: string;
}

export interface MolecularRegionObservation {
  readonly regionId: string;
  readonly channelId: string;
  readonly observedRange: { readonly minimum: number; readonly maximum: number };
  readonly commonShiftNm: number;
  readonly temperatureVariantKelvin: number;
  readonly shapeCorrelation: number;
  readonly fitQuality: number;
  readonly contrastSnr: number;
  readonly relativeContrast: number;
  /** Deterministic ranking heuristic, not a probability or concentration. */
  readonly quality: number;
  readonly supported: boolean;
  readonly overlappingAtomicPeakIds: readonly string[];
}

export interface MolecularRandomAgreement {
  readonly observedCompositeQuality: number;
  readonly strongestRandomCompositeQuality: number;
  readonly testedOffsets: number;
  readonly distinguishableFromRandom: boolean;
}

export interface MolecularHypothesis {
  readonly id: string;
  readonly molecule: "N2";
  readonly formula: "N₂" | "N₂⁺";
  readonly charge: 0 | 1;
  readonly displayName: string;
  readonly systemId: string;
  readonly systemName: string;
  readonly transition: string;
  readonly source: MolecularDataSource;
  readonly referencePreparation: MolecularReferencePreparation;
  readonly observations: readonly MolecularRegionObservation[];
  readonly supportedRegionIds: readonly string[];
  readonly missingExpectedRegionIds: readonly string[];
  readonly commonShiftNm: number;
  readonly quality: number;
  readonly randomAgreement: MolecularRandomAgreement;
  readonly accepted: boolean;
  readonly reasons: readonly MolecularHypothesisReason[];
  readonly explanation: string;
}

export interface MolecularIdentificationResult {
  readonly hypotheses: readonly MolecularHypothesis[];
  readonly rejectedHypotheses: readonly MolecularHypothesis[];
  readonly skippedReason?: MolecularHypothesisReason;
}

export interface MolecularAnalysisInput {
  readonly channels: readonly ChannelPreparationResult[];
  readonly systems: readonly MolecularSystemDefinition[];
}
