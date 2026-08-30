import { describe, expect, it } from "vitest";

import { createWorkingAnalysis, DEMO_ANALYSIS_INPUT } from "./create-working-analysis";

describe("createWorkingAnalysis", () => {
  it("создаёт согласованный анализ встроенного спектра через интерактивный конвейер", () => {
    const analysis = createWorkingAnalysis(DEMO_ANALYSIS_INPUT);
    const peakIds = new Set(analysis.peaks.map((peak) => peak.id));

    expect(analysis.rawDataset).not.toBe(analysis.preparedDataset);
    expect(analysis.rawDataset.wavelengths).toHaveLength(1_024);
    expect(analysis.peaks.length).toBeGreaterThan(0);
    expect([...analysis.hypotheses, ...analysis.rejectedHypotheses.map((item) => item.hypothesis)]
      .some((hypothesis) => hypothesis.symbol === "Fe")).toBe(true);

    for (const hypothesis of analysis.hypotheses) {
      for (const evidence of hypothesis.evidence) {
        expect(peakIds.has(evidence.peakId)).toBe(true);
        expect(Math.abs(evidence.delta)).toBeLessThanOrEqual(analysis.parameters.peakSearch.tolerance);
      }
    }
  });

  it("сохраняет исходный порядок и фиксирует сортировку только как операцию рабочей копии", () => {
    const analysis = createWorkingAnalysis({
      id: "import-1",
      title: "unordered.json",
      source: {
        kind: "Пользовательский файл",
        fileName: "unordered.json",
        format: "JSON",
        units: "нм / отн. ед.",
      },
      rawDataset: {
        wavelengths: [530, 420, 480],
        intensities: [0.6, 0.8, 0.9],
      },
    });

    expect(analysis.rawDataset.wavelengths).toEqual([530, 420, 480]);
    expect(analysis.preparedDataset.wavelengths).toEqual([420, 480, 530]);
    expect(analysis.transformations[0].id).toBe("sorting");
  });

  it("пересчитывает зависимые результаты при изменении минимального SNR", () => {
    const defaultAnalysis = createWorkingAnalysis(DEMO_ANALYSIS_INPUT);
    const stricterAnalysis = createWorkingAnalysis(DEMO_ANALYSIS_INPUT, {
      ...defaultAnalysis.parameters,
      peakSearch: { ...defaultAnalysis.parameters.peakSearch, minimumSnr: 100 },
    });

    expect(stricterAnalysis.peaks.length).toBeLessThan(defaultAnalysis.peaks.length);
    expect(stricterAnalysis.conclusion).not.toBe(defaultAnalysis.conclusion);
  });

  it("принимает несколько каналов через ту же прикладную модель", () => {
    const primary = { wavelengths: [500, 501, 502, 503, 504], intensities: [0, 0, 10, 0, 0] };
    const secondary = { wavelengths: [600, 601, 602, 603, 604], intensities: [0, 0, 8, 0, 0] };
    const analysis = createWorkingAnalysis({
      ...DEMO_ANALYSIS_INPUT,
      rawDataset: primary,
      channels: [
        { id: "uv", name: "УФ-канал", dataset: primary },
        { id: "visible", name: "Видимый канал", dataset: secondary },
      ],
    });
    expect(analysis.channels.map((channel) => channel.id)).toEqual(["uv", "visible"]);
    expect(analysis.channels.every((channel) => channel.baselineDataset.intensities.length === 5)).toBe(true);
  });
});
