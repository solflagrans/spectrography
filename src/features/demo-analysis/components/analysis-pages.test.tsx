// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDemoAnalysis } from "@/features/demo-analysis/model/demo-analysis-context";
import { DemoAnalysisProvider } from "@/features/demo-analysis/model/demo-analysis-context";

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
  const { analysis, calculationStatus } = useDemoAnalysis();
  return (
    <div>
      <output data-testid="peak-count">{analysis?.peaks.length ?? "—"}</output>
      <output data-testid="conclusion">{analysis?.conclusion ?? "—"}</output>
      <output data-testid="calculation-status">{calculationStatus}</output>
    </div>
  );
}

function Scenario() {
  return (
    <DemoAnalysisProvider>
      <DataAnalysisPage />
      <ProcessingAnalysisPage />
      <PeakSettingsPanel />
      <AnalysisProbe />
    </DemoAnalysisProvider>
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
});
