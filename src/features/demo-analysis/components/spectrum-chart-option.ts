import type { EChartsCoreOption } from "echarts/core";

import type { AnalyzedPeak, SpectrumDataset } from "@/domain/spectrum";
import { formatDecimal, formatSignedDecimal } from "@/features/workspace/model/display-format";

export type SpectrumChartLayer = "raw" | "prepared" | "threshold" | "peaks" | "referenceLines" | "missingReferenceLines" | "regions";

export interface SpectrumReferenceLine {
  readonly label: string;
  readonly wavelength: number;
}

export interface SpectrumHighlightedRegion {
  readonly label: string;
  readonly minimum: number;
  readonly maximum: number;
}

export interface SpectrumChartData {
  readonly rawDataset?: SpectrumDataset;
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

export const SPECTRUM_SERIES_NAMES = {
  raw: "Исходный спектр",
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
): EChartsCoreOption {
  const rawVisible = visibleLayers.has("raw") && Boolean(data.rawDataset);
  const preparedVisible = visibleLayers.has("prepared") && Boolean(data.preparedDataset);
  const thresholdVisible = visibleLayers.has("threshold") && Boolean(data.thresholdDataset);
  const peaksVisible = visibleLayers.has("peaks") && data.peaks !== undefined;
  const referenceLinesVisible = visibleLayers.has("referenceLines") && data.referenceLines !== undefined;
  const missingReferenceLinesVisible = visibleLayers.has("missingReferenceLines") && data.missingReferenceLines !== undefined;
  const regionsVisible = visibleLayers.has("regions") && data.highlightedRegions !== undefined;
  const preparedAxisRequired = preparedVisible || thresholdVisible || peaksVisible || referenceLinesVisible || missingReferenceLinesVisible || regionsVisible;
  const dualAxis = rawVisible && preparedAxisRequired;
  const preparedAxisIndex = dualAxis ? 1 : 0;
  const [minimumWavelength, maximumWavelength] = getWavelengthExtent(data);
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
      lineStyle: { color: palette.raw, width: preparedVisible ? 1.1 : 1.6, opacity: preparedVisible ? 0.62 : 0.9 },
      itemStyle: { color: palette.raw },
      emphasis: { lineStyle: { opacity: 0.8 } },
      z: 1,
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
      lineStyle: { color: palette.threshold, width: 1.25, type: "dashed" },
      z: 2,
    });
  }

  if (peaksVisible && data.peaks) {
    series.push({
      id: "detected-peaks",
      name: SPECTRUM_SERIES_NAMES.peaks,
      type: "scatter",
      data: data.peaks.map((peak) => {
        const selected = peak.id === data.selectedPeakId;
        return {
          id: peak.id,
          value: [peak.wavelength, peak.intensity],
          symbol: selected ? "diamond" : "circle",
          symbolSize: selected ? 13 : 8,
          itemStyle: selected
            ? {
                color: palette.peak,
                borderColor: palette.reference,
                borderWidth: 3,
                shadowBlur: 5,
                shadowColor: withAlpha(palette.reference, 0.35),
              }
            : undefined,
        };
      }),
      yAxisIndex: preparedAxisIndex,
      symbolSize: 8,
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
      silent: true,
      lineStyle: { opacity: 0 },
      markLine: {
        silent: true,
        symbol: ["none", "none"],
        data: data.referenceLines.map((line) => ({
          name: line.label,
          xAxis: line.wavelength,
          lineStyle: { color: palette.reference, opacity: 0.72, type: "solid", width: 1.25 },
          label: {
            color: palette.reference,
            formatter: line.label,
            position: "insideEndTop",
            fontSize: 12,
          },
        })),
      },
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
      silent: true,
      lineStyle: { opacity: 0 },
      markLine: {
        silent: true,
        symbol: ["none", "none"],
        data: data.missingReferenceLines.map((line) => ({
          name: line.label,
          xAxis: line.wavelength,
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
        itemStyle: { color: withAlpha(palette.region, 0.12) },
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
      top: 30,
      bottom: 72,
    },
    tooltip: {
      trigger: "axis",
      confine: true,
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
      axisLabel: { color: palette.text, fontSize: 12 },
      axisLine: { lineStyle: { color: palette.border } },
      splitLine: { show: false },
    },
    yAxis: createYAxis(rawVisible, preparedAxisRequired, dualAxis, palette),
    dataZoom: [
      {
        id: "spectrum-inside-zoom",
        type: "inside",
        xAxisIndex: 0,
        filterMode: "none",
        start: zoom.start,
        end: zoom.end,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
      },
      {
        id: "spectrum-slider-zoom",
        type: "slider",
        xAxisIndex: 0,
        filterMode: "none",
        start: zoom.start,
        end: zoom.end,
        height: 18,
        bottom: 8,
        borderColor: palette.border,
        backgroundColor: palette.surface,
        fillerColor: withAlpha(palette.prepared, 0.12),
        handleStyle: { color: palette.prepared, borderColor: palette.prepared },
        moveHandleStyle: { color: palette.prepared },
        textStyle: { color: palette.text, fontSize: 12 },
        showDetail: false,
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
  const wavelength = anchorDataset.wavelengths[anchorIndex];
  const rows = [`<strong>${formatWavelength(wavelength)} нм</strong>`];

  if (visibleLayers.has("raw") && data.rawDataset) {
    const index = findNearestSampleIndex(data.rawDataset.wavelengths, wavelength);
    rows.push(formatTooltipRow(palette.raw, "Исходные отсчёты", data.rawDataset.intensities[index], 3));
  }

  if (visibleLayers.has("prepared") && data.preparedDataset) {
    const index = findNearestSampleIndex(data.preparedDataset.wavelengths, wavelength);
    rows.push(formatTooltipRow(palette.prepared, "Подготовленная интенсивность", data.preparedDataset.intensities[index], 4));
  }

  if (visibleLayers.has("threshold") && data.thresholdDataset) {
    const index = findNearestSampleIndex(data.thresholdDataset.wavelengths, wavelength);
    rows.push(formatTooltipRow(palette.threshold, "Локальный порог", data.thresholdDataset.intensities[index], 4));
  }

  if (visibleLayers.has("peaks") && data.peaks?.length) {
    const peak = findPeakAtWavelength(data.peaks, wavelength, anchorDataset.wavelengths);
    if (peak) {
      rows.push(
        "<span><strong>Найденный пик</strong></span>",
        formatTooltipRow(palette.peak, "Интенсивность", peak.intensity, 4),
        `<span>Выраженность: <strong>${formatDecimal(peak.prominence, 4)}</strong></span>`,
        `<span>SNR: <strong>${Number.isFinite(peak.snr) ? formatDecimal(peak.snr, 2) : "∞"}</strong></span>`,
        `<span>Ширина: <strong>${formatDecimal(peak.widthNm, 3)} нм</strong></span>`,
        `<span>Ближайший кандидат: <strong>${formatPeakMatch(peak)}</strong></span>`,
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
): SpectrumZoomRange {
  const candidate = getZoomEventCandidate(event);
  const start = toFiniteNumber(candidate?.start);
  const end = toFiniteNumber(candidate?.end);
  if (start === null || end === null || start < 0 || end > 100 || start >= end) return fallback;
  return { start, end };
}

function createYAxis(
  rawVisible: boolean,
  preparedRequired: boolean,
  dualAxis: boolean,
  palette: SpectrumChartPalette,
): EChartsCoreOption["yAxis"] {
  const rawAxis = {
    type: "value" as const,
    name: "Исходные отсчёты",
    position: "left" as const,
    nameTextStyle: { color: palette.raw, fontSize: 12, fontWeight: 600 },
    axisLabel: { color: palette.raw, fontSize: 12 },
    axisLine: { show: true, lineStyle: { color: palette.raw, opacity: 0.7 } },
    splitLine: { lineStyle: { color: palette.border, opacity: 0.34 } },
    scale: true,
  };
  const preparedAxis = {
    type: "value" as const,
    name: "Подготовленная интенсивность",
    position: dualAxis ? "right" as const : "left" as const,
    nameTextStyle: { color: palette.prepared, fontSize: 12, fontWeight: 600 },
    axisLabel: { color: palette.prepared, fontSize: 12 },
    axisLine: { show: true, lineStyle: { color: palette.prepared, opacity: 0.8 } },
    splitLine: { lineStyle: { color: palette.border, opacity: dualAxis ? 0 : 0.34 } },
    scale: true,
  };

  if (rawVisible && preparedRequired) return [rawAxis, preparedAxis];
  if (rawVisible) return rawAxis;
  return preparedAxis;
}

function getWavelengthExtent(data: SpectrumChartData): readonly [number, number] {
  const wavelengths = [
    ...(data.rawDataset?.wavelengths ?? []),
    ...(data.preparedDataset?.wavelengths ?? []),
  ];
  if (!wavelengths.length) return [0, 1];
  return [Math.min(...wavelengths), Math.max(...wavelengths)];
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
  const steps = wavelengths
    .slice(1)
    .map((wavelength, index) => Math.abs(wavelength - wavelengths[index]))
    .filter((step) => step > 0)
    .sort((left, right) => left - right);
  return steps[Math.floor(steps.length / 2)] ?? 0;
}

function formatTooltipRow(color: string, label: string, value: number, precision: number): string {
  return formatTooltipTextRow(color, label, formatDecimal(value, precision));
}

function formatTooltipTextRow(color: string, label: string, value: string): string {
  return `<span style="display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;background:${escapeHtml(color)}"></span>${escapeHtml(label)}: <strong>${value}</strong>`;
}

function formatPeakMatch(peak: AnalyzedPeak): string {
  if (!peak.match) return "нет";
  const label = peak.match.ionizationLabel
    ? `${peak.match.elementSymbol} ${peak.match.ionizationLabel}`
    : peak.match.elementSymbol;
  return `${escapeHtml(label)} · ${formatWavelength(peak.match.line)} нм (${formatSignedDelta(peak.match.delta)} нм)`;
}

function formatSignedDelta(value: number): string {
  return `Δ ${formatSignedDecimal(value, 3)}`;
}

function formatWavelength(value: number): string {
  return formatDecimal(value, 2);
}

function getZoomEventCandidate(event: unknown): { readonly start?: unknown; readonly end?: unknown } | undefined {
  if (!event || typeof event !== "object") return undefined;
  const value = event as {
    readonly start?: unknown;
    readonly end?: unknown;
    readonly batch?: readonly { readonly start?: unknown; readonly end?: unknown }[];
  };
  return value.batch?.[0] ?? value;
}

function toFiniteNumber(value: unknown): number | null {
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
