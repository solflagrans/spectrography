import { describe, expect, it } from "vitest";

import type { SpectralLine } from "@/domain/spectral-library/types";

import { findLineCandidates, matchPeaks } from "./matching";

const library = [
  createLine("a-4998", "A", "Элемент A", 499.8, "observed", "air", 1),
  createLine("a-5001", "A", "Элемент A", 500.1, "ritz", "vacuum", 2),
  createLine("b-50005", "B", "Элемент B", 500.05, "observed", "air", 1),
] satisfies readonly SpectralLine[];

describe("spectral line candidates", () => {
  it("returns every line inside tolerance sorted by absolute signed deviation", () => {
    const candidates = findLineCandidates(500, library, 0.25);

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
    });
    expect(candidates[1].delta).toBeCloseTo(-0.1, 10);
    expect(candidates[1]).toMatchObject({ wavelengthType: "ritz", wavelengthMedium: "vacuum" });
    expect(candidates[2].delta).toBeCloseTo(0.2, 10);
  });

  it("keeps the nearest candidate as the automatic suggestion for hypotheses", () => {
    const result = matchPeaks([
      { index: 4, wavelength: 500, intensity: 0.8, prominence: 0.4 },
    ], library, 0.25);

    expect(result.peaks[0].candidates).toHaveLength(3);
    expect(result.peaks[0].match).toEqual(result.peaks[0].candidates[0]);
    expect(result.hypotheses[0].elementSymbol).toBe("B");
    expect(result.hypotheses).toHaveLength(1);
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
): SpectralLine {
  return {
    id,
    element: { atomicNumber: symbol === "A" ? 1 : 2, symbol, name },
    ionizationStage,
    ionizationLabel: ionizationStage === 1 ? "I" : "II",
    preferredWavelength: { valueNm, origin, medium },
    source: { name: "NIST ASD", datasetVersion: "5.12", retrievedAt: "2026-08-30" },
  };
}
