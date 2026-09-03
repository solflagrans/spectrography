// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisWorkspaceProvider,
  useAnalysisWorkspace,
} from "@/features/demo-analysis/model/analysis-workspace-context";
import { createRaw8Fixture } from "@/fixtures/raw8-test-fixture";
import { createWorkingAnalysis } from "@/application/analysis/create-working-analysis";
import type { AnalysisRunner } from "@/application/analysis/analysis-runner";
import { DEMO_ANALYSIS_INPUT } from "@/application/analysis/working-analysis";
import { InfoTooltipProvider } from "@/features/workspace/components/info-tooltip";

import { AnalysisSidePanel, IdentificationLinesPanel, PeakSettingsPanel, ProcessingSettingsPanel } from "./analysis-side-panels";
import {
  AnalysisAnalysisPage,
  DataAnalysisPage,
  IdentificationAnalysisPage,
  PeaksAnalysisPage,
  ProcessingAnalysisPage,
} from "./analysis-pages";

const navigationMock = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigationMock }));

vi.mock("./lazy-spectrum-chart", () => ({
  SpectrumChart: (props: {
    showLayerControls?: boolean;
    preparedDataset?: unknown;
    label: string;
    peaks?: readonly { id: string; wavelength: number }[];
    selectedPeakId?: string | null;
    onPeakSelect?: (peakId: string) => void;
    sourceKey?: string;
    referenceLines?: readonly unknown[];
    missingReferenceLines?: readonly unknown[];
  }) => (
    <div
      data-testid="spectrum-chart"
      data-layer-controls={String(props.showLayerControls ?? true)}
      data-has-prepared={String(Boolean(props.preparedDataset))}
      data-selected-peak={props.selectedPeakId ?? ""}
      data-source-key={props.sourceKey ?? ""}
      data-reference-count={String(props.referenceLines?.length ?? 0)}
      data-missing-reference-count={String(props.missingReferenceLines?.length ?? 0)}
      role="img"
      aria-label={props.label}
    >
      {props.onPeakSelect ? props.peaks?.map((peak) => (
        <button
          key={peak.id}
          type="button"
          aria-label={`График: выбрать пик ${peak.wavelength.toFixed(2)} нм`}
          onClick={() => props.onPeakSelect?.(peak.id)}
        />
      )) : null}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  navigationMock.push.mockClear();
});

const testAnalysisRunner: AnalysisRunner = {
  async run(source, parameters) {
    return createWorkingAnalysis(source, parameters);
  },
  cancel() {},
  dispose() {},
};

async function openDemoAnalysis() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Открыть демонстрационный спектр" }));
    await Promise.resolve();
  });
}

function AnalysisProbe() {
  const {
    analysis,
    calculationStatus,
    identificationTab,
    selectedHypothesisId,
    selectedPeakId,
    analysisView,
  } = useAnalysisWorkspace();
  return (
    <div>
      <output data-testid="peak-count">{analysis?.peaks.length ?? "—"}</output>
      <output data-testid="conclusion">{analysis?.conclusion ?? "—"}</output>
      <output data-testid="calculation-status">{calculationStatus}</output>
      <output data-testid="file-name">{analysis?.source.fileName ?? "—"}</output>
      <output data-testid="point-count">{analysis?.rawDataset.wavelengths.length ?? "—"}</output>
      <output data-testid="spectrum-type">{analysis?.spectrumType ?? "—"}</output>
      <output data-testid="selected-peak">{selectedPeakId ?? "—"}</output>
      <output data-testid="selected-hypothesis">{selectedHypothesisId ?? "—"}</output>
      <output data-testid="identification-tab">{identificationTab}</output>
      <output data-testid="analysis-view">{analysisView}</output>
    </div>
  );
}

function PeakSelectionScenario() {
  return (
    <InfoTooltipProvider>
      <AnalysisWorkspaceProvider analysisRunner={testAnalysisRunner}>
        <DataAnalysisPage />
        <PeaksAnalysisPage />
        <PeakSettingsPanel />
        <AnalysisProbe />
      </AnalysisWorkspaceProvider>
    </InfoTooltipProvider>
  );
}

function Scenario() {
  return (
    <InfoTooltipProvider>
      <AnalysisWorkspaceProvider analysisRunner={testAnalysisRunner}>
        <DataAnalysisPage />
        <ProcessingAnalysisPage />
        <PeakSettingsPanel />
        <AnalysisProbe />
      </AnalysisWorkspaceProvider>
    </InfoTooltipProvider>
  );
}

function ProcessingSettingsScenario() {
  return (
    <InfoTooltipProvider>
      <AnalysisWorkspaceProvider analysisRunner={testAnalysisRunner}>
        <ProcessingSettingsPanel />
      </AnalysisWorkspaceProvider>
    </InfoTooltipProvider>
  );
}

function IdentificationScenario() {
  return (
    <InfoTooltipProvider>
      <AnalysisWorkspaceProvider analysisRunner={testAnalysisRunner}>
        <DataAnalysisPage />
        <IdentificationLinesPanel />
        <IdentificationAnalysisPage />
        <PeakSettingsPanel />
        <AnalysisProbe />
      </AnalysisWorkspaceProvider>
    </InfoTooltipProvider>
  );
}

function EndToEndScenario() {
  return (
    <InfoTooltipProvider>
      <AnalysisWorkspaceProvider analysisRunner={testAnalysisRunner}>
        <DataAnalysisPage />
        <AnalysisSidePanel />
        <AnalysisAnalysisPage />
        <AnalysisProbe />
      </AnalysisWorkspaceProvider>
    </InfoTooltipProvider>
  );
}

describe("interactive demo analysis", () => {
  it("associates the wavelength switch and parameter fields with concise labels", () => {
    render(<ProcessingSettingsScenario />);

    expect(screen.getByRole("switch", { name: "Автоматически уточнять шкалу" })).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Окно оценки шума" })).toBeTruthy();
    expect(screen.queryByRole("spinbutton", { name: /MAD первых разностей/ })).toBeNull();
    expect(screen.getByText("Гладкость базовой линии")).toBeTruthy();
    expect(screen.getByText("Окно сглаживания")).toBeTruthy();
    expect(screen.getByText("Масштаб интенсивности")).toBeTruthy();
    expect(screen.getByRole("option", { name: "К максимуму (0–1)" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Не нормировать" })).toBeTruthy();
  });

  it("shows one unit for the complete peak-width range", () => {
    render(<PeakSelectionScenario />);

    const widthRange = screen.getByRole("group", { name: "Ширина пика" });
    expect(within(widthRange).getByRole("spinbutton", { name: "Ширина пика, от" })).toBeTruthy();
    expect(within(widthRange).getByRole("spinbutton", { name: "Ширина пика, до" })).toBeTruthy();
    expect(within(widthRange).getAllByText("нм")).toHaveLength(1);
  });

  it("shows one plasma-emission option and assigns it to an imported analysis", async () => {
    render(<Scenario />);
    const compactSpectrum = JSON.stringify({
      wavelengths: [330, 331, 332, 333, 334, 335, 336],
      intensities: [0, 0.1, 1, 0.1, 0, 0.1, 0],
    });
    fireEvent.change(screen.getByLabelText("Файл спектра"), {
      target: { files: [createFile("compact.json", compactSpectrum)] },
    });
    const field = await screen.findByRole("combobox", { name: "Тип спектра" }, { timeout: 5_000 });
    expect((field as HTMLSelectElement).value).toBe("plasma-emission");
    expect(within(field).getAllByRole("option")).toHaveLength(1);
    expect(within(field).getByRole("option").textContent).toBe("Эмиссия плазмы/разряда");
    expect(screen.getByTestId("spectrum-type").textContent).toBe("plasma-emission");
    expect(screen.queryByText(/Тип не задаёт ожидаемый состав/)).toBeNull();
  });

  it("automatically refreshes peaks and conclusion after a parameter change", async () => {
    vi.useFakeTimers();
    render(<Scenario />);

    await openDemoAnalysis();
    const initialPeakCount = Number(screen.getByTestId("peak-count").textContent);
    const initialConclusion = screen.getByTestId("conclusion").textContent;

    fireEvent.change(screen.getByLabelText("Минимальный SNR"), { target: { value: "30" } });

    expect(screen.getByText(/Обновляем графики и результаты/)).toBeTruthy();
    expect(screen.getByTestId("calculation-status").textContent).toBe("calculating");

    await act(async () => vi.advanceTimersByTime(181));

    expect(Number(screen.getByTestId("peak-count").textContent)).toBeLessThan(initialPeakCount);
    expect(screen.getByTestId("conclusion").textContent).not.toBe(initialConclusion);
    expect(screen.getByTestId("calculation-status").textContent).toBe("ready");
  });

  it("shows a clear error and keeps the last valid result for invalid parameters", async () => {
    vi.useFakeTimers();
    render(<Scenario />);

    await openDemoAnalysis();
    const validPeakCount = screen.getByTestId("peak-count").textContent;
    fireEvent.change(screen.getByLabelText(/Расстояние между пиками/), { target: { value: "0" } });

    await act(async () => vi.advanceTimersByTime(181));

    expect(screen.getByRole("alert").textContent).toContain("Укажите минимальное расстояние больше 0 нм");
    expect(screen.getByRole("alert").textContent).not.toContain("Последний корректный результат сохранён");
    expect(screen.getByTestId("peak-count").textContent).toBe(validPeakCount);
    expect(screen.getByTestId("calculation-status").textContent).toBe("error");
  });

  it("imports a JSON file, runs the shared analysis and keeps it after a failed replacement", async () => {
    render(<Scenario />);
    const input = screen.getByLabelText("Файл спектра");
    const spectrum = JSON.stringify({
      wavelengths: [504, 503, 502, 501, 500],
      intensities: [0, 0, 1, 0, 0],
    });

    fireEvent.change(input, { target: { files: [createFile("sample.json", spectrum)] } });

    await waitFor(() => expect(screen.getByTestId("file-name").textContent).toBe("sample.json"));
    expect(screen.getByTestId("point-count").textContent).toBe("5");
    expect(screen.getByText("Пользовательский файл")).toBeTruthy();
    expect(screen.getByText("JSON")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Файл спектра"), {
      target: { files: [createFile("replacement.csv", "500,1")] },
    });

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Выберите файл JSON, XLSX или RAW8"));
    expect(screen.getByRole("alert").textContent).not.toContain("Открытый анализ сохранён");
    expect(screen.getByTestId("file-name").textContent).toBe("sample.json");
    expect(screen.getByTestId("point-count").textContent).toBe("5");
  });

  it("imports the same JSON scenario through drag-and-drop", async () => {
    render(<Scenario />);
    const spectrum = JSON.stringify([
      [500, 501, 502, 503, 504],
      [0, 0, 1, 0, 0],
    ]);

    fireEvent.drop(screen.getByRole("group", { name: "Область загрузки файла" }), {
      dataTransfer: { files: [createFile("dropped.json", spectrum)] },
    });

    await waitFor(() => expect(screen.getByTestId("file-name").textContent).toBe("dropped.json"));
    expect(screen.getByTestId("calculation-status").textContent).toBe("ready");
  });

  it("shows a reading state while the selected file is being loaded", async () => {
    let finishReading: ((data: ArrayBuffer) => void) | undefined;
    const delayedFile = new File([], "slow.json", { type: "application/json" });
    Object.defineProperty(delayedFile, "arrayBuffer", {
      value: () => new Promise<ArrayBuffer>((resolve) => {
        finishReading = resolve;
      }),
    });
    render(<Scenario />);

    fireEvent.change(screen.getByLabelText("Файл спектра"), {
      target: { files: [delayedFile] },
    });
    expect(screen.getByText("Читаем и проверяем файл…")).toBeTruthy();

    await act(async () => {
      finishReading?.(new TextEncoder().encode('[[500,501,502],[0,1,0]]').buffer);
    });
    await waitFor(
      () => expect(screen.getByTestId("file-name").textContent).toBe("slow.json"),
      { timeout: 5_000 },
    );
  });

  it("imports RAW8 through the existing drag-and-drop scenario", async () => {
    render(<Scenario />);

    fireEvent.drop(screen.getByRole("group", { name: "Область загрузки файла" }), {
      dataTransfer: { files: [createBinaryFile("instrument.Raw8", createRaw8Fixture())] },
    });

    await waitFor(() => expect(screen.getByTestId("file-name").textContent).toBe("instrument.Raw8"));
    expect(screen.getByTestId("point-count").textContent).toBe("4");
    expect(screen.getByText("RAW8")).toBeTruthy();
    expect(screen.getByText("2107079U2")).toBeTruthy();
    expect(screen.getByText("4 мс")).toBeTruthy();
    expect(screen.getByText("нм / отсчёты прибора")).toBeTruthy();
    expect(screen.queryByText("Проверка целостности")).toBeNull();
    const dataChart = screen.getAllByTestId("spectrum-chart")[0];
    expect(dataChart.getAttribute("data-layer-controls")).toBe("false");
    expect(dataChart.getAttribute("data-has-prepared")).toBe("false");
  });

  it("synchronizes peak selection between chart, table and side panel", async () => {
    render(<PeakSelectionScenario />);
    await openDemoAnalysis();

    fireEvent.click(screen.getByRole("tab", { name: "Выбранный пик" }));
    expect(screen.getByText(/Выберите пик на графике или в таблице/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Параметры" }));

    const graphButtons = screen.getAllByRole("button", { name: /График: выбрать пик/ });
    fireEvent.click(graphButtons[0]);

    const selectedId = screen.getByTestId("selected-peak").textContent;
    expect(selectedId).not.toBe("—");
    expect(screen.getByRole("tab", { name: "Выбранный пик" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Длина")).toBeTruthy();
    expect(screen.getByText("Ширина")).toBeTruthy();
    expect(screen.getByText("Параметры пика")).toBeTruthy();
    expect(screen.queryByText("Ближайшая по длине волны")).toBeNull();

    const chart = screen.getByRole("img", { name: "Подготовленный спектр с отмеченными пиками" });
    expect(chart.getAttribute("data-selected-peak")).toBe(selectedId);
    const selectedRow = document.querySelector('tr[aria-selected="true"]');
    expect(selectedRow?.getAttribute("data-peak-id")).toBe(selectedId);

    const selectableRows = [...document.querySelectorAll("tr[data-peak-id]")];
    fireEvent.click(selectableRows[1]);
    const nextId = selectableRows[1].getAttribute("data-peak-id");
    expect(screen.getByTestId("selected-peak").textContent).toBe(nextId);
    expect(chart.getAttribute("data-selected-peak")).toBe(nextId);
    expect(selectableRows[1].getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: "Линии и назначения" })).toBeTruthy();

    const snrSort = screen.getByRole("button", { name: /SNR/ });
    fireEvent.click(snrSort);
    expect(snrSort.closest("th")?.getAttribute("aria-sort")).toMatch(/ascending|descending/);
  });

  it("distinguishes assignments from the nearest candidate and keeps the compact list bounded", async () => {
    render(<PeakSelectionScenario />);
    await openDemoAnalysis();
    fireEvent.click(screen.getAllByRole("button", { name: /График: выбрать пик/ })[0]);

    expect(screen.getByRole("heading", { name: "Ближайшая линия" })).toBeTruthy();
    expect(screen.queryByText(/не итоговая идентификация/)).toBeNull();
    expect(screen.queryByText("Предложено")).toBeNull();

    const assignments = screen.getByRole("heading", { name: "Назначения в гипотезах" }).closest("section")!;
    const nearest = screen.getByRole("heading", { name: "Ближайшая линия" }).closest("section")!;
    const alternatives = screen.getByRole("heading", { name: "Альтернативы" }).closest("section")!;
    expect(assignments.querySelector("[data-candidate-group]")).toBeTruthy();
    expect(nearest.querySelector("[data-candidate-group]")).toBeTruthy();
    expect(alternatives.querySelectorAll("[data-candidate-group]").length).toBeLessThanOrEqual(5);
  });

  it("opens, filters and collapses the full local candidate list", async () => {
    render(<PeakSelectionScenario />);
    await openDemoAnalysis();
    fireEvent.click(screen.getAllByRole("button", { name: /График: выбрать пик/ })[0]);

    const showAll = screen.getByRole("button", { name: /Все кандидаты \(\d+\)/ });
    expect(showAll.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(showAll);
    expect(screen.getByRole("heading", { name: "Все кандидаты" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Свернуть" }).getAttribute("aria-expanded")).toBe("true");

    const search = screen.getByLabelText("Поиск кандидата по названию элемента или символу");
    fireEvent.change(search, { target: { value: "Железо" } });
    const byName = document.querySelector("[data-candidate-count]")!.textContent;
    expect(byName).not.toMatch(/^0 /);
    fireEvent.change(search, { target: { value: "Fe" } });
    expect(document.querySelector("[data-candidate-count]")!.textContent).toBe(byName);

    fireEvent.change(search, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Степень ионизации"), { target: { value: "2" } });
    expect(document.querySelector("[data-candidate-count]")!.textContent).not.toMatch(/^0 /);
    fireEvent.change(screen.getByLabelText("Отношение к гипотезам"), { target: { value: "diagnostic" } });
    expect(document.querySelector("[data-candidate-count]")!.textContent).not.toMatch(/^0 /);

    fireEvent.change(search, { target: { value: "несуществующий элемент" } });
    expect(screen.getByText("По выбранным условиям кандидаты не найдены.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Свернуть" }));
    expect(screen.getByRole("heading", { name: "Альтернативы" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Все кандидаты" })).toBeNull();
  });

  it("preserves a selected source point when it remains a peak and resets it otherwise", async () => {
    vi.useFakeTimers();
    render(<PeakSelectionScenario />);
    await openDemoAnalysis();
    fireEvent.click(screen.getAllByRole("button", { name: /График: выбрать пик/ })[0]);
    const selectedId = screen.getByTestId("selected-peak").textContent;

    fireEvent.click(screen.getByRole("tab", { name: "Параметры" }));
    fireEvent.change(screen.getByRole("slider", { name: "Минимальный SNR" }), { target: { value: "5.5" } });
    await act(async () => vi.advanceTimersByTime(181));
    expect(screen.getByTestId("selected-peak").textContent).toBe(selectedId);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Минимальная выраженность" }), { target: { value: "1.01" } });
    await act(async () => vi.advanceTimersByTime(181));
    expect(screen.getByTestId("selected-peak").textContent).toBe("—");
    fireEvent.click(screen.getByRole("tab", { name: "Выбранный пик" }));
    expect(screen.getByText("При текущих параметрах пики не найдены.")).toBeTruthy();
  });

  it("always resets the selected peak after opening another source", async () => {
    render(<PeakSelectionScenario />);
    await openDemoAnalysis();
    fireEvent.click(screen.getAllByRole("button", { name: /График: выбрать пик/ })[0]);
    expect(screen.getByTestId("selected-peak").textContent).not.toBe("—");

    const imported = JSON.stringify([[500, 501, 502, 503, 504], [0, 0, 1, 0, 0]]);
    fireEvent.change(screen.getByLabelText("Файл спектра"), {
      target: { files: [createFile("another.json", imported)] },
    });

    await waitFor(() => expect(screen.getByTestId("file-name").textContent).toBe("another.json"));
    expect(screen.getByTestId("selected-peak").textContent).toBe("—");
  });

  it("selects, filters and opens diagnostic hypotheses in the master-detail view", async () => {
    render(<IdentificationScenario />);
    await openDemoAnalysis();

    const diagnosticDetails = screen.getByText(/^Другие совпадения ·/).closest("details")!;
    diagnosticDetails.open = true;
    fireEvent(diagnosticDetails, new Event("toggle"));
    expect(screen.getByTestId("identification-tab").textContent).toBe("diagnostics");
    expect(document.querySelector('[role="option"][aria-selected="true"]')).toBeTruthy();

    fireEvent.click(screen.getByRole("option", { name: /N.*Азот/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Азот (N)" })).toBeTruthy();
    expect(screen.getAllByText("Не отличается от случайного согласования").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Поиск слабого совпадения по элементу или символу"), { target: { value: "Азот" } });
    const filteredOptions = within(screen.getByRole("listbox", { name: "Диагностические совпадения" })).getAllByRole("option");
    expect(filteredOptions).toHaveLength(1);
    expect(filteredOptions[0].textContent).toContain("N");

    fireEvent.change(screen.getByLabelText("Поиск слабого совпадения по элементу или символу"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Сортировка"), { target: { value: "name" } });
    const alphabeticOptions = within(screen.getByRole("listbox", { name: "Диагностические совпадения" })).getAllByRole("option");
    expect(alphabeticOptions[0].textContent).toContain("Азот");
  });

  it("preserves a hypothesis across recalculation and falls back when hypotheses disappear", async () => {
    vi.useFakeTimers();
    render(<IdentificationScenario />);
    await openDemoAnalysis();
    const diagnosticDetails = screen.getByText(/^Другие совпадения ·/).closest("details")!;
    diagnosticDetails.open = true;
    fireEvent(diagnosticDetails, new Event("toggle"));
    fireEvent.click(screen.getByRole("option", { name: /N.*Азот/ }));
    const selectedHypothesis = screen.getByTestId("selected-hypothesis").textContent;

    fireEvent.click(screen.getByRole("tab", { name: "Параметры" }));
    fireEvent.change(screen.getByRole("slider", { name: "Минимальный SNR" }), { target: { value: "5.5" } });
    await act(async () => vi.advanceTimersByTime(181));
    expect(screen.getByTestId("selected-hypothesis").textContent).toBe(selectedHypothesis);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Минимальная выраженность" }), { target: { value: "1.01" } });
    await act(async () => vi.advanceTimersByTime(181));
    expect(screen.getByTestId("selected-hypothesis").textContent).toBe("—");
  });

  it("opens a supporting observation and carries the selected peak to the peak mode", async () => {
    render(<IdentificationScenario />);
    await openDemoAnalysis();
    const diagnosticDetails = screen.getByText(/^Другие совпадения ·/).closest("details")!;
    diagnosticDetails.open = true;
    fireEvent(diagnosticDetails, new Event("toggle"));
    fireEvent.click(screen.getByRole("option", { name: /N.*Азот/ }));

    const chart = screen.getByRole("img", { name: /Спектр канала .* гипотезы Азот/ });
    expect(Number(chart.getAttribute("data-reference-count"))).toBeGreaterThanOrEqual(0);
    expect(Number(chart.getAttribute("data-missing-reference-count"))).toBeGreaterThanOrEqual(0);

    const technicalDetails = screen.getByText("Доказательства и показатели").closest("details")!;
    technicalDetails.open = true;
    fireEvent(technicalDetails, new Event("toggle"));
    fireEvent.click(technicalDetails.querySelector('tr[tabindex="0"]')!);
    expect(screen.getByTestId("selected-peak").textContent).not.toBe("—");
    expect(screen.getByTestId("analysis-view").textContent).toBe("peaks");
  });

  it("opens an available hypothesis from a selected peak candidate", async () => {
    render(<PeakSelectionScenario />);
    await openDemoAnalysis();
    fireEvent.click(screen.getAllByRole("button", { name: /График: выбрать пик/ })[0]);
    fireEvent.click(document.querySelector("[data-candidate-group] button")!);

    expect(screen.getByTestId("selected-hypothesis").textContent).not.toBe("—");
    expect(screen.getByTestId("analysis-view").textContent).toBe("composition");
  });

  it("preserves the selected peak through the full list, filtering, hypothesis and return flow", async () => {
    render(<EndToEndScenario />);
    await openDemoAnalysis();
    fireEvent.click(screen.getByRole("tab", { name: "Все пики" }));
    fireEvent.click(document.querySelector("tr[data-peak-id]")!);
    const selectedPeak = screen.getByTestId("selected-peak").textContent;

    fireEvent.click(screen.getByRole("button", { name: /Все кандидаты \(\d+\)/ }));
    fireEvent.change(screen.getByLabelText("Поиск кандидата по названию элемента или символу"), {
      target: { value: "N" },
    });
    fireEvent.change(screen.getByLabelText("Отношение к гипотезам"), {
      target: { value: "diagnostic" },
    });
    fireEvent.click(document.querySelector("[data-candidate-group] button")!);

    expect(screen.getByTestId("analysis-view").textContent).toBe("composition");
    expect(screen.getByTestId("selected-peak").textContent).toBe(selectedPeak);
    fireEvent.click(screen.getByRole("tab", { name: "Все пики" }));
    expect(screen.getByTestId("selected-peak").textContent).toBe(selectedPeak);
    expect(document.querySelector('tr[aria-selected="true"]')?.getAttribute("data-peak-id")).toBe(selectedPeak);
  });

  it("covers upload, spectrum type, automatic analysis, evidence and a linked peak", async () => {
    render(<EndToEndScenario />);
    const uploaded = JSON.stringify({
      wavelengths: DEMO_ANALYSIS_INPUT.rawDataset.wavelengths,
      intensities: DEMO_ANALYSIS_INPUT.rawDataset.intensities,
    });

    fireEvent.change(screen.getByLabelText("Файл спектра"), {
      target: { files: [createFile("measurement.json", uploaded)] },
    });
    await act(async () => Promise.resolve());
    expect(screen.getByTestId("file-name").textContent).toBe("measurement.json");

    const spectrumTypeField = screen.getByRole("combobox", { name: "Тип спектра" });
    expect((spectrumTypeField as HTMLSelectElement).value).toBe("plasma-emission");
    expect(within(spectrumTypeField).getAllByRole("option")).toHaveLength(1);

    const composition = screen.getByRole("listbox", { name: "Основные гипотезы" });
    const mainChoice = within(composition).getAllByRole("option")[0];
    fireEvent.click(mainChoice);
    expect(screen.getByTestId("selected-hypothesis").textContent).not.toBe("—");

    const technical = screen.queryByText("Доказательства и показатели");
    if (technical) {
      const details = technical.closest("details")!;
      details.open = true;
      fireEvent(details, new Event("toggle"));
      fireEvent.click(details.querySelector('tr[tabindex="0"]')!);
      expect(screen.getByTestId("analysis-view").textContent).toBe("peaks");
      expect(screen.getByTestId("selected-peak").textContent).not.toBe("—");
    }
  });

  it("uses a concise evidence summary without internal strength classes", async () => {
    render(<EndToEndScenario />);
    await openDemoAnalysis();

    const conclusion = screen.getByRole("heading", { name: "Основные гипотезы" }).closest("section")!;
    expect(conclusion.textContent).toMatch(/подтвержд[её]нн(ая|ые|ых) групп/);
    expect(conclusion.textContent).not.toMatch(/сильн(ая|ые|ых)|качественн(ая|ые|ых) совпад/);
  });
});

function createFile(name: string, contents: string): File {
  const file = new File([contents], name, { type: "application/json" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new TextEncoder().encode(contents).buffer,
  });
  return file;
}

function createBinaryFile(name: string, contents: ArrayBuffer): File {
  const file = new File([contents], name, { type: "application/octet-stream" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => contents });
  return file;
}
