import { describe, expect, it } from "vitest";

import { builtinSpectralLibrary } from "@/domain/spectral-library/builtin-library";
import { demoSpectra } from "@/fixtures/demo-spectra";

import {
  DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  prepareSpectrum,
  runInteractiveSpectrumAnalysis,
  savitzkyGolaySmooth,
} from "./interactive-analysis";

describe("interactive spectrum analysis", () => {
  it("keeps a constant signal unchanged after Savitzky-Golay smoothing", () => {
    for (const value of savitzkyGolaySmooth([4, 4, 4, 4, 4, 4, 4], 5)) {
      expect(value).toBeCloseTo(4, 12);
    }
  });

  it("prepares a separate normalized spectrum without mutating the fixture", () => {
    const sourceMaximum = Math.max(...demoSpectra.fe12.intensities);
    const result = prepareSpectrum(
      demoSpectra.fe12,
      DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing,
    );

    expect(result.dataset).not.toBe(demoSpectra.fe12);
    expect(Math.min(...result.dataset.intensities)).toBe(0);
    expect(Math.max(...result.dataset.intensities)).toBe(1);
    expect(Math.max(...demoSpectra.fe12.intensities)).toBe(sourceMaximum);
  });

  it("derives peaks, hypotheses and a traceable conclusion from one calculation", () => {
    const result = runInteractiveSpectrumAnalysis(
      demoSpectra.fe12,
      builtinSpectralLibrary,
    );
    const peakIds = new Set(result.peaks.map((peak) => peak.id));

    expect(result.peaks.length).toBeGreaterThan(0);
    expect(result.hypotheses.some((hypothesis) => hypothesis.symbol === "Fe")).toBe(true);
    expect(result.conclusion).toContain("Железо (Fe)");
    expect(
      result.hypotheses.flatMap((hypothesis) => hypothesis.evidence)
        .every((evidence) => peakIds.has(evidence.peakId)),
    ).toBe(true);
  });

  it("rejects an even smoothing window with a user-facing message", () => {
    expect(() => runInteractiveSpectrumAnalysis(demoSpectra.fe12, builtinSpectralLibrary, {
      ...DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
      processing: {
        ...DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing,
        smoothingWindow: 10,
      },
    })).toThrow("Выберите нечётный размер окна сглаживания от 1 до 51.");
  });

  it("returns a complete negative conclusion when no peak passes the parameters", () => {
    const result = runInteractiveSpectrumAnalysis(demoSpectra.fe12, builtinSpectralLibrary, {
      ...DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
      peakSearch: {
        ...DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch,
        prominence: 1,
      },
    });

    expect(result.peaks).toHaveLength(0);
    expect(result.hypotheses).toHaveLength(0);
    expect(result.conclusion).toBe(
      "При текущих параметрах пики не обнаружены. Элементный состав остаётся неопределённым.",
    );
  });
});
