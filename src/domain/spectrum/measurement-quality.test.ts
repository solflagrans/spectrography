import { describe, expect, it } from "vitest";

import { assessChannelSuitability } from "./measurement-quality";
import type { DetectedPeak, SpectrumDataset } from "./types";

describe("measurement suitability assessment", () => {
  it("accepts a clean well-sampled spectrum without pseudo-probability", () => {
    const result = assessChannelSuitability(input());
    expect(result.issues).toEqual([]);
    expect(result.status).toBe("sufficient");
    expect(result.summary).toBe("Данных достаточно.");
  });

  it("reports baseline drift, noise and isolated damage as concrete limitations", () => {
    const source = input();
    const raw = [...source.rawDataset.intensities];
    for (const index of [50, 90, 150, 210, 330, 460]) raw[index] = 50;
    const result = assessChannelSuitability({
      ...source,
      rawDataset: { ...source.rawDataset, intensities: raw },
      preparedDataset: { ...source.preparedDataset, intensities: source.preparedDataset.intensities.map((value) => value * 0.05) },
      baselineDataset: { ...source.baselineDataset, intensities: source.baselineDataset.intensities.map((_, index) => index / 50) },
      noiseDataset: { ...source.noiseDataset, intensities: source.noiseDataset.intensities.map(() => 0.01) },
    });
    expect(result.status).toBe("limited");
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["low-dynamic-range", "baseline-drift", "isolated-outliers"]));
  });

  it("does not call repeated extrema saturation when detector bit depth is unknown", () => {
    const source = input();
    const raw = source.rawDataset.intensities.map((value, index) => index >= 100 && index < 108 ? 100 : value);
    const result = assessChannelSuitability({ ...source, rawDataset: { ...source.rawDataset, intensities: raw } });
    const issue = result.issues.find((item) => item.code === "possible-signal-limit");
    expect(issue?.explanation).toContain("возможное ограничение");
    expect(issue?.explanation.toLowerCase()).toContain("не установленное насыщение");
  });

  it("refuses interpretation when the range and feature count are insufficient", () => {
    const source = input();
    const short = { wavelengths: source.rawDataset.wavelengths.slice(0, 10), intensities: source.rawDataset.intensities.slice(0, 10) };
    const result = assessChannelSuitability({
      ...source,
      rawDataset: short,
      preparedDataset: short,
      baselineDataset: { ...short, intensities: short.intensities.map(() => 0) },
      noiseDataset: { ...short, intensities: short.intensities.map(() => 0.01) },
      peaks: [],
    });
    expect(result.status).toBe("impossible");
    expect(result.summary).toContain("Надёжная интерпретация невозможна");
  });
});

function input() {
  const wavelengths = Array.from({ length: 501 }, (_, index) => 400 + index * 0.2);
  const prepared = wavelengths.map((wavelength) => (
    gaussian(wavelength, 420, 0.6) + 0.8 * gaussian(wavelength, 450, 0.6) + 0.7 * gaussian(wavelength, 480, 0.6)
  ));
  const raw = prepared.map((value, index) => 2 + index * 0.0002 + 10 * value + 0.01 * Math.sin(index));
  const dataset = (intensities: readonly number[]): SpectrumDataset => ({ wavelengths, intensities });
  return {
    rawDataset: dataset(raw),
    preparedDataset: dataset(prepared),
    baselineDataset: dataset(raw.map((_, index) => 2 + index * 0.0002)),
    noiseDataset: dataset(raw.map(() => 0.005)),
    peaks: [peak(100, 420), peak(250, 450), peak(400, 480)],
    spectralResolutionNm: 0.6,
    calibration: {
      status: "not-applied" as const,
      enabled: true,
      shiftNm: 0,
      uncertaintyNm: 0.05,
      uncertaintyMethod: "user-stated" as const,
      method: "split-sample-robust-common-shift" as const,
      anchors: [],
      fitAnchorIds: [],
      validationAnchorIds: [],
      reason: "insufficient-anchors" as const,
    },
    calibrationWasStated: true,
  };
}

function peak(index: number, wavelength: number): DetectedPeak {
  return {
    id: `peak-${index}`, channelId: "channel", index, sourceIndex: index,
    sampledWavelength: wavelength, refinedWavelength: wavelength, wavelength,
    refinementOffsetNm: 0, localGridStepNm: 0.2, positionUncertaintyNm: 0.06,
    positionMethod: "quadratic-local-profile", positionRefined: true,
    rawIntensity: 12, intensity: 1, prominence: 0.8, snr: 25, widthNm: 0.6,
  };
}

function gaussian(x: number, center: number, fwhm: number): number {
  return Math.exp(-4 * Math.log(2) * Math.pow((x - center) / fwhm, 2));
}
