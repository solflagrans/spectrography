import { describe, expect, it } from "vitest";

import type { SpectralLine } from "@/domain/spectral-library/types";

import { calculateAdaptiveTolerance, findLineCandidates, matchPeaks } from "./matching";
import type { DetectedPeak } from "./types";

const library = [
  createLine("a-4998", "A", "Элемент A", 499.8, "observed", "air", 1),
  createLine("a-5001", "A", "Элемент A", 500.1, "ritz", "vacuum", 2),
  createLine("b-50005", "B", "Элемент B", 500.05, "observed", "air", 1),
] satisfies readonly SpectralLine[];

describe("spectral line candidates", () => {
  it("returns every line inside its adaptive tolerance sorted by normalized deviation", () => {
    const candidates = findLineCandidates(peak(), library, { spectralResolutionNm: 0.2, calibrationUncertaintyNm: 0.08 });

    expect(candidates.map((candidate) => [candidate.elementSymbol, candidate.line])).toEqual([
      ["B", 500.05],
      ["A", 500.1],
      ["A", 499.8],
    ]);
    expect(candidates[0].delta).toBeCloseTo(-0.05, 10);
    expect(candidates[0]).toMatchObject({
      lineId: "b-50005",
      ionizationStage: 1,
      ionizationLabel: "I",
      wavelengthType: "observed",
      wavelengthMedium: "air",
      sourceRecord: { sourceName: "NIST ASD", datasetVersion: "5.12" },
    });
    expect(candidates[1].delta).toBeCloseTo(-0.1, 10);
    expect(candidates[1]).toMatchObject({ wavelengthType: "ritz", wavelengthMedium: "vacuum" });
    expect(candidates[2].delta).toBeCloseTo(0.2, 10);
  });

  it("keeps the nearest candidate as the automatic suggestion for hypotheses", () => {
    const result = matchPeaks([peak()], library, { spectralResolutionNm: 0.2, calibrationUncertaintyNm: 0.08 });

    expect(result[0].candidates).toHaveLength(3);
    expect(result[0].match).toEqual(result[0].candidates[0]);
    expect(result[0].match?.elementSymbol).toBe("B");
  });

  it("widens cautiously for poorer localization and includes reference-line uncertainty", () => {
    const precise = peak({ snr: 40, positionUncertaintyNm: 0.02, widthNm: 0.15 });
    const noisy = peak({ snr: 5, positionUncertaintyNm: 0.08, widthNm: 0.5 });
    const uncertainLine = createLine("u", "A", "Элемент A", 500, "observed", "air", 1, 0.06);
    const preciseTolerance = calculateAdaptiveTolerance(precise, uncertainLine, { spectralResolutionNm: 0.2, calibrationUncertaintyNm: 0.03 });
    const noisyTolerance = calculateAdaptiveTolerance(noisy, uncertainLine, { spectralResolutionNm: 0.5, calibrationUncertaintyNm: 0.03 });

    expect(noisyTolerance.toleranceNm).toBeGreaterThan(preciseTolerance.toleranceNm);
    expect(preciseTolerance.components.referenceLineNm).toBe(0.06);
    expect(preciseTolerance.toleranceNm).toBeGreaterThanOrEqual(precise.localGridStepNm * 1.25);
  });
});

function createLine(
  id: string,
  symbol: string,
  name: string,
  valueNm: number,
  origin: "observed" | "ritz",
  medium: "air" | "vacuum",
  ionizationStage: number,
  uncertaintyNm?: number,
): SpectralLine {
  return {
    id,
    element: { atomicNumber: symbol === "A" ? 1 : 2, symbol, name },
    ionizationStage,
    ionizationLabel: ionizationStage === 1 ? "I" : "II",
    preferredWavelength: { valueNm, origin, medium, ...(uncertaintyNm === undefined ? {} : { uncertaintyNm }) },
    source: { name: "NIST ASD", datasetVersion: "5.12", retrievedAt: "2026-08-30" },
  };
}

function peak(overrides: Partial<DetectedPeak> = {}): DetectedPeak {
  return {
    id: "peak-c1-point-5",
    channelId: "c1",
    sourceIndex: 4,
    index: 4,
    sampledWavelength: 500,
    refinedWavelength: 500,
    wavelength: 500,
    refinementOffsetNm: 0,
    localGridStepNm: 0.1,
    positionUncertaintyNm: 0.03,
    positionMethod: "quadratic-local-profile",
    positionRefined: true,
    rawIntensity: 8,
    intensity: 0.8,
    prominence: 0.4,
    snr: 9,
    widthNm: 0.2,
    ...overrides,
  };
}
