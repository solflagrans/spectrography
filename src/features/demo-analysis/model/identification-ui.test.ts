import { describe, expect, it } from "vitest";

import {
  createWorkingAnalysis,
  DEMO_ANALYSIS_INPUT,
} from "@/application/analysis/create-working-analysis";

import {
  diagnosticReasonLabels,
  findIdentificationEntry,
  getIdentificationEntries,
} from "./identification-ui";

const analysis = createWorkingAnalysis(DEMO_ANALYSIS_INPUT);

describe("identification UI projections", () => {
  it("keeps accepted and diagnostic entries separate and exposes user-facing reasons", () => {
    expect(getIdentificationEntries(analysis, "hypotheses")).toHaveLength(analysis.hypotheses.length);
    const diagnostics = getIdentificationEntries(analysis, "diagnostics");
    expect(diagnostics).toHaveLength(analysis.rejectedHypotheses.length);
    expect(diagnostics.every((entry) => entry.rejectionReasons.length > 0)).toBe(true);
    expect(diagnosticReasonLabels["single-match"]).toBe("Единичное совпадение");
    expect(diagnosticReasonLabels["random-like-agreement"]).not.toContain("вероят");
  });

  it("filters by element name or symbol and supports every requested stable ordering", () => {
    const byName = getIdentificationEntries(analysis, "diagnostics", "Магний", "ranking");
    const bySymbol = getIdentificationEntries(analysis, "diagnostics", "Mg", "ranking");
    expect(byName.map((entry) => entry.id)).toEqual(bySymbol.map((entry) => entry.id));
    expect(byName[0]?.hypothesis.symbol).toBe("Mg");

    const characteristic = getIdentificationEntries(analysis, "diagnostics", "", "characteristic");
    const independent = getIdentificationEntries(analysis, "diagnostics", "", "independent");
    const deviation = getIdentificationEntries(analysis, "diagnostics", "", "deviation");
    const name = getIdentificationEntries(analysis, "diagnostics", "", "name");
    expect(characteristic[0].hypothesis.foundCharacteristicLineCount).toBeGreaterThanOrEqual(characteristic.at(-1)!.hypothesis.foundCharacteristicLineCount);
    expect(independent[0].hypothesis.independentMatchedLineCount).toBeGreaterThanOrEqual(independent.at(-1)!.hypothesis.independentMatchedLineCount);
    expect(deviation[0].hypothesis.meanAbsoluteDelta).toBeLessThanOrEqual(deviation.at(-1)!.hypothesis.meanAbsoluteDelta);
    expect(name.map((entry) => entry.hypothesis.name)).toEqual([...name.map((entry) => entry.hypothesis.name)].sort((left, right) => left.localeCompare(right, "ru")));
  });

  it("finds a selected hypothesis regardless of its current list", () => {
    const diagnostic = analysis.rejectedHypotheses[0].hypothesis;
    expect(findIdentificationEntry(analysis, diagnostic.id)?.hypothesis).toBe(diagnostic);
    expect(findIdentificationEntry(analysis, "missing")).toBeNull();
  });
});
