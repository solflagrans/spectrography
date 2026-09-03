"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { createBrowserAnalysisRunner } from "@/application/analysis/analysis-runner";
import type { AnalysisRunner } from "@/application/analysis/analysis-runner";
import { DEMO_ANALYSIS_INPUT } from "@/application/analysis/working-analysis";
import type {
  CreateWorkingAnalysisInput,
  WorkingAnalysis,
} from "@/application/analysis/working-analysis";
import {
  DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  DEFAULT_SPECTRUM_TYPE,
  normalizeSpectrumType,
} from "@/domain/spectrum";
import type {
  InteractiveAnalysisParameters,
  NewAnalysisSpectrumType,
  PeakSearchParameters,
  SpectrumProcessingParameters,
  WavelengthCalibrationParameters,
} from "@/domain/spectrum";
import type { IdentificationTab } from "./identification-ui";
import {
  createAnalysisWorkspaceUiStore,
} from "./analysis-workspace-ui-store";
import type {
  AnalysisWorkspaceUiState,
  AnalysisWorkspaceUiStore,
} from "./analysis-workspace-ui-store";

export type AnalysisCalculationStatus = "idle" | "calculating" | "ready" | "error";
export type SpectrumImportStatus = "idle" | "reading" | "error";
export type PeakPanelSection = "parameters" | "selected";
export type AnalysisView = "composition" | "peaks";

export interface SpectrumFileLike {
  readonly name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface AnalysisWorkspaceContextValue {
  readonly analysis: WorkingAnalysis | null;
  readonly parameters: InteractiveAnalysisParameters;
  readonly calculationStatus: AnalysisCalculationStatus;
  readonly parameterError: string | null;
  readonly importStatus: SpectrumImportStatus;
  readonly importError: string | null;
  readonly selectedPeakId: string | null;
  readonly peakPanelSection: PeakPanelSection;
  readonly selectedHypothesisId: string | null;
  readonly identificationTab: IdentificationTab;
  readonly selectedIdentificationChannelId: string | null;
  readonly hypothesisSelectionNotice: boolean;
  readonly analysisView: AnalysisView;
  readonly selectedSpectrumType: NewAnalysisSpectrumType;
  readonly openDemoAnalysis: () => void;
  readonly importSpectrumFile: (file: SpectrumFileLike) => Promise<void>;
  readonly updateProcessingParameters: (patch: Partial<SpectrumProcessingParameters>) => void;
  readonly updatePeakSearchParameters: (patch: Partial<PeakSearchParameters>) => void;
  readonly updateSpectrumType: (spectrumType: NewAnalysisSpectrumType) => void;
  readonly updateWavelengthCalibrationParameters: (patch: Partial<WavelengthCalibrationParameters>) => void;
  readonly resetProcessingParameters: () => void;
  readonly resetPeakSearchParameters: () => void;
  readonly selectPeak: (peakId: string | null) => void;
  readonly setPeakPanelSection: (section: PeakPanelSection) => void;
  readonly selectHypothesis: (hypothesisId: string, tab?: IdentificationTab) => void;
  readonly selectHypothesisForElement: (elementSymbol: string) => boolean;
  readonly setIdentificationTab: (tab: IdentificationTab) => void;
  readonly selectIdentificationChannel: (channelId: string) => void;
  readonly setAnalysisView: (view: AnalysisView) => void;
}

type AnalysisWorkspaceCoreContextValue = Omit<AnalysisWorkspaceContextValue, keyof AnalysisWorkspaceUiState>;

const AnalysisWorkspaceContext = createContext<AnalysisWorkspaceCoreContextValue | null>(null);
const AnalysisWorkspaceUiContext = createContext<AnalysisWorkspaceUiStore | null>(null);
const missingWorkspaceUiStore = createAnalysisWorkspaceUiStore();

export function AnalysisWorkspaceProvider({
  children,
  analysisRunner,
  demoAnalysisInput = DEMO_ANALYSIS_INPUT,
}: Readonly<{
  children: ReactNode;
  analysisRunner?: AnalysisRunner;
  demoAnalysisInput?: CreateWorkingAnalysisInput;
}>) {
  const [analysis, setAnalysis] = useState<WorkingAnalysis | null>(null);
  const [parameters, setParameters] = useState<InteractiveAnalysisParameters>(
    DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  );
  const [calculationStatus, setCalculationStatus] = useState<AnalysisCalculationStatus>("idle");
  const [parameterError, setParameterError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<SpectrumImportStatus>("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedSpectrumType, setSelectedSpectrumType] = useState<NewAnalysisSpectrumType>(DEFAULT_SPECTRUM_TYPE);
  const recalculationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calculationRequest = useRef(0);
  const sourceRef = useRef<CreateWorkingAnalysisInput | null>(null);
  const parametersRef = useRef<InteractiveAnalysisParameters>(
    DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  );
  const importRequest = useRef(0);
  const runnerRef = useRef<AnalysisRunner | null>(null);
  if (runnerRef.current === null) runnerRef.current = analysisRunner ?? createBrowserAnalysisRunner();
  const [uiStore] = useState<AnalysisWorkspaceUiStore>(createAnalysisWorkspaceUiStore);

  const applyAnalysis = useCallback((nextAnalysis: WorkingAnalysis, previousHypothesisId: string | null) => {
    setAnalysis(nextAnalysis);
    const currentUi = uiStore.getState();
    const selectedPeakId = currentUi.selectedPeakId
      && nextAnalysis.peaks.some((peak) => peak.id === currentUi.selectedPeakId)
      ? currentUi.selectedPeakId
      : null;
    const accepted = nextAnalysis.hypotheses.find((hypothesis) => hypothesis.id === previousHypothesisId);
    const acceptedMolecule = nextAnalysis.molecularHypotheses.find((hypothesis) => hypothesis.id === previousHypothesisId);
    const diagnostic = nextAnalysis.rejectedHypotheses.find((item) => item.hypothesis.id === previousHypothesisId);
    let selectedHypothesisId: string | null;
    let identificationTab: IdentificationTab;
    let hypothesisSelectionNotice = false;
    if (accepted || acceptedMolecule) {
      selectedHypothesisId = (accepted ?? acceptedMolecule)!.id;
      identificationTab = "hypotheses";
    } else if (diagnostic) {
      selectedHypothesisId = diagnostic.hypothesis.id;
      identificationTab = "diagnostics";
    } else {
      const fallback = getInitialHypothesisSelection(nextAnalysis);
      selectedHypothesisId = fallback.id;
      identificationTab = fallback.tab;
      hypothesisSelectionNotice = previousHypothesisId !== null;
    }
    const selectedIdentificationChannelId = currentUi.selectedIdentificationChannelId
      && nextAnalysis.channels.some((channel) => channel.id === currentUi.selectedIdentificationChannelId)
        ? currentUi.selectedIdentificationChannelId
        : nextAnalysis.channels[0]?.id ?? null;
    uiStore.setState({
      selectedPeakId,
      selectedHypothesisId,
      identificationTab,
      selectedIdentificationChannelId,
      hypothesisSelectionNotice,
    });
    setCalculationStatus("ready");
  }, [uiStore]);

  const calculate = useCallback((
    nextParameters: InteractiveAnalysisParameters,
    nextSource: CreateWorkingAnalysisInput | null = sourceRef.current,
  ) => {
    const source = nextSource;
    if (!source) return;
    const requestId = calculationRequest.current + 1;
    calculationRequest.current = requestId;
    if (recalculationTimer.current) clearTimeout(recalculationTimer.current);
    runnerRef.current?.cancel();
    setParameterError(null);
    setCalculationStatus("calculating");
    recalculationTimer.current = setTimeout(async () => {
      try {
        const nextAnalysis = await runnerRef.current!.run(source, nextParameters);
        if (requestId !== calculationRequest.current) return;
        applyAnalysis(nextAnalysis, uiStore.getState().selectedHypothesisId);
      } catch (error) {
        if (requestId !== calculationRequest.current) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setParameterError(
          error instanceof Error
            ? error.message
            : "Проверьте выбранные параметры и попробуйте снова.",
        );
        setCalculationStatus("error");
      }
    }, 180);
  }, [applyAnalysis, uiStore]);

  useEffect(() => () => {
    if (recalculationTimer.current) clearTimeout(recalculationTimer.current);
    runnerRef.current?.dispose();
  }, []);

  const activateSource = useCallback(async (source: CreateWorkingAnalysisInput) => {
    calculationRequest.current += 1;
    if (recalculationTimer.current) clearTimeout(recalculationTimer.current);
    runnerRef.current?.cancel();
    sourceRef.current = source;
    parametersRef.current = DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS;
    setParameters(DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS);
    setParameterError(null);
    uiStore.setState({
      selectedPeakId: null,
      peakPanelSection: "parameters",
      selectedHypothesisId: null,
      identificationTab: "hypotheses",
      selectedIdentificationChannelId: null,
      hypothesisSelectionNotice: false,
      analysisView: "composition",
    });
    setSelectedSpectrumType(normalizeSpectrumType(source.spectrumType));
    setCalculationStatus("calculating");
    const requestId = calculationRequest.current;
    const nextAnalysis = await runnerRef.current!.run(source, DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS);
    if (requestId !== calculationRequest.current) return;
    applyAnalysis(nextAnalysis, null);
  }, [applyAnalysis, uiStore]);

  const openDemoAnalysis = useCallback(() => {
    importRequest.current += 1;
    setImportError(null);
    setImportStatus("idle");
    void activateSource(demoAnalysisInput).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setParameterError(error instanceof Error ? error.message : "Не удалось открыть образец NASA PDS.");
      setCalculationStatus("error");
    });
  }, [activateSource, demoAnalysisInput]);

  const importSpectrumFile = useCallback(async (file: SpectrumFileLike) => {
    const requestId = importRequest.current + 1;
    importRequest.current = requestId;
    let analysisStarted = false;
    setImportError(null);
    setImportStatus("reading");

    try {
      const [data, { parseSpectrumFile }] = await Promise.all([
        file.arrayBuffer(),
        import("@/application/import-spectrum/parse-dataset"),
      ]);
      const parsed = await parseSpectrumFile({
        fileName: file.name,
        data,
      });
      if (requestId !== importRequest.current) return;

      analysisStarted = true;
      await activateSource({
        id: `import-${requestId}`,
        title: parsed.fileName,
        source: {
          kind: "Пользовательский файл",
          fileName: parsed.fileName,
          format: parsed.format,
          units: parsed.format === "RAW8" ? "нм / отсчёты прибора" : "нм / отн. ед.",
        },
        rawDataset: parsed.dataset,
        auxiliaryData: parsed.auxiliaryData,
        instrumentMetadata: parsed.instrumentMetadata,
      });
      setImportStatus("idle");
    } catch (error) {
      if (requestId !== importRequest.current) return;
      if (analysisStarted) {
        setParameterError(error instanceof Error ? error.message : "Не удалось проанализировать открытый спектр.");
        setCalculationStatus("error");
      }
      setImportError(
        error instanceof Error
          ? error.message
          : "Браузер не смог прочитать файл. Выберите его ещё раз или попробуйте другой файл.",
      );
      setImportStatus("error");
    }
  }, [activateSource]);

  const updateProcessingParameters = useCallback(
    (patch: Partial<SpectrumProcessingParameters>) => {
      const current = parametersRef.current;
      const next = { ...current, processing: { ...current.processing, ...patch } };
      parametersRef.current = next;
      setParameters(next);
      calculate(next);
    },
    [calculate],
  );

  const updatePeakSearchParameters = useCallback(
    (patch: Partial<PeakSearchParameters>) => {
      const current = parametersRef.current;
      const next = { ...current, peakSearch: { ...current.peakSearch, ...patch } };
      parametersRef.current = next;
      setParameters(next);
      calculate(next);
    },
    [calculate],
  );

  const updateSpectrumType = useCallback((spectrumType: NewAnalysisSpectrumType) => {
    const source = sourceRef.current;
    if (!source || source.spectrumType === spectrumType) return;
    const nextSource = { ...source, spectrumType };
    sourceRef.current = nextSource;
    setSelectedSpectrumType(spectrumType);
    calculate(parametersRef.current, nextSource);
  }, [calculate]);

  const updateWavelengthCalibrationParameters = useCallback(
    (patch: Partial<WavelengthCalibrationParameters>) => {
      const current = parametersRef.current;
      const next = { ...current, wavelengthCalibration: { ...current.wavelengthCalibration, ...patch } };
      parametersRef.current = next;
      setParameters(next);
      calculate(next);
    },
    [calculate],
  );

  const resetProcessingParameters = useCallback(() => {
    const next = {
      ...parametersRef.current,
      processing: DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing,
      wavelengthCalibration: DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.wavelengthCalibration,
    };
    parametersRef.current = next;
    setParameters(next);
    calculate(next);
  }, [calculate]);

  const resetPeakSearchParameters = useCallback(() => {
    const next = {
      ...parametersRef.current,
      peakSearch: DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch,
    };
    parametersRef.current = next;
    setParameters(next);
    calculate(next);
  }, [calculate]);

  const selectPeak = useCallback((peakId: string | null) => {
    uiStore.setState({
      selectedPeakId: peakId,
      ...(peakId ? { peakPanelSection: "selected" as const } : {}),
    });
  }, [uiStore]);

  const setPeakPanelSection = useCallback((section: PeakPanelSection) => {
    uiStore.setState({ peakPanelSection: section });
  }, [uiStore]);

  const selectHypothesis = useCallback((hypothesisId: string, tab?: IdentificationTab) => {
    uiStore.setState({
      selectedHypothesisId: hypothesisId,
      ...(tab ? { identificationTab: tab } : {}),
      hypothesisSelectionNotice: false,
    });
  }, [uiStore]);

  const selectHypothesisForElement = useCallback((elementSymbol: string): boolean => {
    const current = analysis;
    if (!current) return false;
    const accepted = current.hypotheses.find((hypothesis) => hypothesis.symbol === elementSymbol);
    if (accepted) {
      selectHypothesis(accepted.id, "hypotheses");
      return true;
    }
    const diagnostic = current.rejectedHypotheses.find((item) => item.hypothesis.symbol === elementSymbol);
    if (diagnostic) {
      selectHypothesis(diagnostic.hypothesis.id, "diagnostics");
      return true;
    }
    return false;
  }, [analysis, selectHypothesis]);

  const setIdentificationTab = useCallback((tab: IdentificationTab) => {
    const selectedHypothesisId = uiStore.getState().selectedHypothesisId;
    const current = analysis;
    if (!current) {
      uiStore.setState({ identificationTab: tab, hypothesisSelectionNotice: false });
      return;
    }
    const currentExistsInTab = tab === "hypotheses"
      ? current.hypotheses.some((hypothesis) => hypothesis.id === selectedHypothesisId)
        || current.molecularHypotheses.some((hypothesis) => hypothesis.id === selectedHypothesisId)
      : current.rejectedHypotheses.some((item) => item.hypothesis.id === selectedHypothesisId);
    if (!currentExistsInTab) {
      uiStore.setState({ selectedHypothesisId: tab === "hypotheses"
        ? current.hypotheses[0]?.id ?? current.molecularHypotheses[0]?.id ?? null
        : current.rejectedHypotheses[0]?.hypothesis.id ?? null });
    }
    uiStore.setState({ identificationTab: tab, hypothesisSelectionNotice: false });
  }, [analysis, uiStore]);

  const selectIdentificationChannel = useCallback((channelId: string) => {
    uiStore.setState({ selectedIdentificationChannelId: channelId, selectedPeakId: null });
  }, [uiStore]);

  const setAnalysisView = useCallback((view: AnalysisView) => {
    const selectedPeakId = uiStore.getState().selectedPeakId;
    if (view === "composition") {
      uiStore.setState({ analysisView: view, peakPanelSection: "parameters" });
    } else if (selectedPeakId) {
      uiStore.setState({ analysisView: view, peakPanelSection: "selected" });
    } else {
      uiStore.setState({ analysisView: view });
    }
  }, [uiStore]);

  const value = useMemo(
    () => ({
      analysis,
      parameters,
      calculationStatus,
      parameterError,
      importStatus,
      importError,
      selectedSpectrumType,
      openDemoAnalysis,
      importSpectrumFile,
      updateProcessingParameters,
      updatePeakSearchParameters,
      updateSpectrumType,
      updateWavelengthCalibrationParameters,
      resetPeakSearchParameters,
      resetProcessingParameters,
      selectPeak,
      setPeakPanelSection,
      selectHypothesis,
      selectHypothesisForElement,
      setIdentificationTab,
      selectIdentificationChannel,
      setAnalysisView,
    }),
    [
      analysis,
      calculationStatus,
      importError,
      importSpectrumFile,
      importStatus,
      openDemoAnalysis,
      parameterError,
      parameters,
      selectedSpectrumType,
      resetPeakSearchParameters,
      resetProcessingParameters,
      selectPeak,
      setPeakPanelSection,
      selectHypothesis,
      selectHypothesisForElement,
      setIdentificationTab,
      selectIdentificationChannel,
      setAnalysisView,
      updatePeakSearchParameters,
      updateSpectrumType,
      updateWavelengthCalibrationParameters,
      updateProcessingParameters,
    ],
  );

  return (
    <AnalysisWorkspaceUiContext.Provider value={uiStore}>
      <AnalysisWorkspaceContext.Provider value={value}>
        {children}
      </AnalysisWorkspaceContext.Provider>
    </AnalysisWorkspaceUiContext.Provider>
  );
}

function getInitialHypothesisSelection(analysis: WorkingAnalysis): { id: string | null; tab: IdentificationTab } {
  if (analysis.hypotheses[0]) return { id: analysis.hypotheses[0].id, tab: "hypotheses" };
  if (analysis.molecularHypotheses[0]) return { id: analysis.molecularHypotheses[0].id, tab: "hypotheses" };
  return { id: null, tab: "hypotheses" };
}

export function useAnalysisWorkspace(): AnalysisWorkspaceContextValue {
  const core = useAnalysisWorkspaceCore();
  const ui = useAnalysisWorkspaceUi((state) => state);
  return { ...core, ...ui };
}

export function useAnalysisWorkspaceCore(): AnalysisWorkspaceCoreContextValue {
  const core = useContext(AnalysisWorkspaceContext);
  if (!core) throw new Error("useAnalysisWorkspaceCore должен использоваться внутри AnalysisWorkspaceProvider.");
  return core;
}

export function useAnalysisWorkspaceUi<T>(selector: (state: AnalysisWorkspaceUiState) => T): T {
  const uiStore = useContext(AnalysisWorkspaceUiContext);
  const selected = useStore(uiStore ?? missingWorkspaceUiStore, selector);
  if (!uiStore) throw new Error("useAnalysisWorkspaceUi должен использоваться внутри AnalysisWorkspaceProvider.");
  return selected;
}
