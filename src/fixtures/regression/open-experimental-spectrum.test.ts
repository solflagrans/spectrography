import { describe, expect, it } from "vitest";

import { loadOpenExperimentalAirPlasmaAnalysis } from "./load-open-experimental-spectrum";

describe("open CC BY experimental air-plasma spectrum", () => {
  it("finds the documented N₂ emission shape without promoting unrelated atomic alternatives", async () => {
    const analysis = await loadOpenExperimentalAirPlasmaAnalysis();
    expect(analysis.suitability.status).toBe("limited");
    expect(analysis.hypotheses).toHaveLength(0);
    expect(analysis.molecularHypotheses.map((item) => item.formula)).toContain("N₂");
    expect(analysis.molecularHypotheses.find((item) => item.formula === "N₂")?.supportedRegionIds.length).toBeGreaterThanOrEqual(3);
  }, 30_000);
});
