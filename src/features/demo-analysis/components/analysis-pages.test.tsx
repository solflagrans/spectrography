// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisWorkspaceProvider,
  useAnalysisWorkspace,
} from "@/features/demo-analysis/model/analysis-workspace-context";
import { createRaw8Fixture } from "@/fixtures/raw8-test-fixture";

import { PeakSettingsPanel } from "./analysis-side-panels";
import { DataAnalysisPage, ProcessingAnalysisPage } from "./analysis-pages";

vi.mock("./spectrum-chart", () => ({
  SpectrumChart: () => <div data-testid="spectrum-chart" />,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function AnalysisProbe() {
  const { analysis, calculationStatus } = useAnalysisWorkspace();
  return (
    <div>
      <output data-testid="peak-count">{analysis?.peaks.length ?? "—"}</output>
      <output data-testid="conclusion">{analysis?.conclusion ?? "—"}</output>
      <output data-testid="calculation-status">{calculationStatus}</output>
      <output data-testid="file-name">{analysis?.source.fileName ?? "—"}</output>
      <output data-testid="point-count">{analysis?.rawDataset.wavelengths.length ?? "—"}</output>
    </div>
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

    expect(screen.getByText(/Пересчитываем анализ/).textContent).toContain("Пересчитываем");
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

    expect(screen.getByRole("alert").textContent).toContain("Минимальное расстояние должно быть больше 0 нм");
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

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("только файлы JSON, XLSX и RAW8"));
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
    expect(screen.getByText(/dark и reference сохранены/)).toBeTruthy();
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
