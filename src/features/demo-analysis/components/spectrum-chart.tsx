"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";

import { LineChart, ScatterChart } from "echarts/charts";
import {
  ToolboxComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { init, use as registerCharts } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { RotateCcw, ScanLine, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { AnalyzedPeak, SpectrumDataset } from "@/domain/spectrum";

import styles from "./analysis-page.module.css";
import {
  createSpectrumChartOption,
  FULL_SPECTRUM_ZOOM,
  getWavelengthExtent,
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
  ToolboxComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  CanvasRenderer,
]);

const zoomRangesBySource = new Map<string, SpectrumZoomRange>();

export interface SpectrumChartProps {
  readonly preparedIntensityUnit?: SpectrumChartData["preparedIntensityUnit"];
  readonly rawIntensityUnit?: SpectrumChartData["rawIntensityUnit"];
  readonly rawDataset?: SpectrumDataset;
  readonly baselineDataset?: SpectrumDataset;
  readonly preparedDataset?: SpectrumDataset;
  readonly label: string;
  readonly sourceKey: string;
  readonly layerViewKey?: string;
  readonly defaultVisibleLayers: readonly SpectrumChartLayer[];
  readonly peaks?: readonly AnalyzedPeak[];
  readonly selectedPeakId?: string | null;
  readonly hoveredPeakId?: string | null;
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
  baseline: "Базовая линия",
  prepared: "Подготовленный",
  threshold: "Порог",
  peaks: "Пики",
  referenceLines: "Линии",
  missingReferenceLines: "Без пика",
  regions: "Области",
};

export function SpectrumChart({
  rawDataset,
  rawIntensityUnit,
  preparedIntensityUnit,
  baselineDataset,
  preparedDataset,
  label,
  sourceKey,
  defaultVisibleLayers,
  layerViewKey = "default",
  peaks,
  selectedPeakId,
  hoveredPeakId,
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
  const [selectingRange, setSelectingRange] = useState(() => isFullZoom(zoomRangesBySource.get(sourceKey) ?? FULL_SPECTRUM_ZOOM));
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false);
  const [rangeMinimum, setRangeMinimum] = useState("");
  const [rangeMaximum, setRangeMaximum] = useState("");
  const [rangeError, setRangeError] = useState("");
  const selectionActive = useRef(false);
  const optionInputs = useRef<{ chartData: SpectrumChartData; visibleLayers: ReadonlySet<SpectrumChartLayer> }>({ chartData: {}, visibleLayers: new Set() });
  const [layerSelections, setLayerSelections] = useState<Readonly<Record<string, ReadonlySet<SpectrumChartLayer>>>>({});
  const selectionKey = `${sourceKey}:${layerViewKey}`;
  const visibleLayers = useMemo(() => layerSelections[selectionKey] ?? new Set(defaultVisibleLayers), [defaultVisibleLayers, layerSelections, selectionKey]);
  const [isZoomed, setIsZoomed] = useState(() => !isFullZoom(zoomRangesBySource.get(sourceKey) ?? FULL_SPECTRUM_ZOOM));
  const chartData: SpectrumChartData = useMemo(() => ({
    rawDataset,
    rawIntensityUnit,
    preparedIntensityUnit,
    baselineDataset,
    preparedDataset,
    peaks,
    selectedPeakId,
    thresholdDataset,
    referenceLines,
    missingReferenceLines,
    highlightedRegions,
  }), [baselineDataset, highlightedRegions, missingReferenceLines, peaks, preparedDataset, preparedIntensityUnit, rawDataset, rawIntensityUnit, referenceLines, selectedPeakId, thresholdDataset]);
  const availableLayers = getAvailableLayers(chartData);

  useEffect(() => {
    onPeakSelectRef.current = onPeakSelect;
  }, [onPeakSelect]);

  useEffect(() => {
    if (!chartElement.current) return;

    const chart = init(chartElement.current, undefined, { renderer: "canvas" });
    chartInstance.current = chart;
    const handleDataZoom = (event: unknown) => {
      zoomRange.current = readZoomRange(event, zoomRange.current, getWavelengthExtent(optionInputs.current.chartData));
      zoomRangesBySource.set(activeSourceKey.current, zoomRange.current);
      setIsZoomed(!isFullZoom(zoomRange.current));
      const { chartData, visibleLayers } = optionInputs.current;
      const option = createSpectrumChartOption(chartData, visibleLayers, getChartPalette(), zoomRange.current, chartElement.current?.clientWidth);
      const full = isFullZoom(zoomRange.current);
      chart.setOption({ xAxis: option.xAxis, series: option.series, dataZoom: [{ id: "spectrum-inside-zoom", moveOnMouseMove: !full }] });
      if (selectionActive.current !== full) {
        selectionActive.current = full;
        setSelectingRange(full);
        chart.dispatchAction({ type: "takeGlobalCursor", key: "dataZoomSelect", dataZoomSelectActive: full });
      }
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
    optionInputs.current = { chartData, visibleLayers };
    chart.setOption(
      createSpectrumChartOption(chartData, visibleLayers, getChartPalette(), zoomRange.current, chartElement.current?.clientWidth),
      { replaceMerge: ["series", "yAxis", "dataZoom"] },
    );
    selectionActive.current = isFullZoom(zoomRange.current);
    setSelectingRange(selectionActive.current);
    chart.dispatchAction({ type: "takeGlobalCursor", key: "dataZoomSelect", dataZoomSelectActive: selectionActive.current });
  }, [chartData, sourceKey, visibleLayers]);

  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart || !visibleLayers.has("peaks")) return;
    chart.dispatchAction({ type: "downplay", seriesId: "detected-peaks" });
    const index = peaks?.findIndex((peak) => peak.id === hoveredPeakId) ?? -1;
    if (index >= 0) chart.dispatchAction({ type: "highlight", seriesId: "detected-peaks", dataIndex: index });
  }, [hoveredPeakId, peaks, sourceKey, visibleLayers, chartData]);

  const toggleLayer = (layer: SpectrumChartLayer) => {
    setLayerSelections((current) => {
      const next = new Set(current[selectionKey] ?? defaultVisibleLayers);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return { ...current, [selectionKey]: next };
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
    <div className={styles.chartWidget} onKeyDown={(event) => {
      if (event.key === "Escape" && selectionActive.current) {
        selectionActive.current = false;
        setSelectingRange(false);
        chartInstance.current?.dispatchAction({ type: "takeGlobalCursor", key: "dataZoomSelect", dataZoomSelectActive: false });
      }
    }}>
      <div className={`${styles.chartToolbar} ${showLayerControls ? "" : styles.chartToolbarEnd}`}>
        {showLayerControls ? (
          <div className={styles.layerToggles} role="group" aria-label="Слои графика">
            {availableLayers.map((layer) => {
              const active = visibleLayers.has(layer);
              return (
                <Button size="compact"
                  key={layer}
                  type="button"
                  className={styles.layerToggle}
                  aria-pressed={active}
                  onClick={() => toggleLayer(layer)}
                >
                  <span className={`${styles.layerSwatch} ${styles[`layerSwatch_${layer}`]}`} aria-hidden="true" />
                  <span>{layerLabels[layer]}</span>
                </Button>
              );
            })}
          </div>
        ) : null}
        <div className={styles.chartNavigation}>
          <Dialog.Root open={rangeDialogOpen} onOpenChange={(open) => {
            setRangeDialogOpen(open);
            if (open) {
              const [minimum, maximum] = getWavelengthExtent(chartData);
              const span = maximum - minimum;
              setRangeMinimum(String(Number((minimum + span * zoomRange.current.start / 100).toFixed(6))));
              setRangeMaximum(String(Number((minimum + span * zoomRange.current.end / 100).toFixed(6))));
              setRangeError("");
            }
          }}>
            <Dialog.Trigger asChild><Button size="compact">Диапазон…</Button></Dialog.Trigger>
            <Dialog.Portal><Dialog.Overlay className={`${styles.dialogOverlay} ${styles.referenceOverlay}`} />
              <Dialog.Content className={`${styles.referenceDialog} ${styles.chartRangeDialog}`} aria-describedby={undefined}>
                <div className={styles.referenceDialogHeader}><Dialog.Title>Видимый диапазон</Dialog.Title><Dialog.Close asChild><Button size="icon" aria-label="Закрыть диапазон"><X size={18} /></Button></Dialog.Close></div>
                <form className={styles.chartRangeForm} onSubmit={(event) => {
                  event.preventDefault();
                  const [minimum, maximum] = getWavelengthExtent(chartData);
                  const parsedFrom = Number(rangeMinimum.replace(",", "."));
                  const from = Math.abs(parsedFrom - minimum) < 1e-6 ? minimum : parsedFrom;
                  const parsedTo = Number(rangeMaximum.replace(",", "."));
                  const to = Math.abs(parsedTo - maximum) < 1e-6 ? maximum : parsedTo;
                  if (!rangeMinimum.trim() || !rangeMaximum.trim() || !Number.isFinite(from) || !Number.isFinite(to) || from >= to || from < minimum || to > maximum) {
                    setRangeError(`Укажите границы от ${minimum.toLocaleString("ru-RU")} до ${maximum.toLocaleString("ru-RU")} нм; начало должно быть меньше конца.`);
                    return;
                  }
                  chartInstance.current?.dispatchAction({ type: "dataZoom", start: (from - minimum) / (maximum - minimum) * 100, end: (to - minimum) / (maximum - minimum) * 100 });
                  setRangeDialogOpen(false);
                }}>
                  <p>Меняет только масштаб графика.</p>
                  <div className={styles.chartRangeFields}>
                    <label>От, нм<input inputMode="decimal" value={rangeMinimum} onChange={(event) => setRangeMinimum(event.target.value)} /></label>
                    <label>До, нм<input inputMode="decimal" value={rangeMaximum} onChange={(event) => setRangeMaximum(event.target.value)} /></label>
                  </div>
                  {rangeError ? <p role="alert">{rangeError}</p> : null}
                  <Button type="submit">Применить</Button>
                </form>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <Button size="compact" className={styles.graphToolButton} aria-label="Выделить участок" aria-pressed={selectingRange} onClick={() => {
            selectionActive.current = !selectionActive.current;
            setSelectingRange(selectionActive.current);
            chartInstance.current?.setOption({ dataZoom: [{ id: "spectrum-inside-zoom", moveOnMouseMove: !selectionActive.current && !isFullZoom(zoomRange.current) }] });
            chartInstance.current?.dispatchAction({ type: "takeGlobalCursor", key: "dataZoomSelect", dataZoomSelectActive: selectionActive.current });
          }} title="ЛКМ: в полном масштабе выделяет участок, после увеличения перемещает спектр. Эта кнопка включает повторное выделение. Двойной щелчок сбрасывает масштаб.">
            <ScanLine size={14} aria-hidden="true" /><span>Выделить участок</span>
          </Button>
        {showLayerControls || isZoomed ? (
          <Button size="compact" className={`${styles.zoomResetButton} ${styles.graphToolButton}`} aria-label="Сбросить масштаб" title="Сбросить масштаб" type="button" disabled={!isZoomed} onClick={resetZoom}>
            <RotateCcw size={14} aria-hidden="true" />
            <span>Сбросить масштаб</span>
          </Button>
        ) : null}
        </div>
      </div>
      <div
        onDoubleClick={resetZoom}
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
    ...(data.baselineDataset ? ["baseline" as const] : []),
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
    baseline: token("--color-data-series-3", "#9b6b43"),
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
