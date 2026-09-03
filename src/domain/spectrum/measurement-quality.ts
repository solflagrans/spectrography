import { round } from "./math";
import { IDENTIFICATION_QUALITY_PROFILE } from "./quality-profile";
import type {
  ChannelSuitabilityAssessment,
  DetectedPeak,
  MeasurementSuitabilityAssessment,
  SpectrumDataset,
  WavelengthCalibrationResult,
} from "./types";

interface ChannelQualityInput {
  readonly rawDataset: SpectrumDataset;
  readonly preparedDataset: SpectrumDataset;
  readonly baselineDataset: SpectrumDataset;
  readonly noiseDataset: SpectrumDataset;
  readonly peaks: readonly DetectedPeak[];
  readonly spectralResolutionNm: number;
  readonly calibration: WavelengthCalibrationResult;
  readonly calibrationWasStated: boolean;
}

export function assessChannelSuitability(input: ChannelQualityInput): ChannelSuitabilityAssessment {
  const profile = IDENTIFICATION_QUALITY_PROFILE.suitability;
  const wavelengths = input.rawDataset.wavelengths;
  const intensities = input.rawDataset.intensities;
  const pointCount = wavelengths.length;
  const wavelengthSpanNm = pointCount > 1 ? Math.max(...wavelengths) - Math.min(...wavelengths) : 0;
  const gridStepNm = median(wavelengths.slice(1).map((value, index) => Math.abs(value - wavelengths[index])).filter((value) => value > 0));
  const resolutionElements = input.spectralResolutionNm > 0 ? wavelengthSpanNm / input.spectralResolutionNm : 0;
  const noiseMedian = median(input.noiseDataset.intensities.filter((value) => value > 0));
  const rawScale = Math.max(percentile(intensities, 0.985) - percentile(intensities, 0.01), Number.EPSILON);
  const usefulSignal = Math.max(0, percentile(input.preparedDataset.intensities, 0.995) - percentile(input.preparedDataset.intensities, 0.1));
  const usefulDynamicRangeSnr = noiseMedian > 0 ? usefulSignal / noiseMedian : usefulSignal > 0 ? Number.POSITIVE_INFINITY : 0;
  const baselineDriftRatio = robustRange(input.baselineDataset.intensities) / rawScale;
  const candidateOutliers = isolatedOutlierIndices(intensities, profile.outlierSigma);
  const protectedPeakIndices = new Set(input.peaks.flatMap((peak) => {
    const radius = Math.max(1, Math.ceil(2 * peak.widthNm / Math.max(peak.localGridStepNm, Number.EPSILON)));
    return Array.from({ length: radius * 2 + 1 }, (_, offset) => peak.index + offset - radius);
  }));
  const outliers = candidateOutliers.filter((index) => !protectedPeakIndices.has(index));
  const repeatedExtremes = repeatedExtremeMetrics(intensities);
  const widths = input.peaks.map((peak) => peak.widthNm).filter((value) => Number.isFinite(value) && value > 0);
  const widthMedian = median(widths);
  const resolutionRelativeMad = widthMedian > 0 ? median(widths.map((value) => Math.abs(value - widthMedian))) / widthMedian : 1;
  const strongFeatureCount = input.peaks.filter((peak) => peak.snr >= 10 && peak.positionRefined).length;
  const metrics = {
    pointCount,
    wavelengthSpanNm: round(wavelengthSpanNm, 6),
    gridStepNm: round(gridStepNm, 8),
    resolutionElements: round(resolutionElements, 4),
    noiseMedian: round(noiseMedian, 8),
    usefulDynamicRangeSnr: Number.isFinite(usefulDynamicRangeSnr) ? round(usefulDynamicRangeSnr, 4) : Number.POSITIVE_INFINITY,
    baselineDriftRatio: round(baselineDriftRatio, 6),
    isolatedOutlierCount: outliers.length,
    isolatedOutlierFraction: round(pointCount ? outliers.length / pointCount : 0, 8),
    repeatedExtremeCount: repeatedExtremes.count,
    longestExtremeRun: repeatedExtremes.longestRun,
    detectedFeatureCount: input.peaks.length,
    strongFeatureCount,
    resolutionPeakCount: widths.length,
    resolutionRelativeMad: round(resolutionRelativeMad, 6),
  };
  const issues: ChannelSuitabilityAssessment["issues"][number][] = [];

  if (pointCount < profile.minimumPointCount || resolutionElements < profile.minimumResolutionElements) {
    issues.push({ code: "insufficient-range", severity: "critical", explanation: "Диапазон содержит слишком мало независимых элементов разрешения." });
  } else if (resolutionElements < profile.limitedResolutionElements) {
    issues.push({ code: "insufficient-range", severity: "warning", explanation: "Спектральный диапазон ограничивает число независимо проверяемых признаков." });
  }
  if (usefulDynamicRangeSnr < profile.impossibleDynamicRangeSnr) {
    issues.push({ code: "low-dynamic-range", severity: "critical", explanation: "Полезный динамический диапазон не отделяется от локального шума." });
  } else if (usefulDynamicRangeSnr < profile.limitedDynamicRangeSnr) {
    issues.push({ code: "low-dynamic-range", severity: "warning", explanation: "Полезный динамический диапазон невелик относительно шума." });
  }
  if (baselineDriftRatio > profile.baselineDriftRatio) {
    issues.push({ code: "baseline-drift", severity: "warning", explanation: "Дрейф базовой линии сопоставим с полезным диапазоном сигнала." });
  }
  if (metrics.isolatedOutlierFraction >= profile.impossibleOutlierFraction) {
    issues.push({ code: "isolated-outliers", severity: "critical", explanation: "Слишком много одиночных повреждённых точек для устойчивой интерпретации." });
  } else if (metrics.isolatedOutlierFraction >= profile.limitedOutlierFraction) {
    issues.push({ code: "isolated-outliers", severity: "warning", explanation: "Обнаружены одиночные выбросы, способные имитировать спектральные признаки." });
  }
  if (
    repeatedExtremes.count / Math.max(1, pointCount) >= profile.repeatedExtremeFraction
    || repeatedExtremes.longestRun >= profile.repeatedExtremeRun
  ) {
    issues.push({ code: "possible-signal-limit", severity: "warning", explanation: "Повторяются предельные значения; при неизвестной разрядности это лишь возможное ограничение сигнала, а не установленное насыщение." });
  }
  if (input.peaks.length < profile.minimumFeatureCount) {
    issues.push({ code: "insufficient-features", severity: "critical", explanation: "Найдено недостаточно устойчивых признаков для многопризнаковой идентификации." });
  } else if (strongFeatureCount < profile.minimumStrongFeatureCount) {
    issues.push({ code: "insufficient-features", severity: "warning", explanation: "Сильных признаков недостаточно для устойчивого заключения." });
  }
  if (widths.length < profile.minimumResolutionPeakCount || resolutionRelativeMad > profile.maximumResolutionRelativeMad) {
    issues.push({ code: "uncertain-resolution", severity: "warning", explanation: "Оценка разрешения основана на малом или неоднородном наборе ширин пиков." });
  }
  if (!input.calibrationWasStated && input.calibration.status !== "applied") {
    issues.push({ code: "uncertain-calibration", severity: "warning", explanation: "Независимых опор для коррекции шкалы недостаточно; используется консервативная неопределённость." });
  }

  const status = issues.some((issue) => issue.severity === "critical")
    ? "impossible" as const
    : issues.length
      ? "limited" as const
      : "sufficient" as const;
  return {
    status,
    summary: status === "sufficient"
      ? "Данных достаточно."
      : status === "limited"
        ? `Результат ограничен качеством измерения: ${issues.map((issue) => issue.explanation).join(" ")}`
        : `Надёжная интерпретация невозможна: ${issues.filter((issue) => issue.severity === "critical").map((issue) => issue.explanation).join(" ")}`,
    issues,
    metrics,
  };
}

export function combineSuitability(
  channels: readonly { readonly id: string; readonly suitability: ChannelSuitabilityAssessment }[],
): MeasurementSuitabilityAssessment {
  const status = channels.length > 0 && channels.every((channel) => channel.suitability.status === "impossible")
    ? "impossible" as const
    : channels.some((channel) => channel.suitability.status !== "sufficient")
      ? "limited" as const
      : "sufficient" as const;
  return {
    status,
    summary: status === "sufficient"
      ? "Данных достаточно."
      : status === "limited"
        ? "Результат ограничен качеством измерения."
        : "Надёжная интерпретация невозможна.",
    channelAssessments: channels.map((channel) => ({ channelId: channel.id, assessment: channel.suitability })),
  };
}

function isolatedOutlierIndices(values: readonly number[], sigma: number): readonly number[] {
  if (values.length < 3) return [];
  const impulses = values.slice(1, -1).map((value, index) => value - (values[index] + values[index + 2]) / 2);
  const center = median(impulses);
  const scale = 1.4826 * median(impulses.map((value) => Math.abs(value - center)));
  if (scale <= Number.EPSILON) return [];
  return impulses.flatMap((value, index) => Math.abs(value - center) > sigma * scale ? [index + 1] : []);
}

function repeatedExtremeMetrics(values: readonly number[]): { count: number; longestRun: number } {
  if (!values.length) return { count: 0, longestRun: 0 };
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  let count = 0; let longestRun = 0; let run = 0;
  for (const value of values) {
    if (value === minimum || value === maximum) {
      count += 1;
      run += 1;
      longestRun = Math.max(longestRun, run);
    } else run = 0;
  }
  return { count, longestRun };
}

function robustRange(values: readonly number[]): number {
  return Math.max(0, percentile(values, 0.95) - percentile(values, 0.05));
}

function percentile(values: readonly number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
