import { round } from "./math";
import type { SpectrumChannelInput } from "./types";

export interface SegmentedSpectrumChannelInput extends SpectrumChannelInput {
  readonly automaticSegment?: {
    readonly parentChannelId: string;
    readonly index: number;
    readonly count: number;
    readonly excludedPointCount: number;
    /** Original channel point indices, aligned with the derived dataset. */
    readonly sourcePointIndices: readonly number[];
    readonly wavelengthRange: { readonly minimum: number; readonly maximum: number };
  };
}

/**
 * Separates physically discontinuous detector ranges and long masked runs.
 * This operates on a working copy only; the imported source dataset is not
 * changed. Long repeated minima are treated as missing detector data, not as
 * measured zero intensity.
 */
export function segmentSpectrumChannel(
  channel: SpectrumChannelInput,
): readonly SegmentedSpectrumChannelInput[] {
  const { wavelengths, intensities } = channel.dataset;
  if (wavelengths.length < 6) return [channel];
  const samples = wavelengths.map((wavelength, sourceIndex) => ({
    wavelength,
    intensity: intensities[sourceIndex],
    sourceIndex,
  })).sort((left, right) => left.wavelength - right.wavelength || left.sourceIndex - right.sourceIndex);
  const minimumIntensity = Math.min(...intensities);
  const maximumIntensity = Math.max(...intensities);
  const minimumMaskedRunLength = Math.max(3, Math.ceil(samples.length * 0.005));
  const masked = new Set<number>();

  if (maximumIntensity > minimumIntensity) {
    for (let start = 0; start < samples.length;) {
      let end = start + 1;
      while (end < samples.length && samples[end].intensity === samples[start].intensity) end += 1;
      if (
        end - start >= minimumMaskedRunLength
        && samples[start].intensity === minimumIntensity
      ) {
        for (let index = start; index < end; index += 1) masked.add(index);
      }
      start = end;
    }
  }

  const ordinarySteps = samples.slice(1).map((sample, index) => sample.wavelength - samples[index].wavelength)
    .filter((step) => Number.isFinite(step) && step > 0)
    .sort((left, right) => left - right);
  const typicalStep = median(ordinarySteps) || Number.EPSILON;
  const gapThreshold = Math.max(typicalStep * 8, 1);
  const segments: typeof samples[] = [];
  let current: typeof samples = [];
  let previousSortedIndex = -1;

  for (let sortedIndex = 0; sortedIndex < samples.length; sortedIndex += 1) {
    if (masked.has(sortedIndex)) {
      if (current.length) segments.push(current);
      current = [];
      previousSortedIndex = -1;
      continue;
    }
    const sample = samples[sortedIndex];
    const previous = previousSortedIndex >= 0 ? samples[previousSortedIndex] : undefined;
    if (previous && sample.wavelength - previous.wavelength > gapThreshold) {
      if (current.length) segments.push(current);
      current = [];
    }
    current.push(sample);
    previousSortedIndex = sortedIndex;
  }
  if (current.length) segments.push(current);

  const usable = segments.filter((segment) => segment.length >= 5);
  if (usable.length === 1 && masked.size === 0 && usable[0].length === samples.length) return [channel];
  if (!usable.length) return [channel];

  return usable.map((segment, index) => {
    const orderedBySource = [...segment].sort((left, right) => left.sourceIndex - right.sourceIndex);
    const minimum = segment[0].wavelength;
    const maximum = segment.at(-1)!.wavelength;
    const suffix = usable.length > 1 ? `-segment-${index + 1}` : "";
    return {
      ...channel,
      id: `${channel.id}${suffix}`,
      name: usable.length > 1
        ? `${channel.name} · ${round(minimum, 2)}–${round(maximum, 2)} нм`
        : channel.name,
      dataset: {
        wavelengths: orderedBySource.map((sample) => sample.wavelength),
        intensities: orderedBySource.map((sample) => sample.intensity),
      },
      automaticSegment: {
        parentChannelId: channel.id,
        index,
        count: usable.length,
        excludedPointCount: samples.length - usable.reduce((sum, item) => sum + item.length, 0),
        sourcePointIndices: orderedBySource.map((sample) => sample.sourceIndex),
        wavelengthRange: { minimum, maximum },
      },
    };
  });
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}
