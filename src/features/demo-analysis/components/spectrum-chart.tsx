"use client";

import { LineChart, ScatterChart } from "echarts/charts";
import {
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { init, use as registerCharts } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { AnalyzedPeak, SpectrumDataset } from "@/domain/spectrum";

import styles from "./analysis-page.module.css";
import {
  createSpectrumChartOption,
  FULL_SPECTRUM_ZOOM,
  preserveZoomForSource,
  readZoomRange,
} from "./spectrum-chart-option";
import type {
  SpectrumChartData,
  SpectrumChartLayer,
  SpectrumChartPalette,
  SpectrumHighlightedRegion,
  SpectrumReferenceLine,
  SpectrumZoomRange,
} from "./spectrum-chart-option";

registerCharts([
  LineChart,
  ScatterChart,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  CanvasRenderer,
]);

const zoomRangesBySource = new Map<string, SpectrumZoomRange>();

export interface SpectrumChartProps {
  readonly rawDataset?: SpectrumDataset;
  readonly preparedDataset?: SpectrumDataset;
  readonly label: string;
  readonly sourceKey: string;
  readonly defaultVisibleLayers: readonly SpectrumChartLayer[];
  readonly peaks?: readonly AnalyzedPeak[];
  readonly selectedPeakId?: string | null;
  readonly onPeakSelect?: (peakId: string) => void;
  readonly thresholdDataset?: SpectrumDataset;
  readonly referenceLines?: readonly SpectrumReferenceLine[];
  readonly missingReferenceLines?: readonly SpectrumReferenceLine[];
  readonly highlightedRegions?: readonly SpectrumHighlightedRegion[];
  readonly showLayerControls?: boolean;
  readonly compact?: boolean;
  readonly fill?: boolean;
}

const layerLabels: Record<SpectrumChartLayer, string> = {
  raw: "Исходный",
  prepared: "Подготовленный",
  threshold: "Порог",
  peaks: "Пики",
  referenceLines: "Линии",
  missingReferenceLines: "Без пика",
  regions: "Области",
};

export function SpectrumChart({
  rawDataset,
  preparedDataset,
  label,
  sourceKey,
  defaultVisibleLayers,
  peaks,
  selectedPeakId,
  onPeakSelect,
  thresholdDataset,
  referenceLines,
  missingReferenceLines,
  highlightedRegions,
  showLayerControls = true,
  compact = false,
  fill = false,
}: SpectrumChartProps) {
  const chartElement = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ReturnType<typeof init> | null>(null);
  const previousSourceKey = useRef<string | undefined>(undefined);
  const zoomRange = useRef<SpectrumZoomRange>(zoomRangesBySource.get(sourceKey) ?? FULL_SPECTRUM_ZOOM);
  const activeSourceKey = useRef(sourceKey);
  const onPeakSelectRef = useRef(onPeakSelect);
  const [visibleLayers, setVisibleLayers] = useState<ReadonlySet<SpectrumChartLayer>>(
    () => new Set(defaultVisibleLayers),
  );
  const [isZoomed, setIsZoomed] = useState(() => !isFullZoom(zoomRangesBySource.get(sourceKey) ?? FULL_SPECTRUM_ZOOM));
  const chartData: SpectrumChartData = useMemo(() => ({
    rawDataset,
    preparedDataset,
    peaks,
    selectedPeakId,
    thresholdDataset,
    referenceLines,
    missingReferenceLines,
    highlightedRegions,
  }), [highlightedRegions, missingReferenceLines, peaks, preparedDataset, rawDataset, referenceLines, selectedPeakId, thresholdDataset]);
  const availableLayers = getAvailableLayers(chartData);

  useEffect(() => {
    onPeakSelectRef.current = onPeakSelect;
  }, [onPeakSelect]);

  useEffect(() => {
    if (!chartElement.current) return;

    const chart = init(chartElement.current, undefined, { renderer: "canvas" });
    chartInstance.current = chart;
    const handleDataZoom = (event: unknown) => {
      zoomRange.current = readZoomRange(event, zoomRange.current);
      zoomRangesBySource.set(activeSourceKey.current, zoomRange.current);
      setIsZoomed(!isFullZoom(zoomRange.current));
    };
    const handleChartClick = (event: unknown) => {
      const peakId = getPeakIdFromChartEvent(event);
      if (peakId) onPeakSelectRef.current?.(peakId);
    };
    chart.on("datazoom", handleDataZoom);
    chart.on("click", handleChartClick);

    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => chart.resize());
    observer?.observe(chartElement.current);

    return () => {
      observer?.disconnect();
      chart.off("datazoom", handleDataZoom);
      chart.off("click", handleChartClick);
      chart.dispose();
      chartInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart) return;

    zoomRange.current = previousSourceKey.current && previousSourceKey.current !== sourceKey
      ? zoomRangesBySource.get(sourceKey) ?? FULL_SPECTRUM_ZOOM
      : preserveZoomForSource(zoomRange.current, previousSourceKey.current, sourceKey);
    previousSourceKey.current = sourceKey;
    activeSourceKey.current = sourceKey;
    setIsZoomed(!isFullZoom(zoomRange.current));
    chart.setOption(
      createSpectrumChartOption(chartData, visibleLayers, getChartPalette(), zoomRange.current),
      { replaceMerge: ["series", "yAxis", "dataZoom"] },
    );
  }, [chartData, sourceKey, visibleLayers]);

  const toggleLayer = (layer: SpectrumChartLayer) => {
    setVisibleLayers((current) => {
      const next = new Set(current);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  const resetZoom = () => {
    zoomRange.current = FULL_SPECTRUM_ZOOM;
    zoomRangesBySource.set(activeSourceKey.current, FULL_SPECTRUM_ZOOM);
    setIsZoomed(false);
    chartInstance.current?.dispatchAction({
      type: "dataZoom",
      start: FULL_SPECTRUM_ZOOM.start,
      end: FULL_SPECTRUM_ZOOM.end,
    });
  };

  return (
    <div className={styles.chartWidget}>
      <div className={`${styles.chartToolbar} ${showLayerControls ? "" : styles.chartToolbarEnd}`}>
        {showLayerControls ? (
          <div className={styles.layerToggles} role="group" aria-label="Слои графика">
            {availableLayers.map((layer) => {
              const active = visibleLayers.has(layer);
              return (
                <button
                  key={layer}
                  type="button"
                  className={`${styles.layerToggle} ${active ? styles.layerToggleActive : ""}`}
                  aria-pressed={active}
                  onClick={() => toggleLayer(layer)}
                >
                  <span className={`${styles.layerSwatch} ${styles[`layerSwatch_${layer}`]}`} aria-hidden="true" />
                  <span>{layerLabels[layer]}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        {isZoomed ? (
          <button className={styles.zoomResetButton} type="button" onClick={resetZoom}>
            <RotateCcw size={14} aria-hidden="true" />
            <span>Сбросить масштаб</span>
          </button>
        ) : null}
      </div>
      <div
        ref={chartElement}
        className={fill ? styles.chartFill : compact ? styles.chartCompact : styles.chart}
        role="img"
        aria-label={label}
      />
    </div>
  );
}

function isFullZoom(range: SpectrumZoomRange): boolean {
  return range.start <= FULL_SPECTRUM_ZOOM.start && range.end >= FULL_SPECTRUM_ZOOM.end;
}

function getPeakIdFromChartEvent(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const candidate = event as {
    readonly seriesId?: unknown;
    readonly data?: { readonly id?: unknown };
  };
  return candidate.seriesId === "detected-peaks" && typeof candidate.data?.id === "string"
    ? candidate.data.id
    : null;
}

function getAvailableLayers(data: SpectrumChartData): readonly SpectrumChartLayer[] {
  return [
    ...(data.rawDataset ? ["raw" as const] : []),
    ...(data.preparedDataset ? ["prepared" as const] : []),
    ...(data.thresholdDataset ? ["threshold" as const] : []),
    ...(data.peaks !== undefined ? ["peaks" as const] : []),
    ...(data.referenceLines !== undefined ? ["referenceLines" as const] : []),
    ...(data.missingReferenceLines !== undefined ? ["missingReferenceLines" as const] : []),
    ...(data.highlightedRegions !== undefined ? ["regions" as const] : []),
  ];
}

function getChartPalette(): SpectrumChartPalette {
  const rootStyles = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => (
    rootStyles.getPropertyValue(name).trim() || fallback
  );

  return {
    raw: token("--color-data-series-2", "#0ea5c2"),
    prepared: token("--color-action-primary", "#4a6fa5"),
    peak: token("--color-status-success", "#2b8a3e"),
    threshold: token("--color-status-warning", "#b86800"),
    reference: token("--color-data-series-1", "#5856d6"),
    missingReference: token("--color-text-secondary", "#8a96a3"),
    region: token("--color-data-series-1", "#5856d6"),
    text: token("--color-text-secondary", "#546273"),
    border: token("--color-border-default", "#dce0e5"),
    surface: token("--color-background-surface", "#ffffff"),
  };
}
