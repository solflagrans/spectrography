import { round } from "./math";
import { IDENTIFICATION_QUALITY_PROFILE } from "./quality-profile";
import type {
  MatchedPeak,
  SpectrumDataset,
  WavelengthCalibrationAnchor,
  WavelengthCalibrationParameters,
  WavelengthCalibrationReason,
  WavelengthCalibrationResult,
} from "./types";

export function estimateInitialCalibrationUncertaintyNm(
  wavelengths: readonly number[],
  spectralResolutionNm: number,
  parameters: WavelengthCalibrationParameters,
): number {
  if (parameters.statedUncertaintyNm !== undefined) return parameters.statedUncertaintyNm;
  const gridStep = median(wavelengths.slice(1).map((value, index) => Math.abs(value - wavelengths[index])).filter((value) => value > 0));
  return round(Math.max(
    gridStep,
    spectralResolutionNm * IDENTIFICATION_QUALITY_PROFILE.adaptiveTolerance.uncalibratedResolutionFraction,
  ), 8);
}

export function estimateWavelengthCalibration(
  peaks: readonly MatchedPeak[],
  wavelengthRange: { readonly minimum: number; readonly maximum: number },
  spectralResolutionNm: number,
  initialUncertaintyNm: number,
  minimumProminence: number,
  parameters: WavelengthCalibrationParameters,
): WavelengthCalibrationResult {
  const profile = IDENTIFICATION_QUALITY_PROFILE.calibration;
  const candidates = peaks.filter((peak) => (
    peak.positionRefined
    && peak.snr >= profile.minimumAnchorSnr
    && peak.prominence >= profile.minimumAnchorProminenceFactor * minimumProminence
  )).flatMap((peak) => {
    const unambiguous = peak.candidates.filter((candidate) => (
      candidate.normalizedDelta <= profile.maximumNormalizedAnchorDelta
      && !candidate.toleranceCapped
    ));
    return unambiguous.length === 1 ? [{ peak, candidate: unambiguous[0] }] : [];
  }).sort((left, right) => left.peak.wavelength - right.peak.wavelength || left.peak.id.localeCompare(right.peak.id));

  const partitioned = candidates.map((item, index) => ({ ...item, role: index % 2 === 0 ? "fit" as const : "validation" as const }));
  const anchors = partitioned.map(({ peak, candidate, role }): WavelengthCalibrationAnchor => ({
    peakId: peak.id,
    lineId: candidate.lineId,
    observedWavelengthNm: peak.refinedWavelength,
    referenceWavelengthNm: candidate.line,
    deltaNm: round(peak.refinedWavelength - candidate.line, 8),
    role,
    adaptiveToleranceNm: candidate.adaptiveToleranceNm,
  }));
  const fit = anchors.filter((anchor) => anchor.role === "fit");
  const validation = anchors.filter((anchor) => anchor.role === "validation");
  const disabled = !parameters.allowAutomaticCorrection;
  if (disabled) return notApplied("disabled", anchors, initialUncertaintyNm, parameters);
  if (
    anchors.length < profile.minimumAnchorCount
    || fit.length < profile.minimumAnchorsPerPartition
    || validation.length < profile.minimumAnchorsPerPartition
  ) return notApplied("insufficient-anchors", anchors, initialUncertaintyNm, parameters);

  const fullSpan = wavelengthRange.maximum - wavelengthRange.minimum;
  if (span(fit) < fullSpan * profile.minimumRangeSpanFraction || span(validation) < fullSpan * profile.minimumRangeSpanFraction) {
    return notApplied("insufficient-span", anchors, initialUncertaintyNm, parameters);
  }

  const shiftNm = median(fit.map((anchor) => anchor.deltaNm));
  const maximumShift = Math.min(
    profile.maximumAbsoluteShiftNm,
    spectralResolutionNm * profile.maximumShiftResolutionFraction,
  );
  if (Math.abs(shiftNm) > maximumShift) return notApplied("shift-too-large", anchors, initialUncertaintyNm, parameters);

  const before = median(validation.map((anchor) => Math.abs(anchor.deltaNm)));
  const after = median(validation.map((anchor) => Math.abs(anchor.deltaNm - shiftNm)));
  const normalizedAfter = median(validation.map((anchor) => Math.abs(anchor.deltaNm - shiftNm) / anchor.adaptiveToleranceNm));
  if (!(after <= before * (1 - profile.requiredValidationImprovementFraction))) {
    return notApplied("validation-not-improved", anchors, initialUncertaintyNm, parameters);
  }
  if (normalizedAfter > profile.maximumValidationNormalizedResidual) {
    return notApplied("validation-residual-too-large", anchors, initialUncertaintyNm, parameters);
  }

  const validationResiduals = validation.map((anchor) => anchor.deltaNm - shiftNm);
  const residualUncertainty = 1.4826 * medianAbsoluteDeviation(validationResiduals);
  const uncertaintyNm = Math.max(
    parameters.statedUncertaintyNm ?? 0,
    residualUncertainty,
    Math.min(...validation.map((anchor) => anchor.adaptiveToleranceNm)) / IDENTIFICATION_QUALITY_PROFILE.adaptiveTolerance.coverageFactor,
  );
  return {
    status: "applied",
    enabled: true,
    shiftNm: round(shiftNm, 8),
    uncertaintyNm: round(uncertaintyNm, 8),
    uncertaintyMethod: parameters.statedUncertaintyNm !== undefined ? "user-stated" : "validated-residual",
    method: "split-sample-robust-common-shift",
    anchors,
    fitAnchorIds: fit.map((anchor) => anchor.peakId),
    validationAnchorIds: validation.map((anchor) => anchor.peakId),
    reason: "applied",
  };
}

export function applyWavelengthCalibrationToDataset(
  dataset: SpectrumDataset,
  calibration: WavelengthCalibrationResult,
): SpectrumDataset {
  if (calibration.status !== "applied") return { wavelengths: [...dataset.wavelengths], intensities: [...dataset.intensities] };
  return {
    wavelengths: dataset.wavelengths.map((wavelength) => round(wavelength - calibration.shiftNm, 8)),
    intensities: [...dataset.intensities],
  };
}

function notApplied(
  reason: Exclude<WavelengthCalibrationReason, "applied">,
  anchors: readonly WavelengthCalibrationAnchor[],
  uncertaintyNm: number,
  parameters: WavelengthCalibrationParameters,
): WavelengthCalibrationResult {
  return {
    status: "not-applied",
    enabled: parameters.allowAutomaticCorrection,
    shiftNm: 0,
    uncertaintyNm: round(uncertaintyNm, 8),
    uncertaintyMethod: parameters.statedUncertaintyNm !== undefined ? "user-stated" : "resolution-and-grid-floor",
    method: "split-sample-robust-common-shift",
    anchors,
    fitAnchorIds: anchors.filter((anchor) => anchor.role === "fit").map((anchor) => anchor.peakId),
    validationAnchorIds: anchors.filter((anchor) => anchor.role === "validation").map((anchor) => anchor.peakId),
    reason,
  };
}

function span(anchors: readonly WavelengthCalibrationAnchor[]): number {
  return anchors.length ? Math.max(...anchors.map((anchor) => anchor.observedWavelengthNm)) - Math.min(...anchors.map((anchor) => anchor.observedWavelengthNm)) : 0;
}

function medianAbsoluteDeviation(values: readonly number[]): number {
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center)));
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
