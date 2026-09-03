// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createWorkingAnalysis,
  DEMO_ANALYSIS_INPUT,
} from "@/application/analysis/create-working-analysis";
import { InfoTooltipProvider } from "@/features/workspace/components/info-tooltip";

import { IdentificationAnalysisPage, PeaksAnalysisPage, ProcessingAnalysisPage } from "./analysis-pages";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  selectChannel: vi.fn(),
  selectPeak: vi.fn(),
  setAnalysisView: vi.fn(),
  workspace: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/demo-analysis/model/analysis-workspace-context", () => ({
  useAnalysisWorkspace: () => mocks.workspace(),
}));
vi.mock("./lazy-spectrum-chart", () => ({
  SpectrumChart: (props: { sourceKey: string; peaks?: readonly unknown[]; referenceLines?: readonly unknown[]; missingReferenceLines?: readonly unknown[] }) => (
    <div
      role="img"
      aria-label="График выбранного канала"
      data-source-key={props.sourceKey}
      data-peaks={props.peaks?.length ?? 0}
      data-reference-lines={props.referenceLines?.length ?? 0}
      data-missing-lines={props.missingReferenceLines?.length ?? 0}
    />
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("multi-channel identification detail", () => {
  it("switches the chart channel directly and when opening an observation", () => {
    const analysis = createWorkingAnalysis({
      ...DEMO_ANALYSIS_INPUT,
      id: "multi-channel-demo",
      channels: [
        { id: "channel-a", name: "Канал A", dataset: DEMO_ANALYSIS_INPUT.rawDataset },
        { id: "channel-b", name: "Канал B", dataset: DEMO_ANALYSIS_INPUT.rawDataset },
      ],
    });
    const hypothesis = analysis.hypotheses[0] ?? analysis.rejectedHypotheses[0]?.hypothesis;
    expect(hypothesis).toBeTruthy();
    mocks.workspace.mockReturnValue({
      analysis,
      calculationStatus: "ready",
      parameterError: null,
      hypothesisSelectionNotice: false,
      selectedHypothesisId: hypothesis!.id,
      selectedIdentificationChannelId: "channel-a",
      selectedPeakId: null,
      selectIdentificationChannel: mocks.selectChannel,
      selectPeak: mocks.selectPeak,
      setAnalysisView: mocks.setAnalysisView,
    });

    render(<InfoTooltipProvider><IdentificationAnalysisPage /></InfoTooltipProvider>);

    const channelSelect = screen.getByLabelText("Канал");
    expect(channelSelect.querySelectorAll("option")).toHaveLength(2);
    fireEvent.change(channelSelect, { target: { value: "channel-b" } });
    expect(mocks.selectChannel).toHaveBeenCalledWith("channel-b");

    const chart = screen.getByRole("img", { name: "График выбранного канала" });
    expect(chart.getAttribute("data-source-key")).toBe("multi-channel-demo:channel-a");
    expect(Number(chart.getAttribute("data-reference-lines"))).toBeGreaterThan(0);

    const evidenceDetails = screen.getByText("Доказательства и показатели").closest("details")!;
    evidenceDetails.open = true;
    fireEvent(evidenceDetails, new Event("toggle"));
    fireEvent.click(evidenceDetails.querySelector('tr[tabindex="0"]')!);
    expect(mocks.selectChannel).toHaveBeenLastCalledWith("channel-a");
    expect(mocks.selectPeak).toHaveBeenCalledWith(expect.stringContaining("peak-channel-a-point-"));
    expect(mocks.setAnalysisView).toHaveBeenCalledWith("peaks");
  });

  it("keeps processing, chart and peak table scoped to the selected channel", () => {
    const analysis = createWorkingAnalysis({
      ...DEMO_ANALYSIS_INPUT,
      id: "multi-channel-pages",
      channels: [
        { id: "channel-a", name: "Канал A", dataset: DEMO_ANALYSIS_INPUT.rawDataset },
        { id: "channel-b", name: "Канал B", dataset: DEMO_ANALYSIS_INPUT.rawDataset },
      ],
    });
    mocks.workspace.mockReturnValue({
      analysis,
      calculationStatus: "ready",
      parameterError: null,
      selectedIdentificationChannelId: "channel-b",
      selectedPeakId: null,
      selectIdentificationChannel: mocks.selectChannel,
      selectPeak: mocks.selectPeak,
    });

    render(
      <InfoTooltipProvider>
        <ProcessingAnalysisPage />
        <PeaksAnalysisPage />
      </InfoTooltipProvider>,
    );

    const charts = screen.getAllByRole("img", { name: "График выбранного канала" });
    expect(charts).toHaveLength(2);
    expect(charts.every((chart) => chart.getAttribute("data-source-key") === "multi-channel-pages:channel-b")).toBe(true);
    const rows = [...document.querySelectorAll("tr[data-peak-id]")];
    expect(rows.length).toBe(analysis.channels[1].peaks.length);
    expect(rows.every((row) => row.getAttribute("data-peak-id")?.includes("peak-channel-b-point-"))).toBe(true);

    fireEvent.change(screen.getByLabelText("Канал обработки"), { target: { value: "channel-a" } });
    fireEvent.change(screen.getByLabelText("Канал пиков"), { target: { value: "channel-a" } });
    expect(mocks.selectChannel).toHaveBeenNthCalledWith(1, "channel-a");
    expect(mocks.selectChannel).toHaveBeenNthCalledWith(2, "channel-a");
  });
});
