import { describe, expect, it } from "vitest";

import type { SpectralElement } from "@/domain/spectral-library/types";

import { analyzeSpectrum } from "./analysis";

describe("analyzeSpectrum", () => {
  it("finds a peak and ranks the nearest spectral line", () => {
    const library: readonly SpectralElement[] = [
      { symbol: "X", name: "Тестовый элемент", lines: [502] },
    ];

    const result = analyzeSpectrum(
      {
        wavelengths: [500, 501, 502, 503, 504],
        intensities: [0, 0, 10, 0, 0],
      },
      library,
      { sigma: 0.5, prominence: 0.1, distance: 1, tolerance: 0.2, smoothing: 1 },
    );

    expect(result.peaks).toHaveLength(1);
    expect(result.peaks[0].match?.elementSymbol).toBe("X");
    expect(result.hypotheses[0]).toMatchObject({
      elementSymbol: "X",
      heuristicScore: 2.01,
    });
  });

  it("normalizes the dataset order before analysis", () => {
    const result = analyzeSpectrum(
      {
        wavelengths: [504, 502, 500, 503, 501],
        intensities: [0, 10, 0, 0, 0],
      },
      [],
      { sigma: 0.5, prominence: 0.1, distance: 1, tolerance: 0.2, smoothing: 1 },
    );

    expect(result.peaks[0].wavelength).toBe(502);
  });
});
