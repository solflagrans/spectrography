import type { SpectralLine } from "@/domain/spectral-library/types";
import { createSpectralLibraryWavelengthIndex, type SpectralLibraryWavelengthIndex } from "@/domain/spectral-library/wavelength-index";
import { builtinMolecularSystems, identifyMolecularSystems } from "@/domain/molecular-spectrum";

import { validateDataset } from "./dataset";
import { buildElementHypotheses } from "./identification";
import { matchPeaks } from "./matching";
import { assessChannelSuitability, combineSuitability } from "./measurement-quality";
import { detectInteractivePeaks, validatePeakSearchParameters } from "./peak-detection";
import { prepareSpectrum, validateProcessingParameters } from "./preparation";
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
    smoothingWindow: 15,
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
    minimumDistance: 1.2,
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
): InteractiveSpectrumAnalysis {
  validateInteractiveAnalysisParameters(parameters);
  const channelInputs = isMultiChannelInput(input)
    ? input.channels
    : [{ id: "channel-1", name: "Канал 1", dataset: input }];
  validateChannels(channelInputs);
  const libraryIndex = Array.isArray(library)
    ? createSpectralLibraryWavelengthIndex(library)
    : library as SpectralLibraryWavelengthIndex;
  const channels = channelInputs.map((channel) => {
    const channelParameters = channel.parameters ?? parameters;
    validateInteractiveAnalysisParameters(channelParameters);
    validateDataset(channel.dataset);
    const rawDataset = copyDataset(channel.dataset);
    const prepared = prepareSpectrum(rawDataset, channelParameters.processing);
    const detection = detectInteractivePeaks({
      channelId: channel.id,
      preparedDataset: prepared.dataset,
      rawDataset,
      noiseDataset: prepared.noiseDataset,
      sourceIndices: prepared.sourceIndices,
    }, channelParameters.peakSearch);
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
        `Сглаживание Савицкого—Голея, окно ${channelParameters.processing.smoothingWindow} точек`,
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
    ? identifyMolecularSystems({ channels, systems: builtinMolecularSystems })
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
    conclusion: `${suitability.summary} ${buildConclusion(
      identification.hypotheses,
      identification.rejectedHypotheses,
      molecularIdentification.hypotheses,
      spectrumType,
      unmatchedPeaks.length,
      peaks.length,
    )}`,
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

function buildConclusion(
  hypotheses: InteractiveSpectrumAnalysis["hypotheses"],
  rejectedHypotheses: InteractiveSpectrumAnalysis["rejectedHypotheses"],
  molecularHypotheses: InteractiveSpectrumAnalysis["molecularHypotheses"],
  spectrumType: SpectrumType,
  unmatchedCount: number,
  totalPeakCount: number,
): string {
  const rejectedCount = rejectedHypotheses.length;
  if (totalPeakCount === 0) return appendMolecularConclusion("При выбранных параметрах устойчивые атомные пики не найдены; автоматическая интерпретация остаётся неопределённой.", molecularHypotheses, spectrumType);
  if (hypotheses.length === 0) {
    const diagnostic = rejectedCount > 0 ? ` Зафиксированы единичные совпадения или согласования, не отличающиеся от случайных: ${rejectedCount}.` : "";
    return appendMolecularConclusion(`Многолинейная атомная гипотеза не сформирована.${diagnostic}`, molecularHypotheses, spectrumType);
  }
  const leading = hypotheses[0];
  if (leading.reliability === "tentative") {
    const notableDiagnostic = [...rejectedHypotheses]
      .filter((item) => (
        item.hypothesis.strongCharacteristicGroupCount >= 1
          && item.hypothesis.reliableCharacteristicGroupCount === 1
          && item.hypothesis.reliableKeyCharacteristicGroupCount === 1
      ))
      .sort((left, right) => right.hypothesis.characteristicPriorityIndex - left.hypothesis.characteristicPriorityIndex)[0]?.hypothesis;
    const notable = notableDiagnostic
      ? ` В подробностях сохранён сильный, но пока недостаточный признак ${notableDiagnostic.name} (${notableDiagnostic.symbol}).`
      : "";
    return appendMolecularConclusion(`Надёжных гипотез недостаточно для атомной идентификации. Наиболее согласованная осторожная гипотеза — ${leading.name} (${leading.symbol}): ${leading.reliableCharacteristicGroupCount} качественных характерных групп.${notable} Остальные технические совпадения сохранены в подробностях.`, molecularHypotheses, spectrumType);
  }
  const alternatives = hypotheses.slice(1, 4).map((item) => `${item.name} (${item.symbol})`).join(", ");
  return appendMolecularConclusion(`Основная атомная гипотеза — ${leading.name} (${leading.symbol}): ${leading.strongCharacteristicGroupCount} сильных и ${leading.reliableCharacteristicGroupCount} качественных характерных спектральных групп.${alternatives ? ` Другие надёжные гипотезы: ${alternatives}.` : ""}${rejectedCount ? ` Слабые и неоднозначные совпадения сохранены в подробностях: ${rejectedCount}.` : ""}${unmatchedCount ? ` Пиков без кандидатов: ${unmatchedCount}.` : ""}`, molecularHypotheses, spectrumType);
}

function appendMolecularConclusion(
  atomicConclusion: string,
  molecularHypotheses: InteractiveSpectrumAnalysis["molecularHypotheses"],
  spectrumType: SpectrumType,
): string {
  if (spectrumType !== "plasma-emission") return atomicConclusion;
  if (!molecularHypotheses.length) return `${atomicConclusion} Надёжного совпадения молекулярных полос N₂ или N₂⁺ не найдено.`;
  const forms = molecularHypotheses.map((item) => `${item.displayName} (${item.formula})`).join(", ");
  return `${atomicConclusion} Форма молекулярных полос независимо поддерживает: ${forms}. Совпадающие участки не суммируются с атомными линиями.`;
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
export { prepareSpectrum, savitzkyGolaySmooth } from "./preparation";
