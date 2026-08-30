import type { PreferredWavelengthOrigin, SpectralLine, WavelengthMedium } from "@/domain/spectral-library/types";

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
  readonly tolerance: number;
}

export interface InteractiveAnalysisParameters {
  readonly processing: SpectrumProcessingParameters;
  readonly peakSearch: PeakSearchParameters;
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
  readonly channelId: string;
  readonly index: number;
  readonly sourceIndex: number;
  readonly wavelength: number;
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
  readonly preparedDataset: SpectrumDataset;
  readonly baselineDataset: SpectrumDataset;
  readonly noiseDataset: SpectrumDataset;
  readonly thresholdDataset: SpectrumDataset;
  readonly preparedStats: SpectrumStats;
  readonly parameters: InteractiveAnalysisParameters;
  readonly peaks: readonly AnalyzedPeak[];
  readonly wavelengthRange: { readonly minimum: number; readonly maximum: number };
  readonly usable: boolean;
  readonly transformations: readonly string[];
}

export interface EvidenceObservation {
  readonly channelId: string;
  readonly peakId: string;
  readonly peakWavelength: number;
  readonly peakIntensity: number;
  readonly snr: number;
  readonly delta: number;
}

export interface AnalysisEvidenceLine {
  readonly lineId: string;
  readonly referenceWavelength: number;
  readonly elementSymbol: string;
  readonly elementName: string;
  readonly ionizationStage: number;
  readonly ionizationLabel: string;
  readonly wavelengthType: PreferredWavelengthOrigin;
  readonly wavelengthMedium: WavelengthMedium;
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

export interface IonizationEvidenceGroup {
  readonly ionizationStage: number;
  readonly ionizationLabel: string;
  readonly availableCharacteristicLines: readonly CharacteristicLineSummary[];
  readonly foundCharacteristicLineIds: readonly string[];
  readonly missingCharacteristicLines: readonly CharacteristicLineSummary[];
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

export type HypothesisRankingReasonCode = "characteristic-lines" | "characteristic-completeness" | "independent-lines" | "wavelength-agreement";

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
  readonly distinguishableFromRandom: boolean;
}

export interface ElementInterpretation {
  readonly id: string;
  readonly atomicNumber: number;
  readonly symbol: string;
  readonly name: string;
  readonly independentMatchedLineCount: number;
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
  readonly explanation: string;
}

export type RejectedHypothesisReason = "single-match" | "random-like-agreement" | "insufficient-characteristic-lines" | "missing-key-characteristic-lines";

export interface RejectedElementHypothesis {
  readonly hypothesis: ElementInterpretation;
  readonly reasons: readonly RejectedHypothesisReason[];
}

export interface InteractiveSpectrumAnalysis {
  readonly channels: readonly ChannelPreparationResult[];
  readonly preparedDataset: SpectrumDataset;
  readonly preparedStats: SpectrumStats;
  readonly baselineDataset: SpectrumDataset;
  readonly noiseDataset: SpectrumDataset;
  readonly thresholdDataset: SpectrumDataset;
  readonly peaks: readonly AnalyzedPeak[];
  readonly hypotheses: readonly ElementInterpretation[];
  readonly rejectedHypotheses: readonly RejectedElementHypothesis[];
  readonly unmatchedPeaks: readonly AnalyzedPeak[];
  readonly conclusion: string;
}
