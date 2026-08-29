import { BUILTIN_LIBRARY_VERSION, builtinSpectralLibrary } from "@/domain/spectral-library/builtin-library";
import {
  DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  runInteractiveSpectrumAnalysis,
} from "@/domain/spectrum";
import { getSpectrumStats, round } from "@/domain/spectrum/math";
import type {
  ElementInterpretation,
  ElementInterpretationStatus,
  InteractiveAnalysisParameters,
  InteractiveSpectrumAnalysis,
  SpectrumDataset,
  SpectrumStats,
} from "@/domain/spectrum";
import { demoSpectra } from "@/fixtures/demo-spectra";

export type DemoHypothesisStatus = ElementInterpretationStatus;
export type DemoElementHypothesis = ElementInterpretation;

export interface DemoTransformation {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly description: string;
}

export interface DemoAnalysis extends InteractiveSpectrumAnalysis {
  readonly id: "fe-12-demo";
  readonly title: string;
  readonly source: {
    readonly kind: "Встроенный пример";
    readonly format: "CSV";
    readonly units: "нм / отн. ед.";
  };
  readonly libraryVersion: string;
  readonly rawDataset: SpectrumDataset;
  readonly rawStats: SpectrumStats;
  readonly wavelengthStep: number;
  readonly parameters: InteractiveAnalysisParameters;
  readonly transformations: readonly DemoTransformation[];
}

export function createDemoAnalysis(
  parameters: InteractiveAnalysisParameters = DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
): DemoAnalysis {
  const rawDataset = demoSpectra.fe12;
  const result = runInteractiveSpectrumAnalysis(rawDataset, builtinSpectralLibrary, parameters);

  return {
    ...result,
    id: "fe-12-demo",
    title: "Спектр образца Fe-12",
    source: { kind: "Встроенный пример", format: "CSV", units: "нм / отн. ед." },
    libraryVersion: BUILTIN_LIBRARY_VERSION,
    rawDataset,
    rawStats: getSpectrumStats(rawDataset.intensities),
    wavelengthStep: round(rawDataset.wavelengths[1] - rawDataset.wavelengths[0], 3),
    parameters,
    transformations: [
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
