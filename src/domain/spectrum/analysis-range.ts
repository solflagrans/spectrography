import type { SegmentedSpectrumChannelInput } from "./channel-segmentation";
import type { SpectrumProcessingParameters } from "./types";

/** Restrict working copies while retaining source indices and channel identity. */
export function restrictAnalysisRange(channel: SegmentedSpectrumChannelInput, processing: SpectrumProcessingParameters): readonly SegmentedSpectrumChannelInput[] {
  const range = processing.analysisRange;
  if (!range) return [channel];
  const indices = channel.dataset.wavelengths.flatMap((wavelength, index) => wavelength >= range.minimum && wavelength <= range.maximum ? [index] : []);
  if (indices.length < 3) return [];
  const wavelengths = indices.map((index) => channel.dataset.wavelengths[index]);
  return [{ ...channel, dataset: { wavelengths, intensities: indices.map((index) => channel.dataset.intensities[index]) }, automaticSegment: {
    parentChannelId: channel.automaticSegment?.parentChannelId ?? channel.id,
    index: channel.automaticSegment?.index ?? 0,
    count: channel.automaticSegment?.count ?? 1,
    excludedPointCount: (channel.automaticSegment?.excludedPointCount ?? 0) + channel.dataset.wavelengths.length - indices.length,
    sourcePointIndices: indices.map((index) => channel.automaticSegment?.sourcePointIndices[index] ?? index),
    wavelengthRange: { minimum: Math.min(...wavelengths), maximum: Math.max(...wavelengths) },
  } }];
}
