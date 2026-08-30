import { describe, expect, it } from "vitest";

import { findLineCandidates, matchPeaks } from "./matching";

const library = [
  { symbol: "A", name: "Элемент A", lines: [499.8, 500.1] },
  { symbol: "B", name: "Элемент B", lines: [500.05] },
];

describe("spectral line candidates", () => {
  it("returns every line inside tolerance sorted by absolute signed deviation", () => {
    const candidates = findLineCandidates(500, library, 0.25);

    expect(candidates.map((candidate) => [candidate.elementSymbol, candidate.line])).toEqual([
      ["B", 500.05],
      ["A", 500.1],
      ["A", 499.8],
    ]);
    expect(candidates[0].delta).toBeCloseTo(-0.05, 10);
    expect(candidates[1].delta).toBeCloseTo(-0.1, 10);
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
