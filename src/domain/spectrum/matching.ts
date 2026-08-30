import type { SpectralLine } from "@/domain/spectral-library/types";

import { round } from "./math";
import type { DetectedPeak, ElementHypothesis, MatchedPeak, SpectralLineCandidate } from "./types";

export function matchPeaks(
  peaks: readonly DetectedPeak[],
  library: readonly SpectralLine[],
  tolerance: number,
): { peaks: readonly MatchedPeak[]; hypotheses: readonly ElementHypothesis[] } {
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    throw new Error("Допуск совпадения должен быть положительным числом.");
  }

  const matchedPeaks = peaks.map((peak): MatchedPeak => {
    const candidates = findLineCandidates(peak.wavelength, library, tolerance);
    return { ...peak, candidates, match: candidates[0] ?? null };
  });

  const scores = new Map<string, ElementHypothesis>();

  for (const peak of matchedPeaks) {
    if (!peak.match) continue;

    const key = peak.match.elementSymbol;
    const current = scores.get(key) ?? {
      elementSymbol: key,
      elementName: peak.match.elementName,
      heuristicScore: 0,
      peaks: [],
    };
    const closeness = 1 - Math.abs(peak.match.delta) / tolerance;

    scores.set(key, {
      ...current,
      heuristicScore: current.heuristicScore + 1 + closeness + peak.intensity / 1_000,
      peaks: [...current.peaks, peak],
    });
  }

  const hypotheses = [...scores.values()]
    .map((hypothesis) => ({ ...hypothesis, heuristicScore: round(hypothesis.heuristicScore, 2) }))
    .sort(
      (left, right) =>
        right.heuristicScore - left.heuristicScore || right.peaks.length - left.peaks.length,
    );

  return { peaks: matchedPeaks, hypotheses };
}

export function findLineCandidates(
  wavelength: number,
  library: readonly SpectralLine[],
  tolerance: number,
): readonly SpectralLineCandidate[] {
  const candidates: SpectralLineCandidate[] = [];

  for (const spectralLine of library) {
    const line = spectralLine.preferredWavelength.valueNm;
    const delta = wavelength - line;
    if (Math.abs(delta) <= tolerance) {
      candidates.push({
        lineId: spectralLine.id,
        elementSymbol: spectralLine.element.symbol,
        elementName: spectralLine.element.name,
        ionizationStage: spectralLine.ionizationStage,
        ionizationLabel: spectralLine.ionizationLabel,
        line,
        wavelengthType: spectralLine.preferredWavelength.origin,
        wavelengthMedium: spectralLine.preferredWavelength.medium,
        delta,
      });
    }
  }

  return candidates.sort((left, right) => (
    Math.abs(left.delta) - Math.abs(right.delta)
      || left.line - right.line
      || left.elementSymbol.localeCompare(right.elementSymbol)
      || left.ionizationStage - right.ionizationStage
      || left.lineId.localeCompare(right.lineId)
  ));
}
