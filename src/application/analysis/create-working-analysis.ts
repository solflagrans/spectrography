import {
  BUILTIN_ANALYSIS_LIBRARY_LABEL,
  BUILTIN_ANALYSIS_LIBRARY_VERSION,
  builtinAnalysisSpectralLibraryIndex,
} from "@/domain/spectral-library/builtin-analysis-library";
import { BUILTIN_MOLECULAR_LIBRARY_VERSION, builtinMolecularSystems } from "@/domain/molecular-spectrum";
import {
  DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  isDatasetSortedByWavelength,
  normalizeSpectrumType,
  runInteractiveSpectrumAnalysis,
  validateDataset,
} from "@/domain/spectrum";
import { getSpectrumStats, round } from "@/domain/spectrum/math";
import type { Raw8AuxiliaryData } from "@/application/import-spectrum/parse-avasoft-raw8";
import type {
  InteractiveAnalysisParameters,
  SpectrumDataset,
} from "@/domain/spectrum";
import type { CreateWorkingAnalysisInput, WorkingAnalysis } from "./working-analysis";
import { createAnalysisConclusion } from "./create-analysis-conclusion";

export { DEMO_ANALYSIS_INPUT } from "./working-analysis";
export type {
  AnalysisFileFormat,
  AnalysisSource,
  AnalysisTransformation,
  CreateWorkingAnalysisInput,
  WorkingAnalysis,
} from "./working-analysis";

export function createWorkingAnalysis(
  input: CreateWorkingAnalysisInput,
  parameters: InteractiveAnalysisParameters = DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
): WorkingAnalysis {
  validateDataset(input.rawDataset);
  const rawDataset = copyDataset(input.rawDataset);
  const channelInput = input.channels
    ? { channels: input.channels.map((channel) => ({ ...channel, dataset: copyDataset(channel.dataset) })) }
    : { channels: [{ id: "channel-1", name: "Канал 1", dataset: rawDataset }] };
  const spectrumType = normalizeSpectrumType(input.spectrumType);
  const result = runInteractiveSpectrumAnalysis(
    channelInput,
    builtinAnalysisSpectralLibraryIndex,
    parameters,
    spectrumType,
    builtinMolecularSystems,
  );
  const minimumWavelength = Math.min(...rawDataset.wavelengths);
  const maximumWavelength = Math.max(...rawDataset.wavelengths);
  const wasSorted = isDatasetSortedByWavelength(rawDataset);

  return {
    ...result,
    conclusion: createAnalysisConclusion(result),
    id: input.id,
    title: input.title,
    source: input.source,
    libraryVersion: BUILTIN_ANALYSIS_LIBRARY_VERSION,
    libraryLabel: BUILTIN_ANALYSIS_LIBRARY_LABEL,
    molecularLibraryVersion: BUILTIN_MOLECULAR_LIBRARY_VERSION,
    rawDataset,
    spectrumType,
    rawStats: getSpectrumStats(rawDataset.intensities),
    wavelengthRange: {
      minimum: minimumWavelength,
      maximum: maximumWavelength,
    },
    wavelengthStep: getMedianStep(result.preparedDataset.wavelengths),
    parameters,
    auxiliaryData: input.auxiliaryData ? copyAuxiliaryData(input.auxiliaryData) : undefined,
    instrumentMetadata: input.instrumentMetadata,
    transformations: [
      ...(!wasSorted
        ? [{
            id: "sorting",
            label: "Сортировка по длине волны",
            value: "По возрастанию",
            description: "Рабочая копия отсортирована; порядок точек исходного набора сохранён без изменений.",
          }]
        : []),
      {
        id: "smoothing",
        label: "Сглаживание",
        value: `Савицкий—Голей · окно ${parameters.processing.smoothingWindow} точек`,
        description: "Квадратичный фильтр снижает высокочастотный шум без изменения исходного набора.",
      },
      {
        id: "baseline",
        label: "Коррекция базовой линии",
        value: `Робастная AsLS-кривая · λ ${parameters.processing.baselineSmoothness}`,
        description: "Гладкая базовая линия оценена с асимметричным взвешиванием, чтобы выраженные пики не смещали её вверх.",
      },
      {
        id: "noise",
        label: "Локальная оценка шума",
        value: `MAD · окно ±${parameters.processing.noiseWindowNm} нм`,
        description: "Шум оценён локально по остаточному сигналу; выраженные положительные пики исключены робастным отсечением.",
      },
      {
        id: "normalization",
        label: "Нормализация",
        value: parameters.processing.normalization === "maximum"
          ? "По максимальному пику · 0…1"
          : "Без нормализации",
        description: parameters.processing.normalization === "maximum"
          ? "Интенсивности приведены к единой относительной шкале."
          : "После коррекции сохранён исходный масштаб интенсивности.",
      },
    ],
  };
}

function copyAuxiliaryData(data: Raw8AuxiliaryData): Raw8AuxiliaryData {
  return {
    dark: [...data.dark],
    reference: [...data.reference],
  };
}

function copyDataset(dataset: SpectrumDataset): SpectrumDataset {
  return {
    wavelengths: [...dataset.wavelengths],
    intensities: [...dataset.intensities],
  };
}

function getMedianStep(wavelengths: readonly number[]): number {
  const steps = wavelengths
    .slice(1)
    .map((wavelength, index) => wavelength - wavelengths[index])
    .sort((left, right) => left - right);
  return round(steps[Math.floor(steps.length / 2)] ?? 0, 3);
}
