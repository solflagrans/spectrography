import { createStore } from "zustand/vanilla";

import type { IdentificationTab } from "./identification-ui";
import type { AnalysisView } from "./analysis-workspace-context";

export interface AnalysisWorkspaceUiState {
  readonly selectedPeakId: string | null;
  readonly selectedHypothesisId: string | null;
  readonly identificationTab: IdentificationTab;
  readonly selectedIdentificationChannelId: string | null;
  readonly hypothesisSelectionNotice: boolean;
  readonly analysisView: AnalysisView;
}

export const INITIAL_ANALYSIS_WORKSPACE_UI_STATE: AnalysisWorkspaceUiState = {
  selectedPeakId: null,
  selectedHypothesisId: null,
  identificationTab: "hypotheses",
  selectedIdentificationChannelId: null,
  hypothesisSelectionNotice: false,
  analysisView: "composition",
};

export function createAnalysisWorkspaceUiStore() {
  return createStore<AnalysisWorkspaceUiState>()(() => INITIAL_ANALYSIS_WORKSPACE_UI_STATE);
}

export type AnalysisWorkspaceUiStore = ReturnType<typeof createAnalysisWorkspaceUiStore>;
