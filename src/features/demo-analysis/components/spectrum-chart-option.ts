import type { EChartsCoreOption } from "echarts/core";

import type { AnalyzedPeak, SpectrumDataset } from "@/domain/spectrum";
import { formatDecimal } from "@/features/workspace/model/display-format";

export type SpectrumChartLayer = "raw" | "baseline" | "prepared" | "threshold" | "peaks" | "referenceLines" | "missingReferenceLines" | "regions";

export interface SpectrumReferenceLine {
  readonly label: string;
  readonly wavelength: number;
  readonly observedWavelength?: number;
}

export interface SpectrumHighlightedRegion {
  readonly label: string;
  readonly minimum: number;
  readonly maximum: number;
}

export interface SpectrumChartData {
  readonly preparedIntensityUnit?: "отн. ед." | "отсчёты прибора" | "доля максимума";
  readonly rawIntensityUnit?: "отн. ед." | "отсчёты прибора";
  readonly rawDataset?: SpectrumDataset;
  readonly baselineDataset?: SpectrumDataset;
  readonly preparedDataset?: SpectrumDataset;
  readonly peaks?: readonly AnalyzedPeak[];
  readonly selectedPeakId?: string | null;
  readonly thresholdDataset?: SpectrumDataset;
  readonly referenceLines?: readonly SpectrumReferenceLine[];
  readonly missingReferenceLines?: readonly SpectrumReferenceLine[];
  readonly highlightedRegions?: readonly SpectrumHighlightedRegion[];
}

export interface SpectrumChartPalette {
  readonly raw: string;
  readonly baseline: string;
  readonly prepared: string;
  readonly peak: string;
  readonly threshold: string;
  readonly reference: string;
  readonly missingReference: string;
  readonly region: string;
  readonly text: string;
  readonly border: string;
  readonly surface: string;
}

export interface SpectrumZoomRange {
  readonly start: number;
  readonly end: number;
}

export const FULL_SPECTRUM_ZOOM: SpectrumZoomRange = { start: 0, end: 100 };
const medianStepCache = new WeakMap<readonly number[], number>();
const sortedWavelengthCache = new WeakMap<readonly number[], boolean>();

export const SPECTRUM_SERIES_NAMES = {
  raw: "Исходный спектр",
  baseline: "Базовая линия",
  prepared: "Подготовленный спектр",
  threshold: "Порог обнаружения",
  peaks: "Найденные пики",
  referenceLines: "Справочные линии",
  missingReferenceLines: "Характерные линии без пика",
  regions: "Характерные области",
} as const;

export function createSpectrumChartOption(
  data: SpectrumChartData,
  visibleLayers: ReadonlySet<SpectrumChartLayer>,
  palette: SpectrumChartPalette,
  zoom: SpectrumZoomRange,
  width = 900,
): EChartsCoreOption {
  const rawVisible = visibleLayers.has("raw") && Boolean(data.rawDataset);
  const baselineVisible = visibleLayers.has("baseline") && Boolean(data.baselineDataset);
  const preparedVisible = visibleLayers.has("prepared") && Boolean(data.preparedDataset);
  const thresholdVisible = visibleLayers.has("threshold") && Boolean(data.thresholdDataset);
  const peaksVisible = visibleLayers.has("peaks") && data.peaks !== undefined;
  const referenceLinesVisible = visibleLayers.has("referenceLines") && data.referenceLines !== undefined;
  const missingReferenceLinesVisible = visibleLayers.has("missingReferenceLines") && data.missingReferenceLines !== undefined;
  const regionsVisible = visibleLayers.has("regions") && data.highlightedRegions !== undefined;
  const preparedAxisRequired = preparedVisible || thresholdVisible || peaksVisible || referenceLinesVisible || missingReferenceLinesVisible || regionsVisible;
  const rawAxisRequired = rawVisible || baselineVisible;
  const dualAxis = rawAxisRequired && preparedAxisRequired;
  const preparedAxisIndex = dualAxis ? 1 : 0;
  const [minimumWavelength, maximumWavelength] = getWavelengthExtent(data);
  const span = (maximumWavelength - minimumWavelength) * (zoom.end - zoom.start) / 100;
  const visibleMinimum = minimumWavelength + (maximumWavelength - minimumWavelength) * zoom.start / 100;
  const labelSpacing = span * 48 / Math.max(width - 144, 160);
  let lastLabel = Number.NEGATIVE_INFINITY;
  const labelledReferences = new Set((data.referenceLines ?? []).slice().sort((a, b) => a.wavelength - b.wavelength).filter((line) => {
    if (line.wavelength < visibleMinimum || line.wavelength > visibleMinimum + span || line.wavelength - lastLabel < labelSpacing) return false;
    lastLabel = line.wavelength;
    return true;
  }));
  const series: Record<string, unknown>[] = [];

  if (rawVisible && data.rawDataset) {
    series.push({
      id: "raw-spectrum",
      name: SPECTRUM_SERIES_NAMES.raw,
      type: "line",
      data: toSeriesData(data.rawDataset),
      yAxisIndex: 0,
      showSymbol: false,
      sampling: "lttb",
      lineStyle: { color: palette.raw, width: preparedVisible ? 1.1 : 1.6, opacity: preparedVisible ? 0.42 : 0.95 },
      itemStyle: { color: palette.raw },
      emphasis: { lineStyle: { opacity: 0.8 } },
      z: 1,
    });
  }

  if (baselineVisible && data.baselineDataset) {
    series.push({
      id: "estimated-baseline",
      name: SPECTRUM_SERIES_NAMES.baseline,
      type: "line",
      data: toSeriesData(data.baselineDataset),
      yAxisIndex: 0,
      showSymbol: false,
      sampling: "lttb",
      silent: true,
      lineStyle: { color: palette.baseline, width: 1.35, type: "dashed", opacity: 0.92 },
      itemStyle: { color: palette.baseline },
      z: 2,
    });
  }

  if (preparedVisible && data.preparedDataset) {
    series.push({
      id: "prepared-spectrum",
      name: SPECTRUM_SERIES_NAMES.prepared,
      type: "line",
      data: toSeriesData(data.preparedDataset),
      yAxisIndex: preparedAxisIndex,
      showSymbol: false,
      sampling: "lttb",
      lineStyle: { color: palette.prepared, width: 1.8 },
      itemStyle: { color: palette.prepared },
      z: 3,
    });
  }

  if (thresholdVisible && data.thresholdDataset) {
    series.push({
      id: "detection-threshold",
      name: SPECTRUM_SERIES_NAMES.threshold,
      type: "line",
      data: toSeriesData(data.thresholdDataset),
      yAxisIndex: preparedAxisIndex,
      showSymbol: false,
      silent: true,
      lineStyle: { color: palette.threshold, width: 1.1, type: "dotted" },
      z: 2,
    });
  }

  if (peaksVisible && data.peaks) {
    series.push({
      id: "detected-peaks",
      emphasis: { scale: 1.8, itemStyle: { borderColor: palette.reference, borderWidth: 3, shadowBlur: 8, shadowColor: palette.reference } },
      name: SPECTRUM_SERIES_NAMES.peaks,
      type: "scatter",
      data: data.peaks.map((peak) => {
        const selected = peak.id === data.selectedPeakId;
        return {
          id: peak.id,
          value: [peak.wavelength, peak.intensity],
          symbol: "circle",
          symbolSize: selected ? 11 : 5,
          itemStyle: selected
            ? {
                color: palette.surface,
                borderColor: palette.reference,
                borderWidth: 3,
                shadowBlur: 5,
                shadowColor: withAlpha(palette.reference, 0.35),
              }
            : undefined,
        };
      }),
      yAxisIndex: preparedAxisIndex,
      symbolSize: 5,
      markLine: {
        silent: true, symbol: ["none", "none"], label: { show: false },
        lineStyle: { color: palette.reference, width: 1, type: "dashed", opacity: 0.65 },
        data: data.peaks.filter((peak) => peak.id === data.selectedPeakId).map((peak) => ({ xAxis: peak.wavelength })),
      },
      cursor: "pointer",
      itemStyle: { color: palette.peak, borderColor: palette.surface, borderWidth: 1.5 },
      z: 5,
    });
  }

  if (referenceLinesVisible && data.referenceLines) {
    series.push({
      id: "reference-lines",
      name: SPECTRUM_SERIES_NAMES.referenceLines,
      type: "line",
      data: [],
      yAxisIndex: preparedAxisIndex,
      showSymbol: false,
      silent: false,
      lineStyle: { opacity: 0 },
      markLine: {
        silent: false,
        symbol: ["none", "none"],
        data: data.referenceLines.map((line) => ({
          name: line.label,
          xAxis: line.wavelength,
          tooltip: { trigger: "item", formatter: () => `<strong>${escapeHtml(line.label)}</strong><br>Справочная длина: ${formatDecimal(line.wavelength, 3)} нм${line.observedWavelength !== undefined ? `<br>Наблюдаемый пик: ${formatDecimal(line.observedWavelength, 3)} нм<br>Отклонение: ${formatDecimal(line.observedWavelength - line.wavelength, 3)} нм` : "<br>Без назначенного пика"}` },
          lineStyle: { color: palette.reference, opacity: 0.72, type: "solid", width: 1.25 },
          label: {
            show: labelledReferences.has(line),
            color: palette.reference,
            formatter: line.label,
            position: "insideEndTop",
            fontSize: 12,
          },
        })),
      },
      labelLayout: { hideOverlap: true },
      z: 2,
    });
  }

  if (missingReferenceLinesVisible && data.missingReferenceLines) {
    series.push({
      id: "missing-reference-lines",
      name: SPECTRUM_SERIES_NAMES.missingReferenceLines,
      type: "line",
      data: [],
      yAxisIndex: preparedAxisIndex,
      showSymbol: false,
      silent: false,
      lineStyle: { opacity: 0 },
      markLine: {
        silent: false,
        symbol: ["none", "none"],
        data: data.missingReferenceLines.map((line) => ({
          name: line.label,
          xAxis: line.wavelength,
          tooltip: { trigger: "item", formatter: () => `<strong>${escapeHtml(line.label)}</strong><br>Справочная длина: ${formatDecimal(line.wavelength, 3)} нм${line.observedWavelength !== undefined ? `<br>Наблюдаемый пик: ${formatDecimal(line.observedWavelength, 3)} нм<br>Отклонение: ${formatDecimal(line.observedWavelength - line.wavelength, 3)} нм` : "<br>Без назначенного пика"}` },
          lineStyle: { color: palette.missingReference, opacity: 0.34, type: "dashed", width: 1 },
          label: { show: false },
        })),
      },
      z: 1,
    });
  }

  if (regionsVisible && data.highlightedRegions) {
    series.push({
      id: "highlighted-regions",
      name: SPECTRUM_SERIES_NAMES.regions,
      type: "line",
      data: [],
      yAxisIndex: preparedAxisIndex,
      showSymbol: false,
      silent: true,
      lineStyle: { opacity: 0 },
      markArea: {
        silent: true,
        itemStyle: { color: withAlpha(palette.region, 0.07), borderColor: withAlpha(palette.region, 0.3), borderWidth: 1 },
        label: { color: palette.region, fontSize: 12, position: "insideTop" },
        data: data.highlightedRegions.map((region) => [
          { name: region.label, xAxis: region.minimum },
          { xAxis: region.maximum },
        ]),
      },
      z: 1,
    });
  }

  return {
    animation: false,
    grid: {
      left: dualAxis ? 72 : 60,
      right: dualAxis ? 72 : 24,
      top: 40,
      bottom: 72,
    },
    toolbox: { show: true, itemSize: 0, itemGap: 0, feature: { dataZoom: { yAxisIndex: "none", icon: { zoom: "path://", back: "path://" } } } },
    tooltip: {
      trigger: "axis",
      confine: true,
      transitionDuration: 0,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      textStyle: { color: palette.text, fontSize: 12 },
      axisPointer: { type: "line", snap: true },
      formatter: (parameters: unknown) => formatSpectrumTooltip(
        parameters,
        data,
        visibleLayers,
        palette,
      ),
    },
    xAxis: {
      type: "value",
      name: "Длина волны, нм",
      nameLocation: "middle",
      nameGap: 28,
      min: minimumWavelength,
      max: maximumWavelength,
      nameTextStyle: { color: palette.text, fontSize: 12, fontWeight: 600 },
      axisLabel: { color: palette.text, fontSize: 12, hideOverlap: true, showMinLabel: false, showMaxLabel: false, formatter: (value: number) => formatWavelengthTick(value, span) },
      axisLine: { lineStyle: { color: palette.border } },
      splitLine: { show: false },
    },
    yAxis: createYAxis(rawAxisRequired, preparedAxisRequired, dualAxis, palette, data.rawIntensityUnit, data),
    dataZoom: [
      {
        id: "spectrum-inside-zoom",
        type: "inside",
        xAxisIndex: 0,
        filterMode: "none",
        start: zoom.start,
        end: zoom.end,
        zoomOnMouseWheel: false,
        moveOnMouseMove: zoom.start > 0 || zoom.end < 100,
        moveOnMouseWheel: false,
      },
      {
        id: "spectrum-slider-zoom",
        type: "slider",
        xAxisIndex: 0,
        filterMode: "none",
        start: zoom.start,
        end: zoom.end,
        height: 22,
        handleSize: "110%",
        brushSelect: false,
        bottom: 8,
        borderColor: palette.border,
        backgroundColor: palette.surface,
        fillerColor: withAlpha(palette.prepared, 0.12),
        handleStyle: { color: palette.prepared, borderColor: palette.prepared },
        moveHandleStyle: { color: palette.prepared },
        textStyle: { color: palette.text, fontSize: 12 },
        showDetail: true,
        labelFormatter: (value: number) => `${formatWavelengthTick(value, span)} нм`,
      },
    ],
    series,
  };
}

export function formatSpectrumTooltip(
  parameters: unknown,
  data: SpectrumChartData,
  visibleLayers: ReadonlySet<SpectrumChartLayer>,
  palette: SpectrumChartPalette,
): string {
  const axisValue = getTooltipWavelength(parameters);
  if (axisValue === null) return "";

  const anchorDataset = visibleLayers.has("prepared") && data.preparedDataset
    ? data.preparedDataset
    : data.rawDataset ?? data.preparedDataset;
  if (!anchorDataset?.wavelengths.length) return "";

  const anchorIndex = findNearestSampleIndex(anchorDataset.wavelengths, axisValue);
  const points = Array.isArray(parameters) ? parameters : [parameters];
  const directPeak = points.find((point) => point?.seriesId === "detected-peaks")?.data?.id;
  const hoveredPeak = data.peaks?.find((peak) => peak.id === directPeak);
  const wavelength = hoveredPeak?.wavelength ?? anchorDataset.wavelengths[anchorIndex];
  const rows = [`<strong>${formatWavelength(wavelength)} нм</strong>`];

  if (visibleLayers.has("raw") && data.rawDataset) {
    const index = findNearestSampleIndex(data.rawDataset.wavelengths, wavelength);
    rows.push(formatTooltipRow(palette.raw, "Исходный", data.rawDataset.intensities[index], 4, shortIntensityUnit(data.rawIntensityUnit)));
  }

  if (visibleLayers.has("baseline") && data.baselineDataset) {
    const index = findNearestSampleIndex(data.baselineDataset.wavelengths, wavelength);
    rows.push(formatTooltipRow(palette.baseline, "Базовая линия", data.baselineDataset.intensities[index], 4, shortIntensityUnit(data.rawIntensityUnit)));
  }

  if (visibleLayers.has("prepared") && data.preparedDataset) {
    const index = findNearestSampleIndex(data.preparedDataset.wavelengths, wavelength);
    rows.push(formatTooltipRow(palette.prepared, "Подготовленный", data.preparedDataset.intensities[index], 4, shortIntensityUnit(data.preparedIntensityUnit)));
  }

  if (visibleLayers.has("threshold") && data.thresholdDataset) {
    const index = findNearestSampleIndex(data.thresholdDataset.wavelengths, wavelength);
    rows.push(formatTooltipRow(palette.threshold, "Порог", data.thresholdDataset.intensities[index], 4, shortIntensityUnit(data.preparedIntensityUnit)));
  }

  if (visibleLayers.has("peaks") && data.peaks?.length) {
    const peak = hoveredPeak ?? findPeakAtWavelength(data.peaks, wavelength, anchorDataset.wavelengths);
    if (peak) {
      rows.push(
        `<span><strong>Пик № ${(data.peaks?.indexOf(peak) ?? 0) + 1} · ${formatDecimal(peak.wavelength, 3)} нм</strong></span>`,
        formatTooltipRow(palette.peak, "Интенсивность", peak.intensity, 4, shortIntensityUnit(data.preparedIntensityUnit)),
        `<span>SNR: <strong>${Number.isFinite(peak.snr) ? formatDecimal(peak.snr, 2) : "∞"}</strong></span>`,
      );
    }
  }

  if (visibleLayers.has("referenceLines") && data.referenceLines?.length) {
    const reference = findReferenceLineAtWavelength(
      data.referenceLines,
      wavelength,
      anchorDataset.wavelengths,
    );
    if (reference) {
      if (reference.observedWavelength !== undefined) rows.push(`<span>Наблюдаемый пик: <strong>${formatDecimal(reference.observedWavelength, 3)} нм</strong> · Δ ${formatDecimal(reference.observedWavelength - reference.wavelength, 3)} нм</span>`);
      rows.push(formatTooltipTextRow(
        palette.reference,
        "Справочная линия",
        `${escapeHtml(reference.label)} · ${formatWavelength(reference.wavelength)} нм`,
      ));
    }
  }

  if (visibleLayers.has("missingReferenceLines") && data.missingReferenceLines?.length) {
    const reference = findReferenceLineAtWavelength(data.missingReferenceLines, wavelength, anchorDataset.wavelengths);
    if (reference) {
      rows.push(formatTooltipTextRow(
        palette.missingReference,
        "Характерная линия без найденного пика",
        `${escapeHtml(reference.label)} · ${formatWavelength(reference.wavelength)} нм`,
      ));
    }
  }

  return rows.join("<br>");
}

export function preserveZoomForSource(
  current: SpectrumZoomRange,
  previousSourceKey: string | undefined,
  nextSourceKey: string,
): SpectrumZoomRange {
  if (previousSourceKey === undefined || previousSourceKey === nextSourceKey) return current;
  return FULL_SPECTRUM_ZOOM;
}

export function readZoomRange(
  event: unknown,
  fallback: SpectrumZoomRange,
  extent?: readonly [number, number],
): SpectrumZoomRange {
  const candidate = getZoomEventCandidate(event);
  const span = extent ? extent[1] - extent[0] : 0;
  const startValue = toFiniteNumber(candidate?.startValue);
  const endValue = toFiniteNumber(candidate?.endValue);
  const start = toFiniteNumber(candidate?.start) ?? (extent && span > 0 && startValue !== null ? Math.max(0, (startValue - extent[0]) / span * 100) : null);
  const end = toFiniteNumber(candidate?.end) ?? (extent && span > 0 && endValue !== null ? Math.min(100, (endValue - extent[0]) / span * 100) : null);
  if (start === null || end === null || start < 0 || end > 100 || start >= end) return fallback;
  return { start, end };
}

function createYAxis(
  rawVisible: boolean,
  preparedRequired: boolean,
  dualAxis: boolean,
  palette: SpectrumChartPalette,
  rawIntensityUnit: SpectrumChartData["rawIntensityUnit"],
  data: SpectrumChartData,
): EChartsCoreOption["yAxis"] {
  const rawExponent = intensityExponent(data.rawDataset ?? data.baselineDataset);
  const preparedExponent = intensityExponent(data.preparedDataset);
  const multiplier = (exponent: number) => exponent ? ` · ×10${String(exponent).replace(/[-0-9]/g, (digit) => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(digit)])}` : "";
  const rawAxis = {
    type: "value" as const,
    name: rawIntensityLabel(rawIntensityUnit) + multiplier(rawExponent),
    position: "left" as const,
    nameTextStyle: { color: palette.text, fontSize: 11, align: "left" },
    axisLabel: { color: palette.raw, fontSize: 12, formatter: (value: number) => formatIntensityTick(value / 10 ** rawExponent) },
    axisLine: { show: true, lineStyle: { color: palette.raw, opacity: 0.7 } },
    splitLine: { lineStyle: { color: palette.border, opacity: 0.34 } },
    scale: true,
  };
  const preparedAxis = {
    type: "value" as const,
    name: "Подготовленная интенсивность" + multiplier(preparedExponent),
    position: dualAxis ? "right" as const : "left" as const,
    nameTextStyle: { color: palette.text, fontSize: 11, align: dualAxis ? "right" : "left" },
    axisLabel: { color: palette.prepared, fontSize: 12, formatter: (value: number) => formatIntensityTick(value / 10 ** preparedExponent) },
    axisLine: { show: true, lineStyle: { color: palette.prepared, opacity: 0.8 } },
    splitLine: { lineStyle: { color: palette.border, opacity: dualAxis ? 0 : 0.34 } },
    scale: true,
  };

  if (rawVisible && preparedRequired) return [rawAxis, preparedAxis];
  if (rawVisible) return rawAxis;
  return preparedAxis;
}

export function getWavelengthExtent(data: SpectrumChartData): readonly [number, number] {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const wavelengths of [data.rawDataset?.wavelengths, data.baselineDataset?.wavelengths, data.preparedDataset?.wavelengths]) {
    if (!wavelengths) continue;
    for (const value of wavelengths) {
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }
  return Number.isFinite(minimum) ? [minimum, maximum] : [0, 1];
}

function toSeriesData(dataset: SpectrumDataset): readonly (readonly [number, number])[] {
  return dataset.wavelengths.map((wavelength, index) => [wavelength, dataset.intensities[index]]);
}

function getTooltipWavelength(parameters: unknown): number | null {
  const first = Array.isArray(parameters) ? parameters[0] : parameters;
  if (!first || typeof first !== "object") return null;
  const parameter = first as { readonly axisValue?: unknown; readonly value?: unknown };
  const coordinates = Array.isArray(parameter.value) ? parameter.value : [];
  return toFiniteNumber(parameter.axisValue) ?? toFiniteNumber(coordinates[0]);
}

function findNearestSampleIndex(wavelengths: readonly number[], target: number): number {
  if (isSortedAscending(wavelengths)) {
    const insertion = lowerBound(wavelengths, target);
    if (insertion <= 0) return 0;
    if (insertion >= wavelengths.length) return wavelengths.length - 1;
    return target - wavelengths[insertion - 1] <= wavelengths[insertion] - target
      ? insertion - 1
      : insertion;
  }
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  wavelengths.forEach((wavelength, index) => {
    const distance = Math.abs(wavelength - target);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

function findPeakAtWavelength(
  peaks: readonly AnalyzedPeak[],
  wavelength: number,
  wavelengths: readonly number[],
): AnalyzedPeak | undefined {
  const tolerance = Math.max(getMedianStep(wavelengths) * 0.55, 1e-7);
  return peaks.reduce<AnalyzedPeak | undefined>((nearest, peak) => {
    const distance = Math.abs(peak.wavelength - wavelength);
    if (distance > tolerance) return nearest;
    return !nearest || distance < Math.abs(nearest.wavelength - wavelength) ? peak : nearest;
  }, undefined);
}

function findReferenceLineAtWavelength(
  lines: readonly SpectrumReferenceLine[],
  wavelength: number,
  wavelengths: readonly number[],
): SpectrumReferenceLine | undefined {
  const tolerance = Math.max(getMedianStep(wavelengths) * 0.75, 1e-7);
  return lines.reduce<SpectrumReferenceLine | undefined>((nearest, line) => {
    const distance = Math.abs(line.wavelength - wavelength);
    if (distance > tolerance) return nearest;
    return !nearest || distance < Math.abs(nearest.wavelength - wavelength) ? line : nearest;
  }, undefined);
}

function getMedianStep(wavelengths: readonly number[]): number {
  if (wavelengths.length < 2) return 0;
  const cached = medianStepCache.get(wavelengths);
  if (cached !== undefined) return cached;
  const steps = wavelengths
    .slice(1)
    .map((wavelength, index) => Math.abs(wavelength - wavelengths[index]))
    .filter((step) => step > 0)
    .sort((left, right) => left - right);
  const result = steps[Math.floor(steps.length / 2)] ?? 0;
  medianStepCache.set(wavelengths, result);
  return result;
}

function isSortedAscending(values: readonly number[]): boolean {
  const cached = sortedWavelengthCache.get(values);
  if (cached !== undefined) return cached;
  const sorted = values.every((value, index) => index === 0 || value >= values[index - 1]);
  sortedWavelengthCache.set(values, sorted);
  return sorted;
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

function formatTooltipRow(color: string, label: string, value: number, precision: number, unit: string): string {
  const magnitude = Math.abs(value);
  const formatted = Number.isFinite(value) && (magnitude >= 100_000 || (magnitude > 0 && magnitude < 0.001))
    ? (() => {
        const [mantissa, exponent] = value.toExponential(2).split("e");
        return `${Number(mantissa).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} × 10<sup>${Number(exponent)}</sup>`;
      })()
    : Number.isFinite(value) ? value.toLocaleString("ru-RU", { maximumFractionDigits: precision, useGrouping: false }) : value === Infinity ? "∞" : value === -Infinity ? "−∞" : "—";
  return formatTooltipTextRow(color, label, `${formatted}${unit ? ` <span style="font-weight:400">${escapeHtml(unit)}</span>` : ""}`);
}

function shortIntensityUnit(unit: SpectrumChartData["preparedIntensityUnit"]): string {
  return unit === "отсчёты прибора" ? "отсч." : unit === "доля максимума" ? "доля макс." : unit ?? "отн. ед.";
}

function formatTooltipTextRow(color: string, label: string, value: string): string {
  return `<span style="display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;background:${escapeHtml(color)}"></span>${escapeHtml(label)}: <strong>${value}</strong>`;
}

function formatWavelength(value: number): string {
  return formatDecimal(value, 3);
}

function getZoomEventCandidate(event: unknown): { readonly start?: unknown; readonly end?: unknown; readonly startValue?: unknown; readonly endValue?: unknown } | undefined {
  if (!event || typeof event !== "object") return undefined;
  const value = event as {
    readonly start?: unknown;
    readonly end?: unknown;
    readonly startValue?: unknown;
    readonly endValue?: unknown;
    readonly batch?: readonly { readonly start?: unknown; readonly end?: unknown; readonly startValue?: unknown; readonly endValue?: unknown }[];
  };
  return value.batch?.[0] ?? value;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

function withAlpha(color: string, alpha: number): string {
  const hex = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/iu);
  if (!hex) return color;
  return `rgba(${Number.parseInt(hex[1], 16)}, ${Number.parseInt(hex[2], 16)}, ${Number.parseInt(hex[3], 16)}, ${alpha})`;
}

function rawIntensityLabel(unit: SpectrumChartData["rawIntensityUnit"]): string {
  return unit ? `Интенсивность, ${unit}` : "Интенсивность";
}

/** Compact axis labels only; tooltips retain the measurement precision. */
export function formatIntensityTick(value: number): string {
  const magnitude = Math.abs(value);
  return magnitude >= 1_000_000 || (magnitude > 0 && magnitude < 0.001)
    ? value.toExponential(1).replace("e+", "e").replace(".", ",")
    : Number(value.toPrecision(5)).toLocaleString("ru-RU", { maximumFractionDigits: 8, useGrouping: false });
}

export function formatWavelengthTick(value: number, visibleSpan: number): string {
  const precision = Math.min(6, Math.max(0, 2 - Math.floor(Math.log10(Math.max(visibleSpan, 1e-6)))));
  return value.toLocaleString("ru-RU", { maximumFractionDigits: precision, useGrouping: false });
}

function intensityExponent(dataset?: SpectrumDataset): number {
  let maximum = 0;
  for (const value of dataset?.intensities ?? []) if (Number.isFinite(value)) maximum = Math.max(maximum, Math.abs(value));
  return maximum >= 10_000 || (maximum > 0 && maximum < 0.001) ? Math.floor(Math.log10(maximum)) : 0;
}
