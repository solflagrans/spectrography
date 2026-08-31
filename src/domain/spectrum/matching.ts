import type { SpectralLine } from "@/domain/spectral-library/types";
import {
  createSpectralLibraryWavelengthIndex,
  findSpectralLinesInRange,
  type SpectralLibraryWavelengthIndex,
} from "@/domain/spectral-library/wavelength-index";

import { round } from "./math";
import { IDENTIFICATION_QUALITY_PROFILE } from "./quality-profile";
import type {
  DetectedPeak,
  MatchedPeak,
  SpectralLineCandidate,
  WavelengthUncertaintyComponents,
} from "./types";

export interface AdaptiveMatchingContext {
  readonly spectralResolutionNm: number;
  readonly calibrationUncertaintyNm: number;
}

export interface AdaptiveToleranceResult {
  readonly toleranceNm: number;
  readonly combinedUncertaintyNm: number;
  readonly capped: boolean;
  readonly components: WavelengthUncertaintyComponents;
}

export function matchPeaks(
  peaks: readonly DetectedPeak[],
  library: readonly SpectralLine[] | SpectralLibraryWavelengthIndex,
  context: AdaptiveMatchingContext,
): readonly MatchedPeak[] {
  validateContext(context);
  const index = Array.isArray(library)
    ? createSpectralLibraryWavelengthIndex(library)
    : library as SpectralLibraryWavelengthIndex;
  return peaks.map((peak): MatchedPeak => {
    const candidates = findLineCandidates(peak, index, context);
    return { ...peak, candidates, match: candidates[0] ?? null };
  });
}

export function findLineCandidates(
  peak: DetectedPeak,
  library: readonly SpectralLine[] | SpectralLibraryWavelengthIndex,
  context: AdaptiveMatchingContext,
): readonly SpectralLineCandidate[] {
  validateContext(context);
  const index = Array.isArray(library)
    ? createSpectralLibraryWavelengthIndex(library)
    : library as SpectralLibraryWavelengthIndex;
  const searchRadius = IDENTIFICATION_QUALITY_PROFILE.adaptiveTolerance.maximumToleranceNm;
  return findSpectralLinesInRange(index, peak.wavelength - searchRadius, peak.wavelength + searchRadius)
    .flatMap((spectralLine): readonly SpectralLineCandidate[] => {
      const adaptive = calculateAdaptiveTolerance(peak, spectralLine, context);
      const delta = peak.wavelength - spectralLine.preferredWavelength.valueNm;
      if (Math.abs(delta) > adaptive.toleranceNm) return [];
      return [{
        lineId: spectralLine.id,
        atomicNumber: spectralLine.element.atomicNumber,
        elementSymbol: spectralLine.element.symbol,
        elementName: spectralLine.element.name,
        ionizationStage: spectralLine.ionizationStage,
        ionizationLabel: spectralLine.ionizationLabel,
        line: spectralLine.preferredWavelength.valueNm,
        wavelengthType: spectralLine.preferredWavelength.origin,
        wavelengthMedium: spectralLine.preferredWavelength.medium,
        delta: round(delta, 8),
        adaptiveToleranceNm: adaptive.toleranceNm,
        combinedUncertaintyNm: adaptive.combinedUncertaintyNm,
        normalizedDelta: round(Math.abs(delta) / adaptive.toleranceNm, 8),
        toleranceCapped: adaptive.capped,
        uncertainty: adaptive.components,
      }];
    })
    .sort((left, right) => (
      left.normalizedDelta - right.normalizedDelta
        || Math.abs(left.delta) - Math.abs(right.delta)
        || left.line - right.line
        || left.atomicNumber - right.atomicNumber
        || left.ionizationStage - right.ionizationStage
        || left.lineId.localeCompare(right.lineId)
    ));
}

export function calculateAdaptiveTolerance(
  peak: DetectedPeak,
  line: SpectralLine,
  context: AdaptiveMatchingContext,
): AdaptiveToleranceResult {
  const profile = IDENTIFICATION_QUALITY_PROFILE.adaptiveTolerance;
  const finiteSnr = Number.isFinite(peak.snr) ? Math.max(1, peak.snr) : Number.POSITIVE_INFINITY;
  const components: WavelengthUncertaintyComponents = {
    gridSamplingNm: peak.localGridStepNm / Math.sqrt(12),
    spectralResolutionNm: Number.isFinite(finiteSnr)
      ? context.spectralResolutionNm / (profile.resolvingPowerDivisor * Math.sqrt(finiteSnr))
      : 0,
    peakWidthNm: Number.isFinite(finiteSnr)
      ? peak.widthNm / (profile.resolvingPowerDivisor * finiteSnr)
      : 0,
    peakPositionNm: peak.positionUncertaintyNm,
    referenceLineNm: line.preferredWavelength.uncertaintyNm ?? 0,
    calibrationNm: context.calibrationUncertaintyNm,
  };
  const combined = Math.sqrt(Object.values(components).reduce((sum, value) => sum + value * value, 0));
  const uncapped = Math.max(
    peak.localGridStepNm * profile.minimumGridSteps,
    profile.coverageFactor * combined,
  );
  const toleranceNm = Math.min(profile.maximumToleranceNm, uncapped);
  return {
    toleranceNm: round(toleranceNm, 8),
    combinedUncertaintyNm: round(combined, 8),
    capped: uncapped > profile.maximumToleranceNm,
    components: {
      gridSamplingNm: round(components.gridSamplingNm, 8),
      spectralResolutionNm: round(components.spectralResolutionNm, 8),
      peakWidthNm: round(components.peakWidthNm, 8),
      peakPositionNm: round(components.peakPositionNm, 8),
      referenceLineNm: round(components.referenceLineNm, 8),
      calibrationNm: round(components.calibrationNm, 8),
    },
  };
}

function validateContext(context: AdaptiveMatchingContext): void {
  if (!Number.isFinite(context.spectralResolutionNm) || context.spectralResolutionNm <= 0) {
    throw new Error("Оценённое разрешение канала должно быть положительным числом.");
  }
  if (!Number.isFinite(context.calibrationUncertaintyNm) || context.calibrationUncertaintyNm < 0) {
    throw new Error("Неопределённость калибровки не может быть отрицательной.");
  }
}
