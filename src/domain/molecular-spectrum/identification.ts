import { round } from "@/domain/spectrum/math";
import { IDENTIFICATION_QUALITY_PROFILE } from "@/domain/spectrum/quality-profile";
import type { ChannelPreparationResult } from "@/domain/spectrum/types";

import { renderMolecularReferenceProfile, shiftProfile } from "./profile";
import type {
  MolecularAnalysisInput,
  MolecularCharacteristicRegion,
  MolecularHypothesis,
  MolecularHypothesisReason,
  MolecularIdentificationResult,
  MolecularRegionObservation,
  MolecularSystemDefinition,
} from "./types";

interface RegionScore extends MolecularRegionObservation {
  readonly composite: number;
}

interface SystemFit {
  readonly shiftNm: number;
  readonly temperatureKelvin: number;
  readonly observations: readonly RegionScore[];
  readonly supportedCount: number;
  readonly composite: number;
}

export function identifyMolecularSystems({ channels, systems }: MolecularAnalysisInput): MolecularIdentificationResult {
  const usableChannels = channels.filter((channel) => channel.usable);
  const accepted: MolecularHypothesis[] = [];
  const rejected: MolecularHypothesis[] = [];
  for (const system of systems) {
    const fit = fitSystem(system, usableChannels, candidateShifts(usableChannels));
    const randomFits = randomOffsets().map((offset) => fitSystem(system, usableChannels, [offset]));
    const strongestRandom = Math.max(...randomFits.map((item) => item.composite), 0);
    const coveredRegions = system.characteristicRegions.filter((region) => usableChannels.some((channel) => covers(channel, region)));
    const supported = fit.observations.filter((observation) => observation.supported);
    const supportedIds = [...new Set(supported.map((observation) => observation.regionId))];
    const missingIds = coveredRegions.filter((region) => !supportedIds.includes(region.id)).map((region) => region.id);
    const supportedKeyCount = coveredRegions.filter((region) => region.key && supportedIds.includes(region.id)).length;
    const randomAgreement = {
      observedCompositeQuality: round(fit.composite, 6),
      strongestRandomCompositeQuality: round(strongestRandom, 6),
      testedOffsets: randomFits.length,
      distinguishableFromRandom: fit.composite >= strongestRandom + 0.06,
    };
    const reasons: MolecularHypothesisReason[] = [];
    if (coveredRegions.length < 2) reasons.push("insufficient-covered-regions");
    if (supportedIds.length < 2) reasons.push("single-region");
    if (fit.composite < 0.42) reasons.push("weak-profile-agreement");
    if (coveredRegions.some((region) => region.key) && !supportedKeyCount) reasons.push("missing-key-region");
    if (!randomAgreement.distinguishableFromRandom) reasons.push("random-like-profile");
    const hypothesis: MolecularHypothesis = {
      id: `molecular-${system.id}`,
      molecule: system.molecule,
      formula: system.formula,
      charge: system.charge,
      displayName: system.displayName,
      systemId: system.id,
      systemName: system.systemName,
      transition: system.transition,
      source: system.source,
      referencePreparation: system.preparation,
      observations: fit.observations,
      supportedRegionIds: supportedIds,
      missingExpectedRegionIds: missingIds,
      commonShiftNm: round(fit.shiftNm, 6),
      quality: round(fit.composite, 6),
      randomAgreement,
      accepted: reasons.length === 0,
      reasons,
      explanation: reasons.length === 0
        ? `${supportedIds.length} характерных участка полосы согласуются с формой спектра.`
        : supportedIds.length
          ? `${supportedIds.length} участок полосы согласуется, но независимых подтверждений недостаточно.`
          : "Надёжного согласования формы молекулярных полос не найдено.",
    };
    (hypothesis.accepted ? accepted : rejected).push(hypothesis);
  }
  accepted.sort((left, right) => right.supportedRegionIds.length - left.supportedRegionIds.length || right.quality - left.quality || left.id.localeCompare(right.id));
  rejected.sort((left, right) => right.supportedRegionIds.length - left.supportedRegionIds.length || right.quality - left.quality || left.id.localeCompare(right.id));
  return { hypotheses: accepted, rejectedHypotheses: rejected };
}

function fitSystem(
  system: MolecularSystemDefinition,
  channels: readonly ChannelPreparationResult[],
  shifts: readonly number[],
): SystemFit {
  let best: SystemFit = { shiftNm: 0, temperatureKelvin: system.preparation.rotationalTemperatureGridKelvin[0], observations: [], supportedCount: 0, composite: 0 };
  for (const temperatureKelvin of system.preparation.rotationalTemperatureGridKelvin) {
    const baseProfiles = new Map<string, readonly number[]>();
    for (const channel of channels) {
      for (const region of system.characteristicRegions.filter((item) => covers(channel, item))) {
        baseProfiles.set(`${channel.id}:${region.id}`, renderMolecularReferenceProfile(
          region,
          channel.preparedDataset.wavelengths,
          channel.spectralResolutionNm,
          temperatureKelvin,
        ));
      }
    }
    for (const shiftNm of shifts) {
      const observations = channels.flatMap((channel) => system.characteristicRegions.flatMap((region) => {
        if (!covers(channel, region)) return [];
        const profile = shiftProfile(channel.preparedDataset.wavelengths, baseProfiles.get(`${channel.id}:${region.id}`)!, shiftNm);
        return [scoreRegion(channel, region, profile, shiftNm, temperatureKelvin)];
      }));
      const supportedCount = new Set(observations.filter((item) => item.supported).map((item) => item.regionId)).size;
      const composite = average([...bestObservationPerRegion(observations)]
        .sort((left, right) => right.composite - left.composite)
        .slice(0, 2)
        .map((item) => item.composite));
      const candidate = { shiftNm, temperatureKelvin, observations, supportedCount, composite };
      if (compareFits(candidate, best) < 0) best = candidate;
    }
  }
  return best;
}

function scoreRegion(
  channel: ChannelPreparationResult,
  region: MolecularCharacteristicRegion,
  profile: readonly number[],
  shiftNm: number,
  temperatureKelvin: number,
): RegionScore {
  const padding = Math.max(channel.spectralResolutionNm * 1.5, 0.25);
  const wavelengths = channel.preparedDataset.wavelengths;
  const start = lowerBound(wavelengths, region.minimumWavelengthNm + shiftNm - padding);
  const end = upperBound(wavelengths, region.maximumWavelengthNm + shiftNm + padding);
  const indices = Array.from({ length: Math.max(0, end - start) }, (_, offset) => start + offset);
  const rawObserved = indices.map((index) => channel.preparedDataset.intensities[index]);
  const baseline = percentile(rawObserved, 0.2);
  const observed = rawObserved.map((value) => Math.max(0, value - baseline));
  const reference = indices.map((index) => profile[index]);
  const shapeCorrelation = Math.max(0, pearson(observed, reference));
  const scale = nonnegativeScale(observed, reference);
  const fitted = reference.map((value) => value * scale);
  const observedRms = rootMeanSquare(observed);
  const residualRms = rootMeanSquare(observed.map((value, index) => value - fitted[index]));
  const fitQuality = observedRms > 0 ? clamp(1 - residualRms / observedRms) : 0;
  const localNoise = median(indices.map((index) => channel.noiseDataset.intensities[index]).filter((value) => value > 0));
  const contrastSnr = localNoise > 0 ? scale / localNoise : scale > 0 ? Number.POSITIVE_INFINITY : 0;
  const channelMaximum = Math.max(channel.preparedStats.maximum, 0);
  const relativeContrast = channelMaximum > 0 ? scale / channelMaximum : 0;
  const snrQuality = Number.isFinite(contrastSnr) ? contrastSnr / (contrastSnr + 5) : 1;
  const quality = 0.55 * shapeCorrelation + 0.25 * fitQuality + 0.2 * snrQuality;
  const supported = indices.length >= 8
    && shapeCorrelation >= 0.45
    && fitQuality >= 0.2
    && contrastSnr >= 4
    && relativeContrast >= IDENTIFICATION_QUALITY_PROFILE.molecular.minimumRelativeContrast
    && quality >= 0.42;
  const overlappingAtomicPeakIds = channel.peaks.filter((peak) => (
    peak.wavelength >= region.minimumWavelengthNm + shiftNm - channel.spectralResolutionNm
      && peak.wavelength <= region.maximumWavelengthNm + shiftNm + channel.spectralResolutionNm
  )).map((peak) => peak.id);
  return {
    regionId: region.id,
    channelId: channel.id,
    observedRange: {
      minimum: round(region.minimumWavelengthNm + shiftNm, 6),
      maximum: round(region.maximumWavelengthNm + shiftNm, 6),
    },
    commonShiftNm: round(shiftNm, 6),
    temperatureVariantKelvin: temperatureKelvin,
    shapeCorrelation: round(shapeCorrelation, 6),
    fitQuality: round(fitQuality, 6),
    contrastSnr: Number.isFinite(contrastSnr) ? round(contrastSnr, 6) : Number.POSITIVE_INFINITY,
    relativeContrast: round(relativeContrast, 6),
    quality: round(quality, 6),
    composite: quality,
    supported,
    overlappingAtomicPeakIds,
  };
}

function candidateShifts(channels: readonly ChannelPreparationResult[]): readonly number[] {
  const resolution = Math.max(...channels.map((channel) => channel.spectralResolutionNm), 0.2);
  const maximum = Math.min(0.5, Math.max(0.2, resolution * 0.75));
  const step = Math.min(0.1, Math.max(0.025, maximum / 5));
  const values: number[] = [];
  for (let value = -maximum; value <= maximum + step / 2; value += step) values.push(round(value, 6));
  return values;
}

function randomOffsets(): readonly number[] {
  return [-18, -12, -8, 8, 12, 18];
}

function covers(channel: ChannelPreparationResult, region: MolecularCharacteristicRegion): boolean {
  return channel.wavelengthRange.minimum <= region.minimumWavelengthNm
    && channel.wavelengthRange.maximum >= region.maximumWavelengthNm;
}

function bestObservationPerRegion(observations: readonly RegionScore[]): readonly RegionScore[] {
  const best = new Map<string, RegionScore>();
  for (const observation of observations) {
    const current = best.get(observation.regionId);
    if (!current || observation.composite > current.composite) best.set(observation.regionId, observation);
  }
  return [...best.values()];
}

function compareFits(left: SystemFit, right: SystemFit): number {
  return right.supportedCount - left.supportedCount
    || right.composite - left.composite
    || Math.abs(left.shiftNm) - Math.abs(right.shiftNm)
    || left.temperatureKelvin - right.temperatureKelvin;
}

function pearson(left: readonly number[], right: readonly number[]): number {
  if (!left.length || left.length !== right.length) return 0;
  const leftMean = average(left);
  const rightMean = average(right);
  let numerator = 0;
  let leftSum = 0;
  let rightSum = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] - leftMean;
    const b = right[index] - rightMean;
    numerator += a * b;
    leftSum += a * a;
    rightSum += b * b;
  }
  return leftSum > 0 && rightSum > 0 ? numerator / Math.sqrt(leftSum * rightSum) : 0;
}

function nonnegativeScale(observed: readonly number[], reference: readonly number[]): number {
  const denominator = reference.reduce((sum, value) => sum + value * value, 0);
  if (!denominator) return 0;
  return Math.max(0, observed.reduce((sum, value, index) => sum + value * reference[index], 0) / denominator);
}

function percentile(values: readonly number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function rootMeanSquare(values: readonly number[]): number {
  return values.length ? Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length) : 0;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lowerBound(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function upperBound(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}
