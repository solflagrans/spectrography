import type { SpectralLine } from "@/domain/spectral-library/types";
import {
  createSpectralLibraryWavelengthIndex,
  findSpectralLinesInRange,
  type SpectralLibraryWavelengthIndex,
} from "@/domain/spectral-library/wavelength-index";

import type { DetectedPeak, MatchedPeak, SpectralLineCandidate } from "./types";

export function matchPeaks(
  peaks: readonly DetectedPeak[],
  library: readonly SpectralLine[] | SpectralLibraryWavelengthIndex,
  tolerance: number,
): readonly MatchedPeak[] {
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    throw new Error("Допуск совпадения должен быть положительным числом.");
  }
  const index = Array.isArray(library)
    ? createSpectralLibraryWavelengthIndex(library)
    : library as SpectralLibraryWavelengthIndex;
  return peaks.map((peak): MatchedPeak => {
    const candidates = findLineCandidates(peak.wavelength, index, tolerance);
    return { ...peak, candidates, match: candidates[0] ?? null };
  });
}

export function findLineCandidates(
  wavelength: number,
  library: readonly SpectralLine[] | SpectralLibraryWavelengthIndex,
  tolerance: number,
): readonly SpectralLineCandidate[] {
  const index = Array.isArray(library)
    ? createSpectralLibraryWavelengthIndex(library)
    : library as SpectralLibraryWavelengthIndex;
  return findSpectralLinesInRange(index, wavelength - tolerance, wavelength + tolerance)
    .map((spectralLine): SpectralLineCandidate => ({
      lineId: spectralLine.id,
      atomicNumber: spectralLine.element.atomicNumber,
      elementSymbol: spectralLine.element.symbol,
      elementName: spectralLine.element.name,
      ionizationStage: spectralLine.ionizationStage,
      ionizationLabel: spectralLine.ionizationLabel,
      line: spectralLine.preferredWavelength.valueNm,
      wavelengthType: spectralLine.preferredWavelength.origin,
      wavelengthMedium: spectralLine.preferredWavelength.medium,
      delta: wavelength - spectralLine.preferredWavelength.valueNm,
    }))
    .sort((left, right) => (
      Math.abs(left.delta) - Math.abs(right.delta)
        || left.line - right.line
        || left.atomicNumber - right.atomicNumber
        || left.ionizationStage - right.ionizationStage
        || left.lineId.localeCompare(right.lineId)
    ));
}
