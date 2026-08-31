import type { SpectralLine } from "@/domain/spectral-library/types";

import { round } from "./math";
import type { AnalyzedPeak } from "./types";

export interface SpectralLineGroup {
  readonly id: string;
  readonly atomicNumber: number;
  readonly elementSymbol: string;
  readonly elementName: string;
  readonly ionizationStage: number;
  readonly ionizationLabel: string;
  readonly minimumWavelength: number;
  readonly maximumWavelength: number;
  readonly representativeLine: SpectralLine;
  readonly lines: readonly SpectralLine[];
}

/**
 * Estimates the effective resolving width from measured FWHM values. The
 * sampling-grid floor prevents reporting a resolution finer than the channel
 * can represent. This value is an instrument-data heuristic, not a calibrated
 * specification of the spectrometer.
 */
export function estimateChannelResolutionNm(
  wavelengths: readonly number[],
  peaks: readonly Pick<AnalyzedPeak, "widthNm">[],
): number {
  const steps = wavelengths.slice(1)
    .map((value, index) => Math.abs(value - wavelengths[index]))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  const samplingFloor = (median(steps) || Number.EPSILON) * 2.5;
  const widths = peaks.map((peak) => peak.widthNm)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  const measured = median(widths);
  return round(Math.max(samplingFloor, measured || samplingFloor), 6);
}

/** Groups adjacent lines of the same element and ion stage when the channel cannot resolve their gap. */
export function groupSpectralLines(
  lines: readonly SpectralLine[],
  resolutionNm: number,
): readonly SpectralLineGroup[] {
  const byElementIon = new Map<string, SpectralLine[]>();
  for (const line of lines) {
    const key = `${line.element.atomicNumber}:${line.ionizationStage}`;
    byElementIon.set(key, [...(byElementIon.get(key) ?? []), line]);
  }

  const result: SpectralLineGroup[] = [];
  for (const items of byElementIon.values()) {
    const ordered = [...items].sort((left, right) => (
      left.preferredWavelength.valueNm - right.preferredWavelength.valueNm
        || left.id.localeCompare(right.id)
    ));
    let current: SpectralLine[] = [];
    for (const line of ordered) {
      const first = current[0];
      if (first && line.preferredWavelength.valueNm - first.preferredWavelength.valueNm > resolutionNm) {
        result.push(createGroup(current));
        current = [];
      }
      current.push(line);
    }
    if (current.length) result.push(createGroup(current));
  }
  return result.sort((left, right) => (
    left.atomicNumber - right.atomicNumber
      || left.ionizationStage - right.ionizationStage
      || left.minimumWavelength - right.minimumWavelength
      || left.id.localeCompare(right.id)
  ));
}

function createGroup(lines: readonly SpectralLine[]): SpectralLineGroup {
  const representativeLine = [...lines].sort((left, right) => (
    (right.relativeIntensity?.numericValue ?? Number.NEGATIVE_INFINITY)
      - (left.relativeIntensity?.numericValue ?? Number.NEGATIVE_INFINITY)
      || left.preferredWavelength.valueNm - right.preferredWavelength.valueNm
      || left.id.localeCompare(right.id)
  ))[0];
  const first = lines[0];
  const last = lines.at(-1)!;
  return {
    id: `spectral-group-${first.element.atomicNumber}-${first.ionizationStage}-${first.id}-${last.id}`,
    atomicNumber: first.element.atomicNumber,
    elementSymbol: first.element.symbol,
    elementName: first.element.name,
    ionizationStage: first.ionizationStage,
    ionizationLabel: first.ionizationLabel,
    minimumWavelength: first.preferredWavelength.valueNm,
    maximumWavelength: last.preferredWavelength.valueNm,
    representativeLine,
    lines: [...lines],
  };
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
}
