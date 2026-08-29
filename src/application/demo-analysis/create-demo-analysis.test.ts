import { describe, expect, it } from "vitest";

import { createDemoAnalysis } from "./create-demo-analysis";

describe("createDemoAnalysis", () => {
  it("создаёт согласованный демонстрационный анализ из одного fixture", () => {
    const analysis = createDemoAnalysis();
    const peakIds = new Set(analysis.peaks.map((peak) => peak.id));

    expect(analysis.rawDataset).not.toBe(analysis.preparedDataset);
    expect(analysis.rawDataset.wavelengths).toHaveLength(1_024);
    expect(analysis.peaks.length).toBeGreaterThanOrEqual(6);
    expect(analysis.hypotheses.some((hypothesis) => hypothesis.symbol === "Fe")).toBe(true);
    expect(analysis.hypotheses.every((hypothesis) => hypothesis.heuristicScore >= 0)).toBe(true);

    for (const hypothesis of analysis.hypotheses) {
      for (const evidence of hypothesis.evidence) {
        expect(peakIds.has(evidence.peakId)).toBe(true);
        expect(evidence.delta).toBeLessThanOrEqual(analysis.parameters.peakSearch.tolerance);
      }
    }
  });

  it("recalculates dependent results when the peak threshold changes", () => {
    const defaultAnalysis = createDemoAnalysis();
    const stricterAnalysis = createDemoAnalysis({
      ...defaultAnalysis.parameters,
      peakSearch: { ...defaultAnalysis.parameters.peakSearch, threshold: 0.9 },
    });

    expect(stricterAnalysis.peaks.length).toBeLessThan(defaultAnalysis.peaks.length);
    expect(stricterAnalysis.conclusion).not.toBe(defaultAnalysis.conclusion);
  });
});
