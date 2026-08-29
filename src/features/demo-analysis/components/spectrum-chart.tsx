"use client";

import { LineChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { init, use as registerCharts } from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

import type { MatchedPeak, SpectrumDataset } from "@/domain/spectrum";

import styles from "./analysis-page.module.css";

registerCharts([LineChart, ScatterChart, GridComponent, MarkLineComponent, TooltipComponent, CanvasRenderer]);

interface ReferenceLine {
  readonly label: string;
  readonly wavelength: number;
}

interface SpectrumChartProps {
  readonly dataset: SpectrumDataset;
  readonly label: string;
  readonly peaks?: readonly MatchedPeak[];
  readonly threshold?: number;
  readonly referenceLines?: readonly ReferenceLine[];
  readonly compact?: boolean;
  readonly fill?: boolean;
}

interface TooltipParameter {
  readonly axisValue?: unknown;
  readonly value?: unknown;
}

export function SpectrumChart({
  dataset,
  label,
  peaks = [],
  threshold,
  referenceLines = [],
  compact = false,
  fill = false,
}: SpectrumChartProps) {
  const chartElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartElement.current) return;

    const chart = init(chartElement.current, undefined, { renderer: "canvas" });
    chart.setOption(createOption(dataset, peaks, threshold, referenceLines));
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(chartElement.current);

    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [dataset, peaks, referenceLines, threshold]);

  return (
    <div
      ref={chartElement}
      className={fill ? styles.chartFill : compact ? styles.chartCompact : styles.chart}
      role="img"
      aria-label={label}
    />
  );
}

function createOption(
  dataset: SpectrumDataset,
  peaks: readonly MatchedPeak[],
  threshold: number | undefined,
  referenceLines: readonly ReferenceLine[],
): EChartsCoreOption {
  const rootStyles = getComputedStyle(document.documentElement);
  const primary = rootStyles.getPropertyValue("--color-action-primary").trim() || "#4a6fa5";
  const success = rootStyles.getPropertyValue("--color-status-success").trim() || "#2b8a3e";
  const warning = rootStyles.getPropertyValue("--color-status-warning").trim() || "#b86800";
  const text = rootStyles.getPropertyValue("--color-text-secondary").trim() || "#546273";
  const border = rootStyles.getPropertyValue("--color-border-default").trim() || "#dce0e5";
  const data = dataset.wavelengths.map((wavelength, index) => [wavelength, dataset.intensities[index]]);
  const markLineData = [
    ...(threshold === undefined
      ? []
      : [{
          name: `Порог ${threshold.toFixed(2)}`,
          yAxis: threshold,
          lineStyle: { color: warning, type: "dashed" as const },
          label: { color: warning, formatter: "Порог {c}" },
        }]),
    ...referenceLines.map((line) => ({
      name: line.label,
      xAxis: line.wavelength,
      lineStyle: { color: primary, opacity: 0.46, type: "dashed" as const },
      label: { color: primary, formatter: line.label, position: "insideEndTop" as const },
    })),
  ];

  return {
    animation: false,
    grid: { left: 54, right: 18, top: 22, bottom: 38 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", snap: true },
      formatter: (parameters: unknown) => formatTooltip(parameters, dataset, peaks, primary, success),
    },
    xAxis: {
      type: "value",
      name: "Длина волны, нм",
      nameLocation: "middle",
      nameGap: 27,
      min: dataset.wavelengths[0],
      max: dataset.wavelengths.at(-1),
      axisLabel: { color: text, fontSize: 11 },
      axisLine: { lineStyle: { color: border } },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: text, fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: border, opacity: 0.58 } },
    },
    series: [
      {
        type: "line",
        data,
        showSymbol: false,
        sampling: "lttb",
        lineStyle: { color: primary, width: 1.5 },
        itemStyle: { color: primary },
        markLine: markLineData.length
          ? { silent: true, symbol: ["none", "none"], data: markLineData }
          : undefined,
      },
      ...(peaks.length
        ? [{
            type: "scatter" as const,
            name: "Пик",
            data: peaks.map((peak) => [peak.wavelength, peak.intensity]),
            symbolSize: 8,
            itemStyle: { color: success, borderColor: "#ffffff", borderWidth: 1.5 },
            z: 4,
          }]
        : []),
    ],
  };
}

function formatTooltip(
  parameters: unknown,
  dataset: SpectrumDataset,
  peaks: readonly MatchedPeak[],
  signalColor: string,
  peakColor: string,
): string {
  const parameter = (Array.isArray(parameters) ? parameters[0] : parameters) as TooltipParameter | undefined;
  const coordinates = Array.isArray(parameter?.value) ? parameter.value : [];
  const wavelength = toFiniteNumber(parameter?.axisValue) ?? toFiniteNumber(coordinates[0]);

  if (wavelength === null) return "";

  const sampleIndex = findNearestSampleIndex(dataset.wavelengths, wavelength);
  const sampleWavelength = dataset.wavelengths[sampleIndex];
  const peak = peaks.find((candidate) => candidate.wavelength === sampleWavelength);
  const intensity = peak?.intensity ?? dataset.intensities[sampleIndex];
  const color = peak ? peakColor : signalColor;

  return [
    `<strong>${sampleWavelength.toFixed(2)} нм</strong>`,
    `<span style="display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;background:${color}"></span>${intensity.toFixed(3)}`,
  ].join("<br>");
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

function toFiniteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
