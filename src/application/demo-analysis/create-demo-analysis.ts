import { BUILTIN_LIBRARY_VERSION, builtinSpectralLibrary } from "@/domain/spectral-library/builtin-library";
import { analyzeSpectrum, smoothValues } from "@/domain/spectrum";
import { getSpectrumStats, round } from "@/domain/spectrum/math";
import type {
  AnalysisOptions,
  ElementHypothesis,
  MatchedPeak,
  SpectrumDataset,
  SpectrumStats,
} from "@/domain/spectrum";
import { demoSpectra } from "@/fixtures/demo-spectra";

export type DemoHypothesisStatus = "confirmed" | "possible" | "review";

export interface DemoTransformation {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly description: string;
}

export interface DemoEvidenceLine {
  readonly peakId: string;
  readonly peakWavelength: number;
  readonly observedWavelength: number;
  readonly referenceWavelength: number;
  readonly delta: number;
  readonly elementSymbol: string;
  readonly ion: string;
}

export interface DemoElementHypothesis {
  readonly symbol: string;
  readonly name: string;
  readonly status: DemoHypothesisStatus;
  /** Эвристика ранжирования, не вероятность. */
  readonly heuristicScore: number;
  readonly explanation: string;
  readonly evidence: readonly DemoEvidenceLine[];
}

export interface DemoAnalysis {
  readonly id: "fe-12-demo";
  readonly title: string;
  readonly source: {
    readonly kind: "Встроенный пример";
    readonly format: "Fixture";
    readonly units: "нм / отн. ед.";
  };
  readonly libraryVersion: string;
  readonly rawDataset: SpectrumDataset;
  readonly preparedDataset: SpectrumDataset;
  readonly rawStats: SpectrumStats;
  readonly preparedStats: SpectrumStats;
  readonly wavelengthStep: number;
  readonly options: AnalysisOptions;
  readonly transformations: readonly DemoTransformation[];
  readonly threshold: number;
  readonly peaks: readonly (MatchedPeak & { readonly id: string })[];
  readonly hypotheses: readonly DemoElementHypothesis[];
  readonly unmatchedPeaks: readonly (MatchedPeak & { readonly id: string })[];
  readonly conclusion: string;
}

const demoOptions: AnalysisOptions = {
  sigma: 1.1,
  prominence: 0.012,
  distance: 8,
  tolerance: 0.3,
  smoothing: 1,
};

export function createDemoAnalysis(): DemoAnalysis {
  const rawDataset = demoSpectra.fe12;
  const smoothed = smoothValues(rawDataset.intensities, 5);
  const baseline = Math.min(...smoothed);
  const baselineCorrected = smoothed.map((value) => Math.max(0, value - baseline));
  const maximum = Math.max(...baselineCorrected);
  const normalized = baselineCorrected.map((value) => round(value / maximum, 6));
  const preparedDataset = {
    wavelengths: rawDataset.wavelengths,
    intensities: normalized,
  } satisfies SpectrumDataset;
  const result = analyzeSpectrum(preparedDataset, builtinSpectralLibrary, demoOptions);
  const peaks = result.peaks.map((peak, index) => ({ ...peak, id: `peak-${index + 1}` }));
  const hypotheses = result.hypotheses.map((hypothesis) =>
    createHypothesis(hypothesis, peaks),
  );
  const unmatchedPeaks = peaks.filter((peak) => !peak.match);
  const confirmed = hypotheses.filter((hypothesis) => hypothesis.status === "confirmed");
  const possible = hypotheses.filter((hypothesis) => hypothesis.status !== "confirmed");

  return {
    id: "fe-12-demo",
    title: "Спектр образца Fe-12",
    source: { kind: "Встроенный пример", format: "Fixture", units: "нм / отн. ед." },
    libraryVersion: BUILTIN_LIBRARY_VERSION,
    rawDataset,
    preparedDataset,
    rawStats: getSpectrumStats(rawDataset.intensities),
    preparedStats: result.detection.stats,
    wavelengthStep: round(rawDataset.wavelengths[1] - rawDataset.wavelengths[0], 3),
    options: demoOptions,
    transformations: [
      {
        id: "smoothing",
        label: "Сглаживание",
        value: "Скользящее среднее · окно 5 точек",
        description: "Снижает высокочастотный шум без изменения исходного набора.",
      },
      {
        id: "baseline",
        label: "Коррекция базовой линии",
        value: `Вычитание минимума · ${round(baseline, 3)}`,
        description: "Подготовленный сигнал приведён к нулевому базовому уровню.",
      },
      {
        id: "normalization",
        label: "Нормализация",
        value: "По максимальному пику · 0…1",
        description: "Интенсивности приведены к единой относительной шкале.",
      },
    ],
    threshold: result.detection.threshold,
    peaks,
    hypotheses,
    unmatchedPeaks,
    conclusion: buildConclusion(confirmed, possible, unmatchedPeaks.length),
  };
}

function createHypothesis(
  hypothesis: ElementHypothesis,
  peaks: readonly (MatchedPeak & { readonly id: string })[],
): DemoElementHypothesis {
  const status = getHypothesisStatus(hypothesis.peaks.length);
  const evidence = hypothesis.peaks.flatMap((hypothesisPeak) => {
    if (!hypothesisPeak.match) return [];
    const peak = peaks.find((candidate) => candidate.index === hypothesisPeak.index);
    if (!peak) return [];

    return [{
      peakId: peak.id,
      peakWavelength: round(peak.wavelength, 2),
      observedWavelength: round(peak.wavelength, 2),
      referenceWavelength: round(hypothesisPeak.match.line, 2),
      delta: round(hypothesisPeak.match.delta, 3),
      elementSymbol: hypothesis.elementSymbol,
      ion: `${hypothesis.elementSymbol} I`,
    }];
  });

  return {
    symbol: hypothesis.elementSymbol,
    name: hypothesis.elementName,
    status,
    heuristicScore: hypothesis.heuristicScore,
    explanation: getHypothesisExplanation(hypothesis.elementSymbol, status, evidence.length),
    evidence,
  };
}

function getHypothesisStatus(lineCount: number): DemoHypothesisStatus {
  if (lineCount >= 3) return "confirmed";
  if (lineCount === 2) return "possible";
  return "review";
}

function getHypothesisExplanation(
  symbol: string,
  status: DemoHypothesisStatus,
  lineCount: number,
): string {
  if (status === "confirmed") {
    return `${lineCount} согласованных линий поддерживают гипотезу ${symbol}.`;
  }
  if (status === "possible") {
    return `${lineCount} линии согласуются с ${symbol}, но данных недостаточно для подтверждения.`;
  }
  return `Найдена одна линия ${symbol}; гипотеза требует независимого подтверждения.`;
}

function buildConclusion(
  confirmed: readonly DemoElementHypothesis[],
  possible: readonly DemoElementHypothesis[],
  unmatchedCount: number,
): string {
  const confirmedNames = formatElements(confirmed);
  const possibleNames = formatElements(possible);
  const confirmedText = confirmedNames
    ? `Набор линий согласуется с присутствием: ${confirmedNames}.`
    : "Подтверждённых элементов не обнаружено.";
  const possibleText = possibleNames
    ? `Дополнительной проверки требуют: ${possibleNames}.`
    : "Дополнительных гипотез нет.";
  const unmatchedText = unmatchedCount
    ? `Без совпадения со справочной библиотекой: ${unmatchedCount}.`
    : "Все обнаруженные пики связаны со справочными линиями.";

  return `${confirmedText} ${possibleText} ${unmatchedText}`;
}

function formatElements(hypotheses: readonly DemoElementHypothesis[]): string {
  return hypotheses.map((hypothesis) => `${hypothesis.name} (${hypothesis.symbol})`).join(", ");
}
