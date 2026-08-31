import { describe, expect, it } from "vitest";

import type { SpectralLine } from "@/domain/spectral-library/types";

import { estimateChannelResolutionNm, groupSpectralLines } from "./spectral-groups";
import type { AnalyzedPeak } from "./types";

describe("resolution-aware spectral groups", () => {
  it("counts an unresolved multiplet once without chaining a group beyond the resolving width", () => {
    const groups = groupSpectralLines([
      line("o-1", 777.194),
      line("o-2", 777.417),
      line("o-3", 777.539),
      line("o-4", 778.08),
      line("o-5", 778.62),
    ], 0.9);

    expect(groups).toHaveLength(2);
    expect(groups[0].lines.map((item) => item.id)).toEqual(["o-1", "o-2", "o-3", "o-4"]);
    expect(groups[0].maximumWavelength - groups[0].minimumWavelength).toBeLessThanOrEqual(0.9);
    expect(groups[1].lines.map((item) => item.id)).toEqual(["o-5"]);
  });

  it("derives a conservative channel resolution from measured peak widths and the sampling floor", () => {
    const peaks = [peak(0.8), peak(1.0), peak(1.2)];
    expect(estimateChannelResolutionNm([500, 500.1, 500.2, 500.3], peaks)).toBe(1);
    expect(estimateChannelResolutionNm([500, 500.2, 500.4], [])).toBe(0.5);
  });
});

function line(id: string, wavelength: number): SpectralLine {
  return {
    id,
    element: { atomicNumber: 8, symbol: "O", name: "Кислород" },
    ionizationStage: 1,
    ionizationLabel: "I",
    observedWavelength: { valueNm: wavelength, medium: "air", rawValue: String(wavelength) },
    preferredWavelength: { valueNm: wavelength, medium: "air", origin: "observed" },
    relativeIntensity: { rawValue: "100", numericValue: 100, notations: [] },
    source: { name: "NIST ASD", datasetVersion: "5.12", retrievedAt: "2026-08-30" },
  };
}

function peak(widthNm: number): AnalyzedPeak {
  return {
    id: `peak-${widthNm}`,
    channelId: "c",
    index: 0,
    sourceIndex: 0,
    sampledWavelength: 500,
    refinedWavelength: 500,
    wavelength: 500,
    refinementOffsetNm: 0,
    localGridStepNm: 0.1,
    positionUncertaintyNm: 0.03,
    positionMethod: "quadratic-local-profile",
    positionRefined: true,
    rawIntensity: 1,
    intensity: 1,
    prominence: 1,
    snr: 20,
    widthNm,
    candidates: [],
    match: null,
  };
}
