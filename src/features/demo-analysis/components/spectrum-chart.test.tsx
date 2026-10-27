// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalyzedPeak, SpectrumDataset } from "@/domain/spectrum";

import { SpectrumChart } from "./spectrum-chart";
import {
  createSpectrumChartOption,
  formatSpectrumTooltip,
  formatIntensityTick,
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
  ToolboxComponent: {},
  DataZoomInsideComponent: {},
  DataZoomSliderComponent: {},
  GridComponent: {},
  MarkAreaComponent: {},
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
const thresholdDataset: SpectrumDataset = {
  wavelengths: [400, 401, 402],
  intensities: [0.12, 0.15, 0.14],
};
const match = {
  lineId: "nist-fe-i-40105",
  atomicNumber: 26,
  elementSymbol: "Fe",
  elementName: "Железо",
  ionizationStage: 1,
  ionizationLabel: "I",
  line: 401.05,
  wavelengthType: "observed" as const,
  wavelengthMedium: "air" as const,
  delta: -0.05,
  adaptiveToleranceNm: 0.2,
  combinedUncertaintyNm: 0.08,
  normalizedDelta: 0.25,
  toleranceCapped: false,
  uncertainty: { gridSamplingNm: 0.03, spectralResolutionNm: 0.03, peakWidthNm: 0.02, peakPositionNm: 0.03, referenceLineNm: 0, calibrationNm: 0.05 },
};
const peak: AnalyzedPeak = {
  id: "peak-point-2",
  channelId: "channel-1",
  sourceIndex: 1,
  index: 1,
  sampledWavelength: 401,
  refinedWavelength: 401,
  wavelength: 401,
  refinementOffsetNm: 0,
  localGridStepNm: 1,
  positionUncertaintyNm: 0.29,
  positionMethod: "sample-maximum",
  positionRefined: false,
  rawIntensity: 240,
  intensity: 0.8,
  prominence: 0.62,
  snr: 8,
  widthNm: 0.8,
  candidates: [match],
  match,
};
const palette: SpectrumChartPalette = {
  raw: "#0ea5c2",
  baseline: "#9b6b43",
  prepared: "#4a6fa5",
  peak: "#2b8a3e",
  threshold: "#b86800",
  reference: "#5856d6",
  missingReference: "#8a96a3",
  region: "#5856d6",
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
      { rawDataset, rawIntensityUnit: "отсчёты прибора", preparedDataset, peaks: [peak], selectedPeakId: peak.id, thresholdDataset },
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
      ["Интенсивность, отсчёты прибора", "left"],
      ["Подготовленная интенсивность", "right"],
    ]);
    expect(series.map((item) => item.name)).toEqual([
      "Исходный спектр",
      "Подготовленный спектр",
      "Порог обнаружения",
      "Найденные пики",
    ]);
    expect(series[0]).toMatchObject({ yAxisIndex: 0, lineStyle: { width: 1.1, opacity: 0.42 } });
    expect(series[1]).toMatchObject({ yAxisIndex: 1, lineStyle: { width: 1.8 } });
    expect(series[2]).toMatchObject({ yAxisIndex: 1, lineStyle: { type: "dotted" } });
    expect(series[3]).toMatchObject({ yAxisIndex: 1, itemStyle: { color: palette.peak } });
    expect(series[3].data?.[0]).toMatchObject({ id: peak.id, symbol: "circle", symbolSize: 11 });
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

  it("renders found references as solid lines and missing characteristic lines as muted dashes", () => {
    const option = createSpectrumChartOption(
      {
        preparedDataset,
        referenceLines: [{ label: "Fe I 401.05", wavelength: 401.05 }],
        missingReferenceLines: [{ label: "Fe I 402.10", wavelength: 402.1 }],
      },
      new Set(["prepared", "referenceLines", "missingReferenceLines"]),
      palette,
      FULL_SPECTRUM_ZOOM,
    );
    const series = option.series as Array<{
      name: string;
      markLine?: { data?: Array<{ lineStyle?: { type?: string; color?: string; opacity?: number } }> };
    }>;

    expect(series.map((item) => item.name)).toEqual([
      "Подготовленный спектр",
      "Справочные линии",
      "Характерные линии без пика",
    ]);
    expect(series[1].markLine?.data?.[0].lineStyle).toMatchObject({ type: "solid", color: palette.reference });
    expect(series[2].markLine?.data?.[0].lineStyle).toMatchObject({ type: "dashed", color: palette.missingReference, opacity: 0.34 });
  });

  it("highlights molecular evidence as wavelength regions", () => {
    const option = createSpectrumChartOption(
      {
        preparedDataset,
        highlightedRegions: [{ label: "N₂ region", minimum: 400.2, maximum: 401.8 }],
      },
      new Set(["prepared", "regions"]),
      palette,
      FULL_SPECTRUM_ZOOM,
    );
    const series = option.series as Array<{
      name: string;
      markArea?: { data?: Array<Array<{ name?: string; xAxis: number }>> };
    }>;

    expect(series.map((item) => item.name)).toEqual(["Подготовленный спектр", "Характерные области"]);
    expect(series[1].markArea?.data?.[0]).toEqual([
      { name: "N₂ region", xAxis: 400.2 },
      { xAxis: 401.8 },
    ]);
  });

  it("shows real values for every visible layer and peak evidence in the tooltip", () => {
    const tooltip = formatSpectrumTooltip(
      [{ axisValue: 401, value: [401, 0.8] }],
      {
        rawDataset,
        preparedDataset,
        peaks: [peak],
        thresholdDataset,
        referenceLines: [{ label: "Fe 401.05", wavelength: 401.05 }],
      },
      new Set(["raw", "prepared", "threshold", "peaks", "referenceLines"]),
      palette,
    );

    expect(tooltip).toContain("401,000 нм");
    expect(tooltip).toContain("Исходный: <strong>240 ");
    expect(tooltip).toContain("Подготовленный: <strong>0,8 ");
    expect(tooltip).toContain("Порог: <strong>0,15 ");
    expect(tooltip).not.toContain("Выраженность:");
    expect(tooltip).not.toContain("Ближайший кандидат:");
    expect(tooltip).toContain("Пик № 1");
    expect(tooltip).toContain("Справочная линия: <strong>Fe 401.05 · 401,050 нм</strong>");
  });

  it("formats large tooltip values compactly with explicit units", () => {
    const tooltip = formatSpectrumTooltip([{ axisValue: 400 }], { rawDataset: { wavelengths: [400], intensities: [37692445802.478] }, rawIntensityUnit: "отсчёты прибора" }, new Set(["raw"]), palette);
    expect(tooltip).toContain("3,77 × 10<sup>10</sup>");
    expect(tooltip).toContain("отсч.");
    expect(tooltip).not.toContain("37692445802");
  });

  it("normalizes rectangle coordinates and ignores incomplete zoom events", () => {
    expect(readZoomRange({ batch: [{ startValue: 420, endValue: 460 }] }, FULL_SPECTRUM_ZOOM, [400, 500])).toEqual({ start: 20, end: 60 });
    expect(readZoomRange({ batch: [{}] }, { start: 20, end: 60 }, [400, 500])).toEqual({ start: 20, end: 60 });
    const option = createSpectrumChartOption({ rawDataset }, new Set(["raw"]), palette, FULL_SPECTRUM_ZOOM);
    expect(option.dataZoom).toEqual(expect.arrayContaining([expect.objectContaining({ type: "inside", zoomOnMouseWheel: false, moveOnMouseMove: false })]));
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
  it("retains independent layer choices for processing tabs and keeps zoom", () => {
    const props = { rawDataset, preparedDataset, thresholdDataset, label: "Processing preview", sourceKey: "processing-layer-test" };
    const { rerender } = render(<SpectrumChart {...props} layerViewKey="preparation" defaultVisibleLayers={["raw", "prepared"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Исходный" }));
    act(() => echartsMock.events.get("datazoom")?.({ start: 20, end: 60 }));
    rerender(<SpectrumChart {...props} layerViewKey="peaks" defaultVisibleLayers={["prepared", "threshold"]} />);
    expect(screen.getByRole("button", { name: "Порог" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Исходный" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Порог" }));
    rerender(<SpectrumChart {...props} layerViewKey="preparation" defaultVisibleLayers={["raw", "prepared"]} />);
    expect(screen.getByRole("button", { name: "Исходный" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Сбросить масштаб" })).toBeTruthy();
    rerender(<SpectrumChart {...props} layerViewKey="peaks" defaultVisibleLayers={["prepared", "threshold"]} />);
    expect(screen.getByRole("button", { name: "Порог" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("previews a table peak without rebuilding the chart or changing selection and zoom", () => {
    const props = { peaks: [peak], preparedDataset, selectedPeakId: peak.id, sourceKey: "hover-test", defaultVisibleLayers: ["prepared", "peaks"] as const, label: "Hover preview" };
    const { rerender } = render(<SpectrumChart {...props} />);
    const updates = echartsMock.chart.setOption.mock.calls.length;
    rerender(<SpectrumChart {...props} hoveredPeakId={peak.id} />);
    expect(echartsMock.chart.dispatchAction).toHaveBeenLastCalledWith({ type: "highlight", seriesId: "detected-peaks", dataIndex: 0 });
    expect(echartsMock.chart.setOption.mock.calls.length).toBe(updates);
    rerender(<SpectrumChart {...props} hoveredPeakId={null} />);
    expect(echartsMock.chart.dispatchAction).toHaveBeenLastCalledWith({ type: "downplay", seriesId: "detected-peaks" });
  });

  it("formats intensity ticks compactly", () => {
    expect(formatIntensityTick(250_000_000_000)).toBe("2,5e11");
    expect(formatIntensityTick(0.00002)).toBe("2,0e-5");
    expect(formatIntensityTick(0.5)).toBe("0,5");
    expect(formatIntensityTick(0)).toBe("0");
  });

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
    expect(screen.queryByRole("button", { name: "Сбросить масштаб" })).toBeNull();
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

    act(() => echartsMock.events.get("datazoom")?.({ start: 25, end: 75 }));
    expect(screen.getByRole("button", { name: "Сбросить масштаб" })).toBeTruthy();
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

    fireEvent.click(screen.getByRole("button", { name: "Сбросить масштаб" }));
    expect(echartsMock.chart.dispatchAction).toHaveBeenCalledWith({
      type: "dataZoom",
      start: 0,
      end: 100,
    });
    expect(screen.getByRole("button", { name: "Сбросить масштаб" }).hasAttribute("disabled")).toBe(true);

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
    expect(screen.getByRole("button", { name: "Сбросить масштаб" }).hasAttribute("disabled")).toBe(true);
  });
});
