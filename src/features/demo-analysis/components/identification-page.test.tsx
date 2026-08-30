// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createWorkingAnalysis,
  DEMO_ANALYSIS_INPUT,
} from "@/application/analysis/create-working-analysis";

import { IdentificationAnalysisPage } from "./analysis-pages";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  selectChannel: vi.fn(),
  selectPeak: vi.fn(),
  workspace: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/demo-analysis/model/analysis-workspace-context", () => ({
  useAnalysisWorkspace: () => mocks.workspace(),
}));
vi.mock("./spectrum-chart", () => ({
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
    });

    render(<IdentificationAnalysisPage />);

    const channelSelect = screen.getByLabelText("Канал");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    fireEvent.change(channelSelect, { target: { value: "channel-b" } });
    expect(mocks.selectChannel).toHaveBeenCalledWith("channel-b");

    const chart = screen.getByRole("img", { name: "График выбранного канала" });
    expect(chart.getAttribute("data-source-key")).toBe("multi-channel-demo:channel-a");
    expect(Number(chart.getAttribute("data-reference-lines"))).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Канал B" })[0]);
    expect(mocks.selectChannel).toHaveBeenLastCalledWith("channel-b");
    expect(mocks.selectPeak).toHaveBeenCalledWith(expect.stringContaining("peak-channel-b-point-"));
  });
});
