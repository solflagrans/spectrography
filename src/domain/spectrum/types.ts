import type { SpectralElement } from "@/domain/spectral-library/types";

export interface SpectrumDataset {
  readonly wavelengths: readonly number[];
  readonly intensities: readonly number[];
}

export interface AnalysisOptions {
  readonly sigma: number;
  readonly prominence: number;
  readonly distance: number;
  readonly tolerance: number;
  readonly smoothing: number;
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

export interface PeakDetectionResult {
  readonly peaks: readonly DetectedPeak[];
  readonly threshold: number;
  readonly stats: SpectrumStats;
}

export interface SpectrumAnalysisResult {
  readonly detection: PeakDetectionResult;
  readonly peaks: readonly MatchedPeak[];
  readonly hypotheses: readonly ElementHypothesis[];
}
