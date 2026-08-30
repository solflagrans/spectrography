// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisWorkspaceProvider,
  useAnalysisWorkspace,
} from "@/features/demo-analysis/model/analysis-workspace-context";
import { createRaw8Fixture } from "@/fixtures/raw8-test-fixture";

import { PeakSettingsPanel } from "./analysis-side-panels";
import { DataAnalysisPage, PeaksAnalysisPage, ProcessingAnalysisPage } from "./analysis-pages";

vi.mock("./spectrum-chart", () => ({
  SpectrumChart: (props: {
    showLayerControls?: boolean;
    preparedDataset?: unknown;
    label: string;
    peaks?: readonly { id: string; wavelength: number }[];
    selectedPeakId?: string | null;
    onPeakSelect?: (peakId: string) => void;
  }) => (
    <div
      data-testid="spectrum-chart"
      data-layer-controls={String(props.showLayerControls ?? true)}
      data-has-prepared={String(Boolean(props.preparedDataset))}
      data-selected-peak={props.selectedPeakId ?? ""}
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
});

function AnalysisProbe() {
  const { analysis, calculationStatus, selectedPeakId } = useAnalysisWorkspace();
  return (
    <div>
      <output data-testid="peak-count">{analysis?.peaks.length ?? "—"}</output>
      <output data-testid="conclusion">{analysis?.conclusion ?? "—"}</output>
      <output data-testid="calculation-status">{calculationStatus}</output>
      <output data-testid="file-name">{analysis?.source.fileName ?? "—"}</output>
      <output data-testid="point-count">{analysis?.rawDataset.wavelengths.length ?? "—"}</output>
      <output data-testid="selected-peak">{selectedPeakId ?? "—"}</output>
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

describe("interactive demo analysis", () => {
  it("automatically refreshes peaks and conclusion after a parameter change", async () => {
    vi.useFakeTimers();
    render(<Scenario />);

    fireEvent.click(screen.getByRole("button", { name: "Открыть демонстрационный спектр" }));
    const initialPeakCount = Number(screen.getByTestId("peak-count").textContent);
    const initialConclusion = screen.getByTestId("conclusion").textContent;

    fireEvent.change(screen.getByLabelText("Порог обнаружения"), { target: { value: "0.9" } });

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
    expect(screen.getByText(/подходящих линий нет/)).toBeTruthy();
  });

  it("preserves a selected source point when it remains a peak and resets it otherwise", async () => {
    vi.useFakeTimers();
    render(<PeakSelectionScenario />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть демонстрационный спектр" }));
    fireEvent.click(screen.getAllByRole("button", { name: /График: выбрать пик/ })[0]);
    const selectedId = screen.getByTestId("selected-peak").textContent;

    fireEvent.click(screen.getByRole("tab", { name: "Параметры" }));
    fireEvent.change(screen.getByLabelText(/Допуск сопоставления/), { target: { value: "0.4" } });
    await act(async () => vi.advanceTimersByTime(181));
    expect(screen.getByTestId("selected-peak").textContent).toBe(selectedId);

    fireEvent.change(screen.getByLabelText(/Минимальная выраженность/), { target: { value: "1" } });
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
