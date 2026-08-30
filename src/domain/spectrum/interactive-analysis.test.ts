import { describe, expect, it } from "vitest";

import { builtinSpectralLibraryIndex } from "@/domain/spectral-library/builtin-library";
import { demoSpectra } from "@/fixtures/demo-spectra";

import { estimateLocalNoise } from "./local-noise";
import { detectInteractivePeaks } from "./peak-detection";
import { estimateRobustBaseline } from "./robust-baseline";
import {
  DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  prepareSpectrum,
  runInteractiveSpectrumAnalysis,
  savitzkyGolaySmooth,
} from "./interactive-analysis";

describe("robust spectrum preparation", () => {
  it("keeps a constant signal unchanged after Savitzky–Golay smoothing", () => {
    for (const value of savitzkyGolaySmooth([4, 4, 4, 4, 4, 4, 4], 5)) expect(value).toBeCloseTo(4, 12);
  });

  it("estimates a baseline curve without following a strong narrow peak on an uneven grid", () => {
    const wavelengths = [400, 400.3, 400.9, 401.8, 403, 404.6, 406.5, 409];
    const expected = wavelengths.map((value) => 2 + 0.04 * (value - 400));
    const signal = expected.map((value, index) => value + (index === 4 ? 8 : 0));
    const baseline = estimateRobustBaseline(wavelengths, signal, { smoothness: 10_000, asymmetry: 0.01, iterations: 12 });

    expect(baseline).toHaveLength(signal.length);
    expect(baseline[4]).toBeLessThan(3);
    expect(Math.max(...baseline.map((value, index) => Math.abs(value - expected[index])))).toBeLessThan(0.35);
  });

  it("returns zero local noise for a constant residual and resists sparse positive peaks at edges", () => {
    expect(estimateLocalNoise([1, 2, 4], [0, 0, 0], 2, 4)).toEqual([0, 0, 0]);
    const noise = estimateLocalNoise([0, 0.2, 0.7, 1.8, 3, 5], [-1, 1, -1, 25, 1, -1], 5, 3);
    expect(noise.every(Number.isFinite)).toBe(true);
    expect(Math.max(...noise)).toBeLessThan(3);
  });

  it("prepares separate baseline, noise and signal curves without mutating the source", () => {
    const sourceMaximum = Math.max(...demoSpectra.fe12.intensities);
    const result = prepareSpectrum(demoSpectra.fe12, DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing);
    expect(result.dataset).not.toBe(demoSpectra.fe12);
    expect(result.baselineDataset.intensities).toHaveLength(demoSpectra.fe12.intensities.length);
    expect(result.noiseDataset.intensities).toHaveLength(demoSpectra.fe12.intensities.length);
    expect(Math.max(...result.dataset.intensities)).toBeCloseTo(1, 6);
    expect(Math.max(...demoSpectra.fe12.intensities)).toBe(sourceMaximum);
  });
});

describe("SNR-aware peak detection", () => {
  it("filters peaks by SNR, physical width and local prominence", () => {
    const wavelengths = [0, 0.4, 1, 1.8, 2.7, 3.9, 5.2, 6.8, 8.5];
    const intensities = [0, 0.1, 0.6, 1, 0.55, 0.05, 0.08, 0.2, 0.02];
    const result = detectInteractivePeaks({
      channelId: "c1",
      preparedDataset: { wavelengths, intensities },
      rawDataset: { wavelengths, intensities: intensities.map((value) => value * 100) },
      noiseDataset: { wavelengths, intensities: new Array(wavelengths.length).fill(0.05) },
      sourceIndices: wavelengths.map((_, index) => index),
    }, { minimumSnr: 5, prominence: 0.2, minimumWidth: 0.5, maximumWidth: 4, minimumDistance: 0.5, tolerance: 0.2 });
    expect(result.peaks).toHaveLength(1);
    expect(result.peaks[0]).toMatchObject({ channelId: "c1", sourceIndex: 3, rawIntensity: 100 });
    expect(result.peaks[0].snr).toBe(20);
    expect(result.peaks[0].widthNm).toBeGreaterThan(0.5);
  });

  it("does not create peaks from signal that never exceeds its local noise threshold", () => {
    const wavelengths = [1, 2, 3, 4, 5];
    const intensities = [0.09, 0.1, 0.09, 0.1, 0.09];
    const result = detectInteractivePeaks({
      channelId: "noise",
      preparedDataset: { wavelengths, intensities },
      rawDataset: { wavelengths, intensities },
      noiseDataset: { wavelengths, intensities: [0.05, 0.05, 0.05, 0.05, 0.05] },
      sourceIndices: [0, 1, 2, 3, 4],
    }, { minimumSnr: 3, prominence: 0, minimumWidth: 0, maximumWidth: 10, minimumDistance: 0.1, tolerance: 0.2 });
    expect(result.peaks).toHaveLength(0);
  });

  it("represents a positive peak over exactly zero noise with infinite SNR", () => {
    const wavelengths = [1, 2, 3];
    const result = detectInteractivePeaks({
      channelId: "zero-noise",
      preparedDataset: { wavelengths, intensities: [0, 1, 0] },
      rawDataset: { wavelengths, intensities: [0, 10, 0] },
      noiseDataset: { wavelengths, intensities: [0, 0, 0] },
      sourceIndices: [0, 1, 2],
    }, { minimumSnr: 5, prominence: 0.1, minimumWidth: 0, maximumWidth: 10, minimumDistance: 0.1, tolerance: 0.2 });
    expect(result.peaks).toHaveLength(1);
    expect(result.peaks[0].snr).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("interactive analysis compatibility", () => {
  it("keeps stable source-point peak identifiers across recalculation", () => {
    const source = { wavelengths: [502, 500, 501, 503, 504], intensities: [0, 0, 10, 0, 0] };
    const parameters = {
      processing: { ...DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing, smoothingWindow: 1, baselineSmoothness: 100, noiseWindowNm: 0.4, normalization: "none" as const },
      peakSearch: { ...DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch, minimumSnr: 0, prominence: 1, minimumWidth: 0, maximumWidth: 4, minimumDistance: 0.1, tolerance: 0.2 },
    };
    const first = runInteractiveSpectrumAnalysis(source, builtinSpectralLibraryIndex, parameters);
    const second = runInteractiveSpectrumAnalysis(source, builtinSpectralLibraryIndex, { ...parameters, peakSearch: { ...parameters.peakSearch, tolerance: 0.4 } });
    expect(first.peaks).toHaveLength(1);
    expect(first.peaks[0]).toMatchObject({ id: "peak-channel-1-point-3", sourceIndex: 2, wavelength: 501 });
    expect(second.peaks[0].id).toBe(first.peaks[0].id);
  });

  it("returns the unified channel model for the legacy single-dataset call", () => {
    const result = runInteractiveSpectrumAnalysis(demoSpectra.fe12, builtinSpectralLibraryIndex);
    expect(result.channels).toHaveLength(1);
    expect(result.channels[0].id).toBe("channel-1");
    expect(result.preparedDataset).toBe(result.channels[0].preparedDataset);
    expect(result.thresholdDataset.intensities).toHaveLength(result.preparedDataset.intensities.length);
  });

  it("is deterministic", () => {
    const first = runInteractiveSpectrumAnalysis(demoSpectra.fe12, builtinSpectralLibraryIndex);
    const second = runInteractiveSpectrumAnalysis(demoSpectra.fe12, builtinSpectralLibraryIndex);
    expect(second).toEqual(first);
  });

  it("rejects an even smoothing window with a user-facing message", () => {
    expect(() => runInteractiveSpectrumAnalysis(demoSpectra.fe12, builtinSpectralLibraryIndex, {
      ...DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
      processing: { ...DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing, smoothingWindow: 10 },
    })).toThrow("Выберите нечётный размер окна сглаживания от 1 до 51.");
  });
});
