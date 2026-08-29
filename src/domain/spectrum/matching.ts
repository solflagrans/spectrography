import type { SpectralElement } from "@/domain/spectral-library/types";

import { round } from "./math";
import type { DetectedPeak, ElementHypothesis, MatchedPeak, SpectralLineMatch } from "./types";

export function matchPeaks(
  peaks: readonly DetectedPeak[],
  library: readonly SpectralElement[],
  tolerance: number,
): { peaks: readonly MatchedPeak[]; hypotheses: readonly ElementHypothesis[] } {
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    throw new Error("Допуск совпадения должен быть положительным числом.");
  }

  const matchedPeaks = peaks.map((peak): MatchedPeak => ({
    ...peak,
    match: findNearestLine(peak.wavelength, library, tolerance),
  }));

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
    const closeness = 1 - peak.match.delta / tolerance;

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

function findNearestLine(
  wavelength: number,
  library: readonly SpectralElement[],
  tolerance: number,
): SpectralLineMatch | null {
  let nearest: SpectralLineMatch | null = null;

  for (const element of library) {
    for (const line of element.lines) {
      const delta = Math.abs(wavelength - line);
      if (delta <= tolerance && (!nearest || delta < nearest.delta)) {
        nearest = {
          elementSymbol: element.symbol,
          elementName: element.name,
          line,
          delta,
        };
      }
    }
  }

  return nearest;
}
