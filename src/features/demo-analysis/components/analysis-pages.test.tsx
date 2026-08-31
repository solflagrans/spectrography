// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisWorkspaceProvider,
  useAnalysisWorkspace,
} from "@/features/demo-analysis/model/analysis-workspace-context";
import { createRaw8Fixture } from "@/fixtures/raw8-test-fixture";
import { DEMO_ANALYSIS_INPUT } from "@/application/analysis/create-working-analysis";

import { IdentificationLinesPanel, PeakSettingsPanel } from "./analysis-side-panels";
import {
  AnalysisAnalysisPage,
  DataAnalysisPage,
  IdentificationAnalysisPage,
  PeaksAnalysisPage,
  ProcessingAnalysisPage,
} from "./analysis-pages";

const navigationMock = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigationMock }));

vi.mock("./spectrum-chart", () => ({
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
    <AnalysisWorkspaceProvider>
      <DataAnalysisPage />
      <PeaksAnalysisPage />
      <PeakSettingsPanel />
      <AnalysisProbe />
    </AnalysisWorkspaceProvider>
  );
}

function Scenario() {
  return (
    <AnalysisWorkspaceProvider>
      <DataAnalysisPage />
      <ProcessingAnalysisPage />
      <PeakSettingsPanel />
      <AnalysisProbe />
    </AnalysisWorkspaceProvider>
  );
}

function IdentificationScenario() {
  return (
    <AnalysisWorkspaceProvider>
      <DataAnalysisPage />
      <IdentificationLinesPanel />
      <IdentificationAnalysisPage />
      <PeakSettingsPanel />
      <AnalysisProbe />
    </AnalysisWorkspaceProvider>
  );
}

function EndToEndScenario() {
  return (
    <AnalysisWorkspaceProvider>
      <DataAnalysisPage />
      <IdentificationLinesPanel />
      <AnalysisAnalysisPage />
      <AnalysisProbe />
    </AnalysisWorkspaceProvider>
  );
}

describe("interactive demo analysis", () => {
  it("stores the selected spectrum type after automatic recalculation", async () => {
    vi.useFakeTimers();
    render(<Scenario />);
    const compactSpectrum = JSON.stringify({
      wavelengths: [330, 331, 332, 333, 334, 335, 336],
      intensities: [0, 0.1, 1, 0.1, 0, 0.1, 0],
    });
    fireEvent.change(screen.getByLabelText("Файл спектра"), {
      target: { files: [createFile("compact.json", compactSpectrum)] },
    });
    await act(async () => Promise.resolve());

    const field = screen.getByRole("combobox", { name: /Допустимый способ интерпретации/ });
    expect((field as HTMLSelectElement).value).toBe("unspecified");
    fireEvent.change(field, { target: { value: "plasma-emission" } });

    expect((field as HTMLSelectElement).value).toBe("plasma-emission");
    expect(screen.getByTestId("calculation-status").textContent).toBe("calculating");
    await act(async () => vi.advanceTimersByTime(181));
    expect(screen.getByTestId("spectrum-type").textContent).toBe("plasma-emission");
    expect(screen.getByText(/Тип не задаёт ожидаемый состав/)).toBeTruthy();
  });

  it("automatically refreshes peaks and conclusion after a parameter change", async () => {
    vi.useFakeTimers();
    render(<Scenario />);

    fireEvent.click(screen.getByRole("button", { name: "Открыть демонстрационный спектр" }));
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

    fireEvent.click(screen.getByRole("button", { name: "Открыть демонстрационный спектр" }));
    const validPeakCount = screen.getByTestId("peak-count").textContent;
    fireEvent.change(screen.getByLabelText(/Минимальное расстояние/), { target: { value: "0" } });

    await act(async () => vi.advanceTimersByTime(181));

    expect(screen.getByRole("alert").textContent).toContain("Укажите минимальное расстояние больше 0 нм");
    expect(screen.getByRole("alert").textContent).toContain("Последний корректный результат сохранён");
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
    expect(screen.getByRole("alert").textContent).toContain("Открытый анализ сохранён");
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
    await waitFor(() => expect(screen.getByTestId("file-name").textContent).toBe("slow.json"));
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

  it("synchronizes peak selection between chart, table and side panel", () => {
    render(<PeakSelectionScenario />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть демонстрационный спектр" }));

    fireEvent.click(screen.getByRole("tab", { name: "Выбранный пик" }));
    expect(screen.getByText(/Выберите пик на графике или в таблице/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Параметры" }));

    const graphButtons = screen.getAllByRole("button", { name: /График: выбрать пик/ });
    fireEvent.click(graphButtons[0]);

    const selectedId = screen.getByTestId("selected-peak").textContent;
    expect(selectedId).not.toBe("—");
    expect(screen.getByRole("tab", { name: "Выбранный пик" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Исходная интенсивность")).toBeTruthy();
    expect(screen.getByText("Подготовленная интенсивность")).toBeTruthy();
    expect(screen.getByText("Предложено")).toBeTruthy();

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
    expect(screen.getByText("Предложено")).toBeTruthy();
  });

  it("preserves a selected source point when it remains a peak and resets it otherwise", async () => {
    vi.useFakeTimers();
    render(<PeakSelectionScenario />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть демонстрационный спектр" }));
    fireEvent.click(screen.getAllByRole("button", { name: /График: выбрать пик/ })[0]);
    const selectedId = screen.getByTestId("selected-peak").textContent;

    fireEvent.click(screen.getByRole("tab", { name: "Параметры" }));
    fireEvent.change(screen.getByLabelText(/Минимальный SNR/), { target: { value: "5.5" } });
    await act(async () => vi.advanceTimersByTime(181));
    expect(screen.getByTestId("selected-peak").textContent).toBe(selectedId);

    fireEvent.change(screen.getByLabelText(/Минимальная выраженность/), { target: { value: "1.01" } });
    await act(async () => vi.advanceTimersByTime(181));
    expect(screen.getByTestId("selected-peak").textContent).toBe("—");
    fireEvent.click(screen.getByRole("tab", { name: "Выбранный пик" }));
    expect(screen.getByText("При текущих параметрах пики не найдены.")).toBeTruthy();
  });

  it("always resets the selected peak after opening another source", async () => {
    render(<PeakSelectionScenario />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть демонстрационный спектр" }));
    fireEvent.click(screen.getAllByRole("button", { name: /График: выбрать пик/ })[0]);
    expect(screen.getByTestId("selected-peak").textContent).not.toBe("—");

    const imported = JSON.stringify([[500, 501, 502, 503, 504], [0, 0, 1, 0, 0]]);
    fireEvent.change(screen.getByLabelText("Файл спектра"), {
      target: { files: [createFile("another.json", imported)] },
    });

    await waitFor(() => expect(screen.getByTestId("file-name").textContent).toBe("another.json"));
    expect(screen.getByTestId("selected-peak").textContent).toBe("—");
  });

  it("selects, filters and opens diagnostic hypotheses in the master-detail view", () => {
    render(<IdentificationScenario />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть демонстрационный спектр" }));

    const diagnosticDetails = screen.getByText(/^Слабые и неоднозначные совпадения ·/).closest("details")!;
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
    fireEvent.click(screen.getByRole("button", { name: "Открыть демонстрационный спектр" }));
    const diagnosticDetails = screen.getByText(/^Слабые и неоднозначные совпадения ·/).closest("details")!;
    diagnosticDetails.open = true;
    fireEvent(diagnosticDetails, new Event("toggle"));
    fireEvent.click(screen.getByRole("option", { name: /N.*Азот/ }));
    const selectedHypothesis = screen.getByTestId("selected-hypothesis").textContent;

    fireEvent.click(screen.getByRole("tab", { name: "Параметры" }));
    fireEvent.change(screen.getByLabelText(/Минимальный SNR/), { target: { value: "5.5" } });
    await act(async () => vi.advanceTimersByTime(181));
    expect(screen.getByTestId("selected-hypothesis").textContent).toBe(selectedHypothesis);

    fireEvent.change(screen.getByLabelText(/Минимальная выраженность/), { target: { value: "1.01" } });
    await act(async () => vi.advanceTimersByTime(181));
    expect(screen.getByTestId("selected-hypothesis").textContent).toBe("—");
  });

  it("opens a supporting observation and carries the selected peak to the peak mode", () => {
    render(<IdentificationScenario />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть демонстрационный спектр" }));
    const diagnosticDetails = screen.getByText(/^Слабые и неоднозначные совпадения ·/).closest("details")!;
    diagnosticDetails.open = true;
    fireEvent(diagnosticDetails, new Event("toggle"));
    fireEvent.click(screen.getByRole("option", { name: /N.*Азот/ }));

    const chart = screen.getByRole("img", { name: /Спектр канала .* гипотезы Азот/ });
    expect(Number(chart.getAttribute("data-reference-count"))).toBeGreaterThanOrEqual(0);
    expect(Number(chart.getAttribute("data-missing-reference-count"))).toBeGreaterThanOrEqual(0);

    const technicalDetails = screen.getByText("Подробности идентификации и технические показатели").closest("details")!;
    technicalDetails.open = true;
    fireEvent(technicalDetails, new Event("toggle"));
    fireEvent.click(screen.getAllByRole("button", { name: "Открыть пик" })[0]);
    expect(screen.getByTestId("selected-peak").textContent).not.toBe("—");
    expect(screen.getByTestId("analysis-view").textContent).toBe("peaks");
  });

  it("opens an available hypothesis from a selected peak candidate", () => {
    render(<PeakSelectionScenario />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть демонстрационный спектр" }));
    fireEvent.click(screen.getAllByRole("button", { name: /График: выбрать пик/ })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Открыть гипотезу" })[0]);

    expect(screen.getByTestId("selected-hypothesis").textContent).not.toBe("—");
    expect(screen.getByTestId("analysis-view").textContent).toBe("composition");
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

    fireEvent.change(screen.getByRole("combobox", { name: /Допустимый способ интерпретации/ }), {
      target: { value: "unspecified" },
    });
    expect(screen.getByTestId("calculation-status").textContent).toBe("calculating");
    await waitFor(() => expect(screen.getByTestId("calculation-status").textContent).toBe("ready"));

    const composition = screen.getByRole("list", { name: "Наиболее надёжные варианты состава" });
    const mainChoice = within(composition).getAllByRole("button")[0];
    fireEvent.click(mainChoice);
    expect(screen.getAllByText(/спектральные признаки|Главные признаки/i).length).toBeGreaterThan(0);

    const technical = screen.queryByText("Подробности идентификации и технические показатели");
    if (technical) {
      const details = technical.closest("details")!;
      details.open = true;
      fireEvent(details, new Event("toggle"));
      const peakLink = screen.getAllByRole("button", { name: "Открыть пик" })[0];
      fireEvent.click(peakLink);
      expect(screen.getByTestId("analysis-view").textContent).toBe("peaks");
      expect(screen.getByTestId("selected-peak").textContent).not.toBe("—");
    }
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
