import { describe, expect, it } from "vitest";

import { loadAirPlasmaRegressionAnalyses } from "./load-air-plasma-regression";

describe("independent air-plasma regression measurements", () => {
  it("keeps nitrogen first, preserves oxygen evidence and suppresses dense aluminium alternatives", async () => {
    const analyses = await loadAirPlasmaRegressionAnalyses();

    expect(analyses).toHaveLength(2);
    expect(new Set(analyses.map((analysis) => analysis.id)).size).toBe(2);
    for (const analysis of analyses) {
      expect(analysis.channels).toHaveLength(1);
      expect(analysis.hypotheses[0]?.symbol).toBe("N");
      expect(analysis.hypotheses.some((item) => item.symbol === "Al")).toBe(false);
      expect(analysis.rejectedHypotheses.some((item) => item.hypothesis.symbol === "Al")).toBe(true);
    }

    const [xlsx, raw8] = analyses;
    expect(raw8.rejectedHypotheses.find((item) => item.hypothesis.symbol === "Al")?.reasons)
      .toContain("weak-evidence-dominated");
    const reliableOxygen = xlsx.hypotheses.find((item) => item.symbol === "O");
    expect(reliableOxygen?.strongCharacteristicGroupCount).toBeGreaterThanOrEqual(3);
    expect(reliableOxygen?.reliableKeyCharacteristicGroupCount).toBeGreaterThanOrEqual(2);

    const diagnosticOxygen = raw8.rejectedHypotheses.find((item) => item.hypothesis.symbol === "O")?.hypothesis;
    expect(diagnosticOxygen?.strongCharacteristicGroupCount).toBeGreaterThanOrEqual(1);
    expect(diagnosticOxygen?.reliableKeyCharacteristicGroupCount).toBeGreaterThanOrEqual(1);
    expect(raw8.hypotheses[0]?.reliability).toBe("tentative");
    expect(raw8.conclusion).toContain("Надёжных гипотез недостаточно");
    expect(raw8.conclusion).toContain("Кислород (O)");
    expect(raw8.molecularHypotheses.map((item) => item.formula)).toContain("N₂");
    expect(raw8.molecularHypotheses.find((item) => item.formula === "N₂")?.supportedRegionIds.length).toBeGreaterThanOrEqual(2);
    expect(raw8.rejectedMolecularHypotheses.map((item) => item.formula)).toContain("N₂⁺");
    expect(xlsx.molecularHypotheses).toHaveLength(0);
    expect(xlsx.conclusion).toContain("Надёжного совпадения молекулярных полос");
  }, 30_000);
});
