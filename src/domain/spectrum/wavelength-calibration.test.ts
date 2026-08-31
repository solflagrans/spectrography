import { describe, expect, it } from "vitest";

import type { MatchedPeak, SpectralLineCandidate } from "./types";
import {
  applyWavelengthCalibrationToDataset,
  estimateWavelengthCalibration,
} from "./wavelength-calibration";

describe("validated common wavelength-scale correction", () => {
  it("applies a common shift only after an independent validation partition improves", () => {
    const peaks = [400, 450, 500, 550, 600, 650].map((reference, index) => peak(index, reference, 0.2));
    const result = estimateWavelengthCalibration(
      peaks,
      { minimum: 400, maximum: 650 },
      0.6,
      0.12,
      0.03,
      { allowAutomaticCorrection: true },
    );

    expect(result.status).toBe("applied");
    expect(result.shiftNm).toBeCloseTo(0.2, 6);
    expect(result.fitAnchorIds).toHaveLength(3);
    expect(result.validationAnchorIds).toHaveLength(3);
    expect(result.fitAnchorIds.filter((id) => result.validationAnchorIds.includes(id))).toHaveLength(0);

    const original = { wavelengths: [400.2, 500.2], intensities: [1, 2] };
    const corrected = applyWavelengthCalibrationToDataset(original, result);
    expect(corrected.wavelengths).toEqual([400, 500]);
    expect(original.wavelengths).toEqual([400.2, 500.2]);
  });

  it("rejects a shift that does not improve the independent anchors", () => {
    const peaks = [400, 450, 500, 550, 600, 650].map((reference, index) => peak(index, reference, index % 2 === 0 ? 0.2 : -0.2));
    const result = estimateWavelengthCalibration(
      peaks,
      { minimum: 400, maximum: 650 },
      0.6,
      0.12,
      0.03,
      { allowAutomaticCorrection: true },
    );

    expect(result.status).toBe("not-applied");
    expect(result.reason).toBe("validation-not-improved");
    expect(result.shiftNm).toBe(0);
  });

  it("does not calibrate from fewer than four unambiguous strong anchors", () => {
    const result = estimateWavelengthCalibration(
      [peak(0, 400, 0.15), peak(1, 600, 0.15)],
      { minimum: 400, maximum: 650 },
      0.6,
      0.12,
      0.03,
      { allowAutomaticCorrection: true },
    );
    expect(result).toMatchObject({ status: "not-applied", reason: "insufficient-anchors", shiftNm: 0 });
  });
});

function peak(index: number, reference: number, shift: number): MatchedPeak {
  const observed = reference + shift;
  const candidate: SpectralLineCandidate = {
    lineId: `line-${index}`,
    atomicNumber: 1,
    elementSymbol: "X",
    elementName: "X",
    ionizationStage: 1,
    ionizationLabel: "I",
    line: reference,
    wavelengthType: "observed",
    wavelengthMedium: "air",
    delta: shift,
    adaptiveToleranceNm: 0.5,
    combinedUncertaintyNm: 0.2,
    normalizedDelta: Math.abs(shift) / 0.5,
    toleranceCapped: false,
    uncertainty: { gridSamplingNm: 0.03, spectralResolutionNm: 0.03, peakWidthNm: 0.01, peakPositionNm: 0.03, referenceLineNm: 0, calibrationNm: 0.12 },
  };
  return {
    id: `peak-${index}`,
    channelId: "channel",
    index,
    sourceIndex: index,
    sampledWavelength: observed,
    refinedWavelength: observed,
    wavelength: observed,
    refinementOffsetNm: 0.02,
    localGridStepNm: 0.1,
    positionUncertaintyNm: 0.03,
    positionMethod: "quadratic-local-profile",
    positionRefined: true,
    rawIntensity: 100,
    intensity: 1,
    prominence: 0.8,
    snr: 30,
    widthNm: 0.6,
    candidates: [candidate],
    match: candidate,
  };
}
