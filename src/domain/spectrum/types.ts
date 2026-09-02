import type { PreferredWavelengthOrigin, SpectralLine, WavelengthMedium } from "@/domain/spectral-library/types";
import type { MolecularHypothesis, MolecularHypothesisReason } from "@/domain/molecular-spectrum/types";

export type SpectrumType = "plasma-emission" | "unspecified";

/** `unspecified` is retained only for reading legacy persisted data. */
export type NewAnalysisSpectrumType = Exclude<SpectrumType, "unspecified">;

export const DEFAULT_SPECTRUM_TYPE = "plasma-emission" as const satisfies NewAnalysisSpectrumType;

export function normalizeSpectrumType(
  spectrumType: SpectrumType | undefined,
): NewAnalysisSpectrumType {
  return spectrumType === undefined || spectrumType === "unspecified"
    ? DEFAULT_SPECTRUM_TYPE
    : spectrumType;
}

export interface SpectrumDataset {
  readonly wavelengths: readonly number[];
  readonly intensities: readonly number[];
}

export type SpectrumNormalizationMethod = "maximum" | "none";

export interface SpectrumProcessingParameters {
  readonly smoothingWindow: number;
  readonly baselineSmoothness: number;
  readonly baselineAsymmetry: number;
  readonly baselineIterations: number;
  readonly noiseWindowNm: number;
  readonly noiseClippingSnr: number;
  readonly normalization: SpectrumNormalizationMethod;
}

export interface PeakSearchParameters {
  readonly minimumSnr: number;
  readonly prominence: number;
  readonly minimumWidth: number;
  readonly maximumWidth: number;
  readonly minimumDistance: number;
}

export interface InteractiveAnalysisParameters {
  readonly processing: SpectrumProcessingParameters;
  readonly peakSearch: PeakSearchParameters;
  readonly wavelengthCalibration: WavelengthCalibrationParameters;
}

export interface WavelengthCalibrationParameters {
  readonly allowAutomaticCorrection: boolean;
  /** Stated one-standard-uncertainty of the instrument calibration, when known. */
  readonly statedUncertaintyNm?: number;
}

export interface SpectrumStats {
  readonly mean: number;
  readonly standardDeviation: number;
  readonly minimum: number;
  readonly maximum: number;
}

export interface SpectrumChannelInput {
  readonly id: string;
  readonly name: string;
  readonly dataset: SpectrumDataset;
  readonly parameters?: InteractiveAnalysisParameters;
}

export interface MultiChannelSpectrumInput {
  readonly channels: readonly SpectrumChannelInput[];
}

export interface DetectedPeak {
  readonly id: string;
  readonly channelId: string;
  readonly index: number;
  readonly sourceIndex: number;
  /** Wavelength of the unchanged source sample selected as the local maximum. */
  readonly sampledWavelength: number;
  /** Sub-sample local-profile estimate before any common scale correction. */
  readonly refinedWavelength: number;
  /** Wavelength used for identification; it may include a validated common correction. */
  readonly wavelength: number;
  readonly refinementOffsetNm: number;
  readonly localGridStepNm: number;
  readonly positionUncertaintyNm: number;
  readonly positionMethod: "quadratic-local-profile" | "sample-maximum";
  readonly positionRefined: boolean;
  readonly rawIntensity: number;
  readonly intensity: number;
  readonly prominence: number;
  readonly snr: number;
  readonly widthNm: number;
}

export interface SpectralLineCandidate {
  readonly lineId: SpectralLine["id"];
  readonly atomicNumber: number;
  readonly elementSymbol: SpectralLine["element"]["symbol"];
  readonly elementName: SpectralLine["element"]["name"];
  readonly ionizationStage: number;
  readonly ionizationLabel: string;
  readonly line: number;
  readonly wavelengthType: PreferredWavelengthOrigin;
  readonly wavelengthMedium: WavelengthMedium;
  readonly delta: number;
  readonly adaptiveToleranceNm: number;
  readonly combinedUncertaintyNm: number;
  readonly normalizedDelta: number;
  readonly toleranceCapped: boolean;
  readonly uncertainty: WavelengthUncertaintyComponents;
}

export interface WavelengthUncertaintyComponents {
  readonly gridSamplingNm: number;
  readonly spectralResolutionNm: number;
  readonly peakWidthNm: number;
  readonly peakPositionNm: number;
  readonly referenceLineNm: number;
  readonly calibrationNm: number;
}

export type SpectralLineMatch = SpectralLineCandidate;

export interface MatchedPeak extends DetectedPeak {
  readonly candidates: readonly SpectralLineCandidate[];
  readonly match: SpectralLineMatch | null;
}

export interface AnalyzedPeak extends MatchedPeak {
  readonly id: string;
}

export interface ChannelPreparationResult {
  readonly id: string;
  readonly name: string;
  readonly rawDataset: SpectrumDataset;
  /** Prepared signal before the optional scale correction; never mutated. */
  readonly uncalibratedPreparedDataset: SpectrumDataset;
  readonly preparedDataset: SpectrumDataset;
  readonly baselineDataset: SpectrumDataset;
  readonly noiseDataset: SpectrumDataset;
  readonly thresholdDataset: SpectrumDataset;
  readonly preparedStats: SpectrumStats;
  readonly parameters: InteractiveAnalysisParameters;
  readonly peaks: readonly AnalyzedPeak[];
  readonly wavelengthRange: { readonly minimum: number; readonly maximum: number };
  /** Conservative FWHM-based resolving width used to merge unresolved reference lines. */
  readonly spectralResolutionNm: number;
  readonly wavelengthCalibration: WavelengthCalibrationResult;
  readonly suitability: ChannelSuitabilityAssessment;
  readonly usable: boolean;
  readonly transformations: readonly string[];
}

export interface EvidenceObservation {
  readonly channelId: string;
  readonly peakId: string;
  readonly peakWavelength: number;
  readonly peakIntensity: number;
  readonly snr: number;
  readonly prominence: number;
  readonly widthNm: number;
  readonly delta: number;
  readonly adaptiveToleranceNm: number;
  readonly combinedUncertaintyNm: number;
  readonly normalizedDelta: number;
  /** Number of distinct elements that can explain the same measured peak. */
  readonly competingElementCount: number;
  /** Element-specific separation from the closest competing explanation, 0…1. */
  readonly specificity: number;
  readonly uncertainty: WavelengthUncertaintyComponents;
}

export type WavelengthCalibrationReason =
  | "disabled"
  | "insufficient-anchors"
  | "insufficient-span"
  | "shift-too-large"
  | "validation-not-improved"
  | "validation-residual-too-large"
  | "applied";

export interface WavelengthCalibrationAnchor {
  readonly peakId: string;
  readonly lineId: string;
  readonly observedWavelengthNm: number;
  readonly referenceWavelengthNm: number;
  readonly deltaNm: number;
  readonly role: "fit" | "validation";
  readonly adaptiveToleranceNm: number;
}

export interface WavelengthCalibrationResult {
  readonly status: "applied" | "not-applied";
  readonly enabled: boolean;
  /** Observed minus reference; subtracted from the prepared working copy. */
  readonly shiftNm: number;
  readonly uncertaintyNm: number;
  readonly uncertaintyMethod: "user-stated" | "validated-residual" | "resolution-and-grid-floor";
  readonly method: "split-sample-robust-common-shift";
  readonly anchors: readonly WavelengthCalibrationAnchor[];
  readonly fitAnchorIds: readonly string[];
  readonly validationAnchorIds: readonly string[];
  readonly reason: WavelengthCalibrationReason;
}

export type SuitabilityStatus = "sufficient" | "limited" | "impossible";
export type SuitabilityIssueSeverity = "warning" | "critical";
export type SuitabilityIssueCode =
  | "insufficient-range"
  | "low-dynamic-range"
  | "baseline-drift"
  | "isolated-outliers"
  | "possible-signal-limit"
  | "insufficient-features"
  | "uncertain-resolution"
  | "uncertain-calibration";

export interface SuitabilityIssue {
  readonly code: SuitabilityIssueCode;
  readonly severity: SuitabilityIssueSeverity;
  readonly explanation: string;
}

export interface MeasurementQualityMetrics {
  readonly pointCount: number;
  readonly wavelengthSpanNm: number;
  readonly gridStepNm: number;
  readonly resolutionElements: number;
  readonly noiseMedian: number;
  readonly usefulDynamicRangeSnr: number;
  readonly baselineDriftRatio: number;
  readonly isolatedOutlierCount: number;
  readonly isolatedOutlierFraction: number;
  readonly repeatedExtremeCount: number;
  readonly longestExtremeRun: number;
  readonly detectedFeatureCount: number;
  readonly strongFeatureCount: number;
  readonly resolutionPeakCount: number;
  readonly resolutionRelativeMad: number;
}

export interface ChannelSuitabilityAssessment {
  readonly status: SuitabilityStatus;
  readonly summary: string;
  readonly issues: readonly SuitabilityIssue[];
  readonly metrics: MeasurementQualityMetrics;
}

export interface MeasurementSuitabilityAssessment {
  readonly status: SuitabilityStatus;
  readonly summary: string;
  readonly channelAssessments: readonly { readonly channelId: string; readonly assessment: ChannelSuitabilityAssessment }[];
}

export type EvidenceStrength = "strong" | "moderate" | "weak";

export interface AnalysisEvidenceLine {
  /** Stable identity of an unresolved spectral group; lineId remains its representative line. */
  readonly groupId: string;
  readonly lineId: string;
  readonly memberLineIds: readonly string[];
  readonly memberWavelengths: readonly number[];
  readonly spectralResolutionNm: number;
  readonly referenceWavelength: number;
  readonly elementSymbol: string;
  readonly elementName: string;
  readonly ionizationStage: number;
  readonly ionizationLabel: string;
  readonly wavelengthType: PreferredWavelengthOrigin;
  readonly wavelengthMedium: WavelengthMedium;
  readonly strength: EvidenceStrength;
  /** Ranking heuristic in the 0…1 range. It is not a probability. */
  readonly quality: number;
  /** Best specificity among independent observations of this group, 0…1. */
  readonly specificity: number;
  readonly channelSupportCount: number;
  readonly characteristicGroupId?: string;
  readonly isCharacteristic: boolean;
  readonly isKeyCharacteristic: boolean;
  readonly observations: readonly EvidenceObservation[];
  readonly peakId: string;
  readonly peakWavelength: number;
  readonly observedWavelength: number;
  readonly delta: number;
}

export interface CharacteristicLineSummary {
  readonly lineId: string;
  readonly wavelength: number;
  readonly ionizationStage: number;
  readonly ionizationLabel: string;
  readonly relativeIntensity: number;
}

export interface CharacteristicSpectralGroupSummary {
  readonly id: string;
  readonly representativeWavelength: number;
  readonly minimumWavelength: number;
  readonly maximumWavelength: number;
  readonly ionizationStage: number;
  readonly ionizationLabel: string;
  readonly relativeIntensity: number;
  readonly rankWithinIonization: number;
  readonly key: boolean;
  readonly lines: readonly CharacteristicLineSummary[];
}

export interface IonizationEvidenceGroup {
  readonly ionizationStage: number;
  readonly ionizationLabel: string;
  readonly availableCharacteristicLines: readonly CharacteristicLineSummary[];
  readonly foundCharacteristicLineIds: readonly string[];
  readonly missingCharacteristicLines: readonly CharacteristicLineSummary[];
  readonly availableCharacteristicGroups: readonly CharacteristicSpectralGroupSummary[];
  readonly foundCharacteristicGroupIds: readonly string[];
  readonly missingCharacteristicGroups: readonly CharacteristicSpectralGroupSummary[];
  readonly evidence: readonly AnalysisEvidenceLine[];
}

export interface ChannelEvidenceSummary {
  readonly channelId: string;
  readonly observationCount: number;
  readonly peakIds: readonly string[];
}

export interface AlternativePeakExplanation {
  readonly peakId: string;
  readonly channelId: string;
  readonly elementSymbols: readonly string[];
}

export type HypothesisRankingReasonCode = "strong-groups" | "characteristic-groups" | "key-groups" | "independent-groups" | "weak-evidence" | "channel-support" | "wavelength-agreement";

export interface HypothesisRankingReason {
  readonly code: HypothesisRankingReasonCode;
  readonly value: number;
  readonly description: string;
}

export interface RandomAgreementEstimate {
  readonly expectedAgreements: number;
  readonly observedAgreements: number;
  readonly coveredWidthNm: number;
  readonly peakCount: number;
  readonly characteristicLineDensityPerNm: number;
  readonly testedElementCount: number;
  readonly adjustedExpectedAgreements: number;
  readonly requiredAgreements: number;
  readonly testedOffsets: number;
  readonly maximumControlAgreements: number;
  readonly control95PercentileAgreements: number;
  readonly empiricalExceedanceFraction: number;
  readonly coherentConstellationOverride: boolean;
  readonly distinguishableFromRandom: boolean;
}

export interface WavelengthCoherenceChannelAssessment {
  readonly channelId: string;
  readonly observationCount: number;
  readonly fittedShiftNm: number;
  readonly residualMadNm: number;
  readonly inlierCount: number;
  readonly evaluated: boolean;
  readonly coherent: boolean;
}

export interface WavelengthCoherenceAssessment {
  readonly coherent: boolean;
  readonly channels: readonly WavelengthCoherenceChannelAssessment[];
}

export type HypothesisReliability = "reliable" | "tentative";

export interface ElementInterpretation {
  readonly id: string;
  readonly atomicNumber: number;
  readonly symbol: string;
  readonly name: string;
  readonly reliability: HypothesisReliability;
  readonly independentMatchedGroupCount: number;
  readonly independentMatchedLineCount: number;
  readonly strongCharacteristicGroupCount: number;
  readonly reliableCharacteristicGroupCount: number;
  readonly foundCharacteristicGroupCount: number;
  readonly availableCharacteristicGroupCount: number;
  readonly characteristicGroupCompleteness: number;
  readonly reliableKeyCharacteristicGroupCount: number;
  readonly highSpecificityCharacteristicGroupCount: number;
  /** Rank- and ambiguity-weighted characteristic-group index used only for ordering, never as a probability. */
  readonly characteristicPriorityIndex: number;
  readonly missingKeyCharacteristicGroupCount: number;
  readonly weakEvidenceGroupCount: number;
  readonly foundCharacteristicLineCount: number;
  readonly availableCharacteristicLineCount: number;
  readonly characteristicCompleteness: number;
  readonly missingCharacteristicLines: readonly CharacteristicLineSummary[];
  readonly meanAbsoluteDelta: number;
  readonly maximumAbsoluteDelta: number;
  readonly ionizationStages: readonly number[];
  readonly ionizationGroups: readonly IonizationEvidenceGroup[];
  readonly evidence: readonly AnalysisEvidenceLine[];
  readonly observationsByChannel: readonly ChannelEvidenceSummary[];
  readonly alternativeExplanations: readonly AlternativePeakExplanation[];
  readonly rankingReasons: readonly HypothesisRankingReason[];
  readonly randomAgreement: RandomAgreementEstimate;
  readonly wavelengthCoherence: WavelengthCoherenceAssessment;
  readonly explanation: string;
}

export type RejectedHypothesisReason =
  | "single-match"
  | "random-like-agreement"
  | "insufficient-characteristic-lines"
  | "missing-key-characteristic-lines"
  | "weak-evidence-dominated"
  | "ambiguous-evidence"
  | "incoherent-wavelength-shift"
  | "insufficient-reliable-groups";

export interface RejectedElementHypothesis {
  readonly hypothesis: ElementInterpretation;
  readonly reasons: readonly RejectedHypothesisReason[];
}

export interface InteractiveSpectrumAnalysis {
  readonly spectrumType: SpectrumType;
  readonly channels: readonly ChannelPreparationResult[];
  readonly suitability: MeasurementSuitabilityAssessment;
  readonly preparedDataset: SpectrumDataset;
  readonly preparedStats: SpectrumStats;
  readonly baselineDataset: SpectrumDataset;
  readonly noiseDataset: SpectrumDataset;
  readonly thresholdDataset: SpectrumDataset;
  readonly peaks: readonly AnalyzedPeak[];
  readonly hypotheses: readonly ElementInterpretation[];
  readonly rejectedHypotheses: readonly RejectedElementHypothesis[];
  readonly molecularHypotheses: readonly MolecularHypothesis[];
  readonly rejectedMolecularHypotheses: readonly MolecularHypothesis[];
  readonly molecularAnalysisSkippedReason?: MolecularHypothesisReason;
  readonly unmatchedPeaks: readonly AnalyzedPeak[];
  readonly conclusion: string;
}
