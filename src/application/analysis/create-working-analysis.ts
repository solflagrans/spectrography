import {
  BUILTIN_LIBRARY_LABEL,
  BUILTIN_LIBRARY_VERSION,
  builtinSpectralLibrary,
} from "@/domain/spectral-library/builtin-library";
import {
  DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  isDatasetSortedByWavelength,
  runInteractiveSpectrumAnalysis,
  validateDataset,
} from "@/domain/spectrum";
import { getSpectrumStats, round } from "@/domain/spectrum/math";
import type {
  ElementInterpretationStatus,
  InteractiveAnalysisParameters,
  InteractiveSpectrumAnalysis,
  SpectrumDataset,
  SpectrumStats,
} from "@/domain/spectrum";
import { demoSpectra } from "@/fixtures/demo-spectra";

import type {
  Raw8AuxiliaryData,
  Raw8InstrumentMetadata,
} from "@/application/import-spectrum/parse-avasoft-raw8";

export type AnalysisHypothesisStatus = ElementInterpretationStatus;
export type AnalysisFileFormat = "CSV" | "JSON" | "XLSX" | "RAW8";

export interface AnalysisSource {
  readonly kind: "Встроенный пример" | "Пользовательский файл";
  readonly fileName: string;
  readonly format: AnalysisFileFormat;
  readonly units: "нм / отн. ед." | "нм / отсчёты прибора";
}

export interface AnalysisTransformation {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly description: string;
}

export interface WorkingAnalysis extends InteractiveSpectrumAnalysis {
  readonly id: string;
  readonly title: string;
  readonly source: AnalysisSource;
  readonly libraryVersion: string;
  readonly libraryLabel: string;
  readonly rawDataset: SpectrumDataset;
  readonly rawStats: SpectrumStats;
  readonly wavelengthRange: {
    readonly minimum: number;
    readonly maximum: number;
  };
  readonly wavelengthStep: number;
  readonly parameters: InteractiveAnalysisParameters;
  readonly transformations: readonly AnalysisTransformation[];
  readonly auxiliaryData?: Raw8AuxiliaryData;
  readonly instrumentMetadata?: Raw8InstrumentMetadata;
}

export interface CreateWorkingAnalysisInput {
  readonly id: string;
  readonly title: string;
  readonly source: AnalysisSource;
  readonly rawDataset: SpectrumDataset;
  readonly auxiliaryData?: Raw8AuxiliaryData;
  readonly instrumentMetadata?: Raw8InstrumentMetadata;
}

export const DEMO_ANALYSIS_INPUT: CreateWorkingAnalysisInput = {
  id: "fe-12-demo",
  title: "Спектр образца Fe-12",
  source: {
    kind: "Встроенный пример",
    fileName: "fe-12-demo.csv",
    format: "CSV",
    units: "нм / отн. ед.",
  },
  rawDataset: demoSpectra.fe12,
};

export function createWorkingAnalysis(
  input: CreateWorkingAnalysisInput,
  parameters: InteractiveAnalysisParameters = DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
): WorkingAnalysis {
  validateDataset(input.rawDataset);
  const rawDataset = copyDataset(input.rawDataset);
  const result = runInteractiveSpectrumAnalysis(rawDataset, builtinSpectralLibrary, parameters);
  const minimumWavelength = Math.min(...rawDataset.wavelengths);
  const maximumWavelength = Math.max(...rawDataset.wavelengths);
  const wasSorted = isDatasetSortedByWavelength(rawDataset);

  return {
    ...result,
    id: input.id,
    title: input.title,
    source: input.source,
    libraryVersion: BUILTIN_LIBRARY_VERSION,
    libraryLabel: BUILTIN_LIBRARY_LABEL,
    rawDataset,
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
        value: `Вычитание минимума · ${round(result.baseline, 3)}`,
        description: "Подготовленный сигнал приведён к нулевому базовому уровню.",
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
