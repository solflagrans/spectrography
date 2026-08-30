// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalyzedPeak, SpectrumDataset } from "@/domain/spectrum";

import { SpectrumChart } from "./spectrum-chart";
import {
  createSpectrumChartOption,
  formatSpectrumTooltip,
  FULL_SPECTRUM_ZOOM,
  preserveZoomForSource,
  readZoomRange,
} from "./spectrum-chart-option";
import type {
  SpectrumChartPalette,
  SpectrumZoomRange,
} from "./spectrum-chart-option";

const echartsMock = vi.hoisted(() => {
  const events = new Map<string, (event: unknown) => void>();
  const chart = {
    setOption: vi.fn(),
    dispatchAction: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    on: vi.fn((name: string, handler: (event: unknown) => void) => events.set(name, handler)),
    off: vi.fn((name: string) => events.delete(name)),
  };
  return { chart, events, init: vi.fn(() => chart), use: vi.fn() };
});

vi.mock("echarts/core", () => ({ init: echartsMock.init, use: echartsMock.use }));
vi.mock("echarts/charts", () => ({ LineChart: {}, ScatterChart: {} }));
vi.mock("echarts/components", () => ({
  DataZoomInsideComponent: {},
  DataZoomSliderComponent: {},
  GridComponent: {},
  MarkLineComponent: {},
  TooltipComponent: {},
}));
vi.mock("echarts/renderers", () => ({ CanvasRenderer: {} }));

const rawDataset: SpectrumDataset = {
  wavelengths: [400, 401, 402],
  intensities: [120, 240, 180],
};
const preparedDataset: SpectrumDataset = {
  wavelengths: [400, 401, 402],
  intensities: [0.1, 0.8, 0.3],
};
const match = {
  lineId: "nist-fe-i-40105",
  elementSymbol: "Fe",
  elementName: "Железо",
  ionizationStage: 1,
  ionizationLabel: "I",
  line: 401.05,
  wavelengthType: "observed" as const,
  wavelengthMedium: "air" as const,
  delta: -0.05,
};
const peak: AnalyzedPeak = {
  id: "peak-point-2",
  sourceIndex: 1,
  index: 1,
  wavelength: 401,
  intensity: 0.8,
  prominence: 0.62,
  candidates: [match],
  match,
};
const palette: SpectrumChartPalette = {
  raw: "#0ea5c2",
  prepared: "#4a6fa5",
  peak: "#2b8a3e",
  threshold: "#b86800",
  reference: "#5856d6",
  text: "#546273",
  border: "#dce0e5",
  surface: "#ffffff",
};

afterEach(() => {
  cleanup();
  echartsMock.events.clear();
  for (const mock of Object.values(echartsMock.chart)) {
    if (typeof mock === "function" && "mockClear" in mock) mock.mockClear();
  }
  echartsMock.init.mockClear();
});

describe("spectrum chart configuration", () => {
  it("builds only visible layers and links simultaneous signals to two labelled axes", () => {
    const option = createSpectrumChartOption(
      { rawDataset, preparedDataset, peaks: [peak], selectedPeakId: peak.id, threshold: 0.15 },
      new Set(["raw", "prepared", "threshold", "peaks"]),
      palette,
      FULL_SPECTRUM_ZOOM,
    );
    const axes = option.yAxis as Array<{ name: string; position: string }>;
    const series = option.series as Array<{
      name: string;
      yAxisIndex: number;
      lineStyle?: { opacity?: number; type?: string; width?: number };
      itemStyle?: { color?: string };
      data?: Array<{ id?: string; symbolSize?: number }>;
    }>;

    expect(axes.map((axis) => [axis.name, axis.position])).toEqual([
      ["Исходные отсчёты", "left"],
      ["Подготовленная интенсивность", "right"],
    ]);
    expect(series.map((item) => item.name)).toEqual([
      "Исходный спектр",
      "Подготовленный спектр",
      "Порог обнаружения",
      "Найденные пики",
    ]);
    expect(series[0]).toMatchObject({ yAxisIndex: 0, lineStyle: { width: 1, opacity: 0.52 } });
    expect(series[1]).toMatchObject({ yAxisIndex: 1, lineStyle: { width: 1.8 } });
    expect(series[2]).toMatchObject({ yAxisIndex: 1, lineStyle: { type: "dashed" } });
    expect(series[3]).toMatchObject({ yAxisIndex: 1, itemStyle: { color: palette.peak } });
    expect(series[3].data?.[0]).toMatchObject({ id: peak.id, symbolSize: 13 });
  });

  it("keeps reference lines independent from the prepared curve", () => {
    const option = createSpectrumChartOption(
      {
        preparedDataset,
        referenceLines: [{ label: "Fe 401.05", wavelength: 401.05 }],
      },
      new Set(["referenceLines"]),
      palette,
      FULL_SPECTRUM_ZOOM,
    );
    const series = option.series as Array<{
      name: string;
      markLine?: { data?: Array<{ name: string; xAxis: number }> };
    }>;

    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({
      name: "Справочные линии",
      markLine: { data: [{ name: "Fe 401.05", xAxis: 401.05 }] },
    });
  });

  it("shows real values for every visible layer and peak evidence in the tooltip", () => {
    const tooltip = formatSpectrumTooltip(
      [{ axisValue: 401, value: [401, 0.8] }],
      {
        rawDataset,
        preparedDataset,
        peaks: [peak],
        threshold: 0.15,
        referenceLines: [{ label: "Fe 401.05", wavelength: 401.05 }],
      },
      new Set(["raw", "prepared", "threshold", "peaks", "referenceLines"]),
      palette,
    );

    expect(tooltip).toContain("401.00 нм");
    expect(tooltip).toContain("Исходные отсчёты: <strong>240.000</strong>");
    expect(tooltip).toContain("Подготовленная интенсивность: <strong>0.8000</strong>");
    expect(tooltip).toContain("Порог обнаружения: <strong>0.1500</strong>");
    expect(tooltip).toContain("Выраженность: <strong>0.6200</strong>");
    expect(tooltip).toContain("Совпадение: <strong>Fe I · 401.05 нм (Δ -0.050 нм)</strong>");
    expect(tooltip).toContain("Справочная линия: <strong>Fe 401.05 · 401.05 нм</strong>");
  });

  it("preserves a zoom range for updates of one source and resets it for another source", () => {
    const zoom: SpectrumZoomRange = { start: 18, end: 63 };
    expect(preserveZoomForSource(zoom, "analysis-a", "analysis-a")).toBe(zoom);
    expect(preserveZoomForSource(zoom, "analysis-a", "analysis-b")).toEqual(FULL_SPECTRUM_ZOOM);
    expect(readZoomRange({ batch: [{ start: 22, end: 72 }] }, zoom)).toEqual({ start: 22, end: 72 });

    const updatedOption = createSpectrumChartOption(
      { preparedDataset: { ...preparedDataset, intensities: [0.2, 0.7, 0.4] } },
      new Set(["prepared"]),
      palette,
      zoom,
    );
    const dataZoom = updatedOption.dataZoom as Array<{ start: number; end: number }>;
    expect(dataZoom).toEqual(expect.arrayContaining([
      expect.objectContaining({ start: 18, end: 63 }),
    ]));
  });
});

describe("SpectrumChart", () => {
  it("can keep a fixed layer while preserving zoom controls", () => {
    render(
      <SpectrumChart
        rawDataset={rawDataset}
        sourceKey="analysis-a"
        defaultVisibleLayers={["raw"]}
        showLayerControls={false}
        label="Исходный спектр"
      />,
    );

    expect(screen.queryByRole("group", { name: "Слои графика" })).toBeNull();
    expect(screen.getByRole("button", { name: "Сбросить масштаб" })).toBeTruthy();
    const option = echartsMock.chart.setOption.mock.calls.at(-1)?.[0] as {
      series: Array<{ name: string }>;
    };
    expect(option.series.map((series) => series.name)).toEqual(["Исходный спектр"]);
  });

  it("uses aria-pressed toggles without recreating ECharts and preserves zoom on data updates", () => {
    const onPeakSelect = vi.fn();
    const { rerender } = render(
      <SpectrumChart
        rawDataset={rawDataset}
        preparedDataset={preparedDataset}
        peaks={[peak]}
        selectedPeakId={peak.id}
        onPeakSelect={onPeakSelect}
        sourceKey="analysis-a"
        defaultVisibleLayers={["raw"]}
        label="Тестовый спектр"
      />,
    );

    const rawToggle = screen.getByRole("button", { name: "Исходный" });
    const preparedToggle = screen.getByRole("button", { name: "Подготовленный" });
    expect(rawToggle.getAttribute("aria-pressed")).toBe("true");
    expect(preparedToggle.getAttribute("aria-pressed")).toBe("false");

    echartsMock.events.get("click")?.({
      seriesId: "detected-peaks",
      data: { id: peak.id },
    });
    expect(onPeakSelect).toHaveBeenCalledWith(peak.id);

    fireEvent.click(preparedToggle);
    expect(preparedToggle.getAttribute("aria-pressed")).toBe("true");
    expect(echartsMock.init).toHaveBeenCalledTimes(1);

    echartsMock.events.get("datazoom")?.({ start: 25, end: 75 });
    rerender(
      <SpectrumChart
        rawDataset={rawDataset}
        preparedDataset={{ ...preparedDataset, intensities: [0.2, 0.7, 0.4] }}
        peaks={[peak]}
        selectedPeakId={peak.id}
        onPeakSelect={onPeakSelect}
        sourceKey="analysis-a"
        defaultVisibleLayers={["raw"]}
        label="Обновлённый спектр"
      />,
    );

    expect(echartsMock.init).toHaveBeenCalledTimes(1);
    const sameSourceOption = echartsMock.chart.setOption.mock.calls.at(-1)?.[0] as {
      dataZoom: Array<{ start: number; end: number }>;
    };
    expect(sameSourceOption.dataZoom[0]).toMatchObject({ start: 25, end: 75 });

    rerender(
      <SpectrumChart
        rawDataset={rawDataset}
        preparedDataset={preparedDataset}
        peaks={[peak]}
        selectedPeakId={peak.id}
        onPeakSelect={onPeakSelect}
        sourceKey="analysis-b"
        defaultVisibleLayers={["raw"]}
        label="Другой спектр"
      />,
    );
    const newSourceOption = echartsMock.chart.setOption.mock.calls.at(-1)?.[0] as {
      dataZoom: Array<{ start: number; end: number }>;
    };
    expect(newSourceOption.dataZoom[0]).toMatchObject(FULL_SPECTRUM_ZOOM);

    fireEvent.click(screen.getByRole("button", { name: "Сбросить масштаб" }));
    expect(echartsMock.chart.dispatchAction).toHaveBeenCalledWith({
      type: "dataZoom",
      start: 0,
      end: 100,
    });
  });
});
