import type { SpectralLine } from "@/domain/spectral-library/types";
import { createSpectralLibraryWavelengthIndex, type SpectralLibraryWavelengthIndex } from "@/domain/spectral-library/wavelength-index";

import { validateDataset } from "./dataset";
import { buildElementHypotheses } from "./identification";
import { matchPeaks } from "./matching";
import { detectInteractivePeaks, validatePeakSearchParameters } from "./peak-detection";
import { prepareSpectrum, validateProcessingParameters } from "./preparation";
import type {
  AnalyzedPeak,
  InteractiveAnalysisParameters,
  InteractiveSpectrumAnalysis,
  MultiChannelSpectrumInput,
  SpectrumChannelInput,
  SpectrumDataset,
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
    tolerance: 0.3,
  },
};

export function runInteractiveSpectrumAnalysis(
  input: SpectrumDataset | MultiChannelSpectrumInput,
  library: readonly SpectralLine[] | SpectralLibraryWavelengthIndex,
  parameters: InteractiveAnalysisParameters = DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
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
    const matchedPeaks = matchPeaks(detection.peaks, libraryIndex, channelParameters.peakSearch.tolerance);
    const peaks: readonly AnalyzedPeak[] = matchedPeaks.map((peak) => ({
      ...peak,
      id: `peak-${channel.id}-point-${peak.sourceIndex + 1}`,
    }));
    return {
      id: channel.id,
      name: channel.name,
      rawDataset,
      preparedDataset: prepared.dataset,
      baselineDataset: prepared.baselineDataset,
      noiseDataset: prepared.noiseDataset,
      thresholdDataset: detection.thresholdDataset,
      preparedStats: prepared.stats,
      parameters: channelParameters,
      peaks,
      wavelengthRange: {
        minimum: Math.min(...rawDataset.wavelengths),
        maximum: Math.max(...rawDataset.wavelengths),
      },
      usable: true,
      transformations: [
        `Сглаживание Савицкого—Голея, окно ${channelParameters.processing.smoothingWindow} точек`,
        `Базовая линия AsLS: λ=${channelParameters.processing.baselineSmoothness}, p=${channelParameters.processing.baselineAsymmetry}, итераций ${channelParameters.processing.baselineIterations}`,
        `Локальный MAD: окно ±${channelParameters.processing.noiseWindowNm} нм, исключение положительных выбросов выше ${channelParameters.processing.noiseClippingSnr} локальных σ`,
        channelParameters.processing.normalization === "maximum" ? "Нормализация по максимуму подготовленного сигнала" : "Без нормализации",
      ],
    };
  });
  const tolerance = Math.max(...channels.map((channel) => channel.parameters.peakSearch.tolerance));
  const identification = buildElementHypotheses(channels, libraryIndex.lines, tolerance);
  const peaks = channels.flatMap((channel) => channel.peaks);
  const unmatchedPeaks = peaks.filter((peak) => peak.candidates.length === 0);
  const first = channels[0];

  return {
    channels,
    preparedDataset: first.preparedDataset,
    preparedStats: first.preparedStats,
    baselineDataset: first.baselineDataset,
    noiseDataset: first.noiseDataset,
    thresholdDataset: first.thresholdDataset,
    peaks,
    hypotheses: identification.hypotheses,
    rejectedHypotheses: identification.rejectedHypotheses,
    unmatchedPeaks,
    conclusion: buildConclusion(identification.hypotheses, identification.rejectedHypotheses.length, unmatchedPeaks.length, peaks.length),
  };
}

export function validateInteractiveAnalysisParameters(parameters: InteractiveAnalysisParameters): void {
  validateProcessingParameters(parameters.processing);
  validatePeakSearchParameters(parameters.peakSearch);
}

function buildConclusion(
  hypotheses: InteractiveSpectrumAnalysis["hypotheses"],
  rejectedCount: number,
  unmatchedCount: number,
  totalPeakCount: number,
): string {
  if (totalPeakCount === 0) return "При выбранных параметрах устойчивые пики не найдены; автоматическая интерпретация остаётся неопределённой.";
  if (hypotheses.length === 0) {
    const diagnostic = rejectedCount > 0 ? ` Зафиксированы единичные совпадения или согласования, не отличающиеся от случайных: ${rejectedCount}.` : "";
    return `Многолинейная гипотеза не сформирована.${diagnostic}`;
  }
  const leading = hypotheses[0];
  const alternatives = hypotheses.slice(1, 4).map((item) => `${item.name} (${item.symbol})`).join(", ");
  return `Наибольшее согласование показывает многолинейная гипотеза ${leading.name} (${leading.symbol}): ${leading.independentMatchedLineCount} независимых линий, ${leading.foundCharacteristicLineCount} характерных из ${leading.availableCharacteristicLineCount}.${alternatives ? ` Другие многолинейные гипотезы: ${alternatives}.` : ""}${rejectedCount ? ` Единичные совпадения и диагностически слабые согласования сохранены отдельно: ${rejectedCount}.` : ""}${unmatchedCount ? ` Пиков без кандидатов: ${unmatchedCount}.` : ""}`;
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
