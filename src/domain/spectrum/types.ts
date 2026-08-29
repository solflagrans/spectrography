import type { SpectralElement } from "@/domain/spectral-library/types";

export interface SpectrumDataset {
  readonly wavelengths: readonly number[];
  readonly intensities: readonly number[];
}

export type SpectrumNormalizationMethod = "maximum" | "none";

export interface SpectrumProcessingParameters {
  /** Odd number of samples used by the quadratic Savitzky-Golay filter. */
  readonly smoothingWindow: number;
  readonly normalization: SpectrumNormalizationMethod;
}

export interface PeakSearchParameters {
  /** Minimum relative signal level in the prepared spectrum, from 0 to 1. */
  readonly threshold: number;
  /** Minimum prominence relative to the prepared spectrum range, from 0 to 1. */
  readonly prominence: number;
  /** Minimum wavelength distance between selected peaks, in nanometres. */
  readonly minimumDistance: number;
  /** Maximum wavelength delta for a reference-line match, in nanometres. */
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

export interface DetectedPeak {
  readonly index: number;
  readonly wavelength: number;
  readonly intensity: number;
  readonly prominence: number;
}

export interface SpectralLineMatch {
  readonly elementSymbol: SpectralElement["symbol"];
  readonly elementName: SpectralElement["name"];
  readonly line: number;
  readonly delta: number;
}

export interface MatchedPeak extends DetectedPeak {
  readonly match: SpectralLineMatch | null;
}

export interface ElementHypothesis {
  readonly elementSymbol: SpectralElement["symbol"];
  readonly elementName: SpectralElement["name"];
  /** A relative ranking heuristic, not a calibrated probability. */
  readonly heuristicScore: number;
  readonly peaks: readonly MatchedPeak[];
}

export type ElementInterpretationStatus = "confirmed" | "possible" | "review";

export interface AnalysisEvidenceLine {
  readonly peakId: string;
  readonly peakWavelength: number;
  readonly observedWavelength: number;
  readonly referenceWavelength: number;
  readonly delta: number;
  readonly elementSymbol: string;
  readonly ion: string;
}

export interface ElementInterpretation {
  readonly symbol: string;
  readonly name: string;
  readonly status: ElementInterpretationStatus;
  /** A relative ranking heuristic, not a calibrated probability. */
  readonly heuristicScore: number;
  readonly explanation: string;
  readonly evidence: readonly AnalysisEvidenceLine[];
}

export interface InteractiveSpectrumAnalysis {
  readonly preparedDataset: SpectrumDataset;
  readonly preparedStats: SpectrumStats;
  readonly baseline: number;
  readonly threshold: number;
  readonly peaks: readonly (MatchedPeak & { readonly id: string })[];
  readonly hypotheses: readonly ElementInterpretation[];
  readonly unmatchedPeaks: readonly (MatchedPeak & { readonly id: string })[];
  readonly conclusion: string;
}
