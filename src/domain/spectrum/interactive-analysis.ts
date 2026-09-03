import type { SpectralLine } from "@/domain/spectral-library/types";
import { createSpectralLibraryWavelengthIndex, type SpectralLibraryWavelengthIndex } from "@/domain/spectral-library/wavelength-index";
import { identifyMolecularSystems } from "@/domain/molecular-spectrum/identification";
import type { MolecularSystemDefinition } from "@/domain/molecular-spectrum/types";

import { segmentSpectrumChannel } from "./channel-segmentation";
import { validateDataset } from "./dataset";
import { buildElementHypotheses } from "./identification";
import { matchPeaks } from "./matching";
import { assessChannelSuitability, combineSuitability } from "./measurement-quality";
import { detectInteractivePeaks, validatePeakSearchParameters } from "./peak-detection";
import { prepareSpectrum, validateProcessingParameters } from "./preparation";
import { IDENTIFICATION_QUALITY_PROFILE } from "./quality-profile";
import { estimateChannelResolutionNm } from "./spectral-groups";
import {
  applyWavelengthCalibrationToDataset,
  estimateInitialCalibrationUncertaintyNm,
  estimateWavelengthCalibration,
} from "./wavelength-calibration";
import { DEFAULT_SPECTRUM_TYPE } from "./types";
import type {
  AnalyzedPeak,
  InteractiveAnalysisParameters,
  InteractiveSpectrumAnalysis,
  MultiChannelSpectrumInput,
  SpectrumChannelInput,
  SpectrumDataset,
  SpectrumType,
} from "./types";

export const DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS: InteractiveAnalysisParameters = {
  processing: {
    smoothingWindow: 5,
    baselineSmoothness: 100_000,
    baselineAsymmetry: 0.01,
    baselineIterations: 10,
    noiseWindowNm: 3,
    noiseClippingSnr: 4,
    normalization: "maximum",
  },
  peakSearch: {
    minimumSnr: 5,
    prominence: 0.03,
    minimumWidth: 0.02,
    maximumWidth: 8,
    minimumDistance: 0.3,
  },
  wavelengthCalibration: {
    allowAutomaticCorrection: true,
  },
};

export function runInteractiveSpectrumAnalysis(
  input: SpectrumDataset | MultiChannelSpectrumInput,
  library: readonly SpectralLine[] | SpectralLibraryWavelengthIndex,
  parameters: InteractiveAnalysisParameters = DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  spectrumType: SpectrumType = DEFAULT_SPECTRUM_TYPE,
  molecularSystems: readonly MolecularSystemDefinition[] = [],
): InteractiveSpectrumAnalysis {
  validateInteractiveAnalysisParameters(parameters);
  const sourceChannelInputs = isMultiChannelInput(input)
    ? input.channels
    : [{ id: "channel-1", name: "Канал 1", dataset: input }];
  validateChannels(sourceChannelInputs);
  sourceChannelInputs.forEach((channel) => validateDataset(channel.dataset));
  const channelInputs = sourceChannelInputs.flatMap(segmentSpectrumChannel);
  validateChannels(channelInputs);
  const libraryIndex = Array.isArray(library)
    ? createSpectralLibraryWavelengthIndex(library)
    : library as SpectralLibraryWavelengthIndex;
  const channels = channelInputs.map((channel) => {
    const channelParameters = channel.parameters ?? parameters;
    validateInteractiveAnalysisParameters(channelParameters);
    const rawDataset = copyDataset(channel.dataset);
    let effectiveSmoothingWindow = channelParameters.processing.smoothingWindow;
    let effectiveMinimumDistanceNm = channelParameters.peakSearch.minimumDistance;
    let prepared = prepareSpectrum(rawDataset, channelParameters.processing);
    const peakDetectionInput = (preparedResult: typeof prepared) => ({
      channelId: channel.id,
      preparedDataset: preparedResult.dataset,
      rawDataset,
      noiseDataset: preparedResult.noiseDataset,
      sourceIndices: preparedResult.sourceIndices.map((index) => (
        channel.automaticSegment?.sourcePointIndices[index] ?? index
      )),
      rawDatasetIndices: preparedResult.sourceIndices,
    });
    let detection = detectInteractivePeaks({
      ...peakDetectionInput(prepared),
    }, channelParameters.peakSearch);
    if (
      channelParameters.processing.smoothingWindow === DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing.smoothingWindow
      && detection.peaks.length < IDENTIFICATION_QUALITY_PROFILE.peakDetection.minimumFeaturesBeforeSmoothingFallback
    ) {
      const fallbackWindow = IDENTIFICATION_QUALITY_PROFILE.peakDetection.fallbackSmoothingWindow;
      const fallbackPrepared = prepareSpectrum(rawDataset, {
        ...channelParameters.processing,
        smoothingWindow: fallbackWindow,
      });
      const fallbackPeakSearch = {
        ...channelParameters.peakSearch,
        minimumDistance: Math.max(
          channelParameters.peakSearch.minimumDistance,
          IDENTIFICATION_QUALITY_PROFILE.peakDetection.fallbackMinimumDistanceNm,
        ),
      };
      const fallbackDetection = detectInteractivePeaks(peakDetectionInput(fallbackPrepared), fallbackPeakSearch);
      if (fallbackDetection.peaks.length > detection.peaks.length) {
        effectiveSmoothingWindow = fallbackWindow;
        effectiveMinimumDistanceNm = fallbackPeakSearch.minimumDistance;
        prepared = fallbackPrepared;
        detection = fallbackDetection;
      }
    }
    const spectralResolutionNm = estimateChannelResolutionNm(
      prepared.dataset.wavelengths,
      detection.peaks,
    );
    const initialCalibrationUncertaintyNm = estimateInitialCalibrationUncertaintyNm(
      prepared.dataset.wavelengths,
      spectralResolutionNm,
      channelParameters.wavelengthCalibration,
    );
    const provisionalPeaks = matchPeaks(detection.peaks, libraryIndex, {
      spectralResolutionNm,
      calibrationUncertaintyNm: initialCalibrationUncertaintyNm,
    });
    const rawWavelengthRange = {
      minimum: Math.min(...rawDataset.wavelengths),
      maximum: Math.max(...rawDataset.wavelengths),
    };
    const wavelengthCalibration = estimateWavelengthCalibration(
      provisionalPeaks,
      rawWavelengthRange,
      spectralResolutionNm,
      initialCalibrationUncertaintyNm,
      channelParameters.peakSearch.prominence,
      channelParameters.wavelengthCalibration,
    );
    const calibratedDetectedPeaks = detection.peaks.map((peak) => ({
      ...peak,
      wavelength: wavelengthCalibration.status === "applied"
        ? peak.refinedWavelength - wavelengthCalibration.shiftNm
        : peak.refinedWavelength,
    }));
    const peaks: readonly AnalyzedPeak[] = matchPeaks(calibratedDetectedPeaks, libraryIndex, {
      spectralResolutionNm,
      calibrationUncertaintyNm: wavelengthCalibration.uncertaintyNm,
    });
    const preparedDataset = applyWavelengthCalibrationToDataset(prepared.dataset, wavelengthCalibration);
    const baselineDataset = applyWavelengthCalibrationToDataset(prepared.baselineDataset, wavelengthCalibration);
    const noiseDataset = applyWavelengthCalibrationToDataset(prepared.noiseDataset, wavelengthCalibration);
    const thresholdDataset = applyWavelengthCalibrationToDataset(detection.thresholdDataset, wavelengthCalibration);
    const suitability = assessChannelSuitability({
      rawDataset,
      preparedDataset,
      baselineDataset,
      noiseDataset,
      peaks,
      spectralResolutionNm,
      calibration: wavelengthCalibration,
      calibrationWasStated: channelParameters.wavelengthCalibration.statedUncertaintyNm !== undefined,
    });
    return {
      id: channel.id,
      name: channel.name,
      rawDataset,
      uncalibratedPreparedDataset: prepared.dataset,
      preparedDataset,
      baselineDataset,
      noiseDataset,
      thresholdDataset,
      preparedStats: prepared.stats,
      parameters: channelParameters,
      peaks,
      wavelengthRange: {
        minimum: Math.min(...preparedDataset.wavelengths),
        maximum: Math.max(...preparedDataset.wavelengths),
      },
      spectralResolutionNm,
      wavelengthCalibration,
      suitability,
      usable: suitability.status !== "impossible",
      transformations: [
        ...(channel.automaticSegment ? [
          `Автоматически выделен непрерывный диапазон ${channel.automaticSegment.wavelengthRange.minimum}–${channel.automaticSegment.wavelengthRange.maximum} нм; длинные маски и разрывы не обрабатывались как сигнал`,
        ] : []),
        `Сглаживание Савицкого—Голея, окно ${effectiveSmoothingWindow} точек${effectiveSmoothingWindow === channelParameters.processing.smoothingWindow ? "" : " (автоматический устойчивый масштаб при недостатке признаков)"}`,
        `Минимальное расстояние пиков: ${effectiveMinimumDistanceNm} нм${effectiveMinimumDistanceNm === channelParameters.peakSearch.minimumDistance ? "" : " (устойчивый масштаб широкополосного сигнала)"}`,
        `Базовая линия AsLS: λ=${channelParameters.processing.baselineSmoothness}, p=${channelParameters.processing.baselineAsymmetry}, итераций ${channelParameters.processing.baselineIterations}`,
        `Локальный MAD: окно ±${channelParameters.processing.noiseWindowNm} нм, исключение положительных выбросов выше ${channelParameters.processing.noiseClippingSnr} локальных σ`,
        channelParameters.processing.normalization === "maximum" ? "Нормализация по максимуму подготовленного сигнала" : "Без нормализации",
        wavelengthCalibration.status === "applied"
          ? `Проверенная коррекция шкалы: ${wavelengthCalibration.shiftNm >= 0 ? "+" : ""}${wavelengthCalibration.shiftNm} нм по независимым опорам`
          : "Шкала длин волн не корректировалась",
      ],
    };
  });
  const suitability = combineSuitability(channels);
  const identification = buildElementHypotheses(channels, libraryIndex.lines);
  const molecularIdentification = spectrumType === "plasma-emission"
    ? identifyMolecularSystems({ channels, systems: molecularSystems })
    : { hypotheses: [], rejectedHypotheses: [], skippedReason: "spectrum-type-not-supported" as const };
  const peaks = channels.flatMap((channel) => channel.peaks);
  const unmatchedPeaks = peaks.filter((peak) => peak.candidates.length === 0);
  const first = channels[0];

  return {
    spectrumType,
    channels,
    suitability,
    preparedDataset: first.preparedDataset,
    preparedStats: first.preparedStats,
    baselineDataset: first.baselineDataset,
    noiseDataset: first.noiseDataset,
    thresholdDataset: first.thresholdDataset,
    peaks,
    hypotheses: identification.hypotheses,
    rejectedHypotheses: identification.rejectedHypotheses,
    molecularHypotheses: molecularIdentification.hypotheses,
    rejectedMolecularHypotheses: molecularIdentification.rejectedHypotheses,
    ...(molecularIdentification.skippedReason ? { molecularAnalysisSkippedReason: molecularIdentification.skippedReason } : {}),
    unmatchedPeaks,
  };
}

export function validateInteractiveAnalysisParameters(parameters: InteractiveAnalysisParameters): void {
  validateProcessingParameters(parameters.processing);
  validatePeakSearchParameters(parameters.peakSearch);
  if (typeof parameters.wavelengthCalibration.allowAutomaticCorrection !== "boolean") {
    throw new Error("Укажите, разрешена ли автоматическая коррекция шкалы длин волн.");
  }
  if (parameters.wavelengthCalibration.statedUncertaintyNm !== undefined && (
    !Number.isFinite(parameters.wavelengthCalibration.statedUncertaintyNm)
    || parameters.wavelengthCalibration.statedUncertaintyNm < 0
    || parameters.wavelengthCalibration.statedUncertaintyNm > 5
  )) throw new Error("Неопределённость калибровки должна быть от 0 до 5 нм.");
}

function validateChannels(channels: readonly SpectrumChannelInput[]): void {
  if (channels.length === 0) throw new Error("Для анализа нужен хотя бы один спектрометрический канал.");
  const ids = new Set<string>();
  for (const channel of channels) {
    if (!channel.id.trim()) throw new Error("У каждого спектрометрического канала должен быть стабильный идентификатор.");
    if (ids.has(channel.id)) throw new Error(`Идентификатор канала «${channel.id}» повторяется.`);
    ids.add(channel.id);
  }
}

function isMultiChannelInput(input: SpectrumDataset | MultiChannelSpectrumInput): input is MultiChannelSpectrumInput {
  return "channels" in input;
}

function copyDataset(dataset: SpectrumDataset): SpectrumDataset {
  return { wavelengths: [...dataset.wavelengths], intensities: [...dataset.intensities] };
}

export { detectInteractivePeaks } from "./peak-detection";
export { prepareSpectrum, savitzkyGolaySmooth, savitzkyGolaySmoothOnGrid } from "./preparation";
