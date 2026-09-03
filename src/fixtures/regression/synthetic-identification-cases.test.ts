import { describe, expect, it } from "vitest";

import { runSyntheticIdentificationCases } from "./synthetic-identification-cases";

describe("controlled synthetic identification matrix", () => {
  it("remains stable under noise, resolution and a validated common shift", () => {
    const results = runSyntheticIdentificationCases();
    for (const { definition, analysis } of results.filter((item) => !item.definition.expectedRefusal)) {
      expect(analysis.hypotheses.map((item) => item.symbol), definition.id)
        .toEqual(expect.arrayContaining([...definition.expectedAtomicSymbols]));
      expect(analysis.molecularHypotheses.map((item) => item.formula), definition.id)
        .toEqual(expect.arrayContaining([...definition.expectedMolecularFormulae]));
    }
    const shifted = results.find((item) => item.definition.id === "shifted-scale")!.analysis.channels[0].wavelengthCalibration;
    expect(shifted.status).toBe("applied");
    expect(shifted.shiftNm).toBeCloseTo(0.24, 1);
    expect(shifted.validationAnchorIds.length).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it("refuses missing and random evidence without promoting false hypotheses", () => {
    const results = runSyntheticIdentificationCases().filter((item) => item.definition.expectedRefusal);
    for (const { definition, analysis } of results) {
      expect(analysis.hypotheses, definition.id).toHaveLength(0);
      expect(analysis.molecularHypotheses, definition.id).toHaveLength(0);
    }
  }, 30_000);
});
