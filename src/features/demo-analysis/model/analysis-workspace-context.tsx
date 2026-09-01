"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  createWorkingAnalysis,
  DEMO_ANALYSIS_INPUT,
} from "@/application/analysis/create-working-analysis";
import type {
  CreateWorkingAnalysisInput,
  WorkingAnalysis,
} from "@/application/analysis/create-working-analysis";
import { parseSpectrumFile } from "@/application/import-spectrum/parse-dataset";
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

const AnalysisWorkspaceContext = createContext<AnalysisWorkspaceContextValue | null>(null);

export function AnalysisWorkspaceProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [analysis, setAnalysis] = useState<WorkingAnalysis | null>(null);
  const [parameters, setParameters] = useState<InteractiveAnalysisParameters>(
    DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  );
  const [calculationStatus, setCalculationStatus] = useState<AnalysisCalculationStatus>("idle");
  const [parameterError, setParameterError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<SpectrumImportStatus>("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedPeakId, setSelectedPeakId] = useState<string | null>(null);
  const [peakPanelSection, setPeakPanelSection] = useState<PeakPanelSection>("parameters");
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<string | null>(null);
  const [identificationTab, setIdentificationTabState] = useState<IdentificationTab>("hypotheses");
  const [selectedIdentificationChannelId, setSelectedIdentificationChannelId] = useState<string | null>(null);
  const [hypothesisSelectionNotice, setHypothesisSelectionNotice] = useState(false);
  const [analysisView, setAnalysisViewState] = useState<AnalysisView>("composition");
  const [selectedSpectrumType, setSelectedSpectrumType] = useState<NewAnalysisSpectrumType>(DEFAULT_SPECTRUM_TYPE);
  const recalculationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calculationRequest = useRef(0);
  const sourceRef = useRef<CreateWorkingAnalysisInput | null>(null);
  const parametersRef = useRef<InteractiveAnalysisParameters>(
    DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  );
  const importRequest = useRef(0);

  const calculate = useCallback((
    nextParameters: InteractiveAnalysisParameters,
    nextSource: CreateWorkingAnalysisInput | null = sourceRef.current,
  ) => {
    const source = nextSource;
    if (!source) return;
    const requestId = calculationRequest.current + 1;
    calculationRequest.current = requestId;
    if (recalculationTimer.current) clearTimeout(recalculationTimer.current);
    setParameterError(null);
    setCalculationStatus("calculating");
    recalculationTimer.current = setTimeout(() => {
      try {
        const nextAnalysis = createWorkingAnalysis(source, nextParameters);
        if (requestId !== calculationRequest.current) return;
        setAnalysis(nextAnalysis);
        setSelectedPeakId((current) => (
          current && nextAnalysis.peaks.some((peak) => peak.id === current) ? current : null
        ));
        setSelectedHypothesisId((current) => {
          const accepted = nextAnalysis.hypotheses.find((hypothesis) => hypothesis.id === current);
          if (accepted) {
            setIdentificationTabState("hypotheses");
            setHypothesisSelectionNotice(false);
            return accepted.id;
          }
          const acceptedMolecule = nextAnalysis.molecularHypotheses.find((hypothesis) => hypothesis.id === current);
          if (acceptedMolecule) {
            setIdentificationTabState("hypotheses");
            setHypothesisSelectionNotice(false);
            return acceptedMolecule.id;
          }
          const diagnostic = nextAnalysis.rejectedHypotheses.find((item) => item.hypothesis.id === current);
          if (diagnostic) {
            setIdentificationTabState("diagnostics");
            setHypothesisSelectionNotice(false);
            return diagnostic.hypothesis.id;
          }
          const fallback = getInitialHypothesisSelection(nextAnalysis);
          setIdentificationTabState(fallback.tab);
          setHypothesisSelectionNotice(current !== null);
          return fallback.id;
        });
        setSelectedIdentificationChannelId((current) => (
          current && nextAnalysis.channels.some((channel) => channel.id === current)
            ? current
            : nextAnalysis.channels[0]?.id ?? null
        ));
        setCalculationStatus("ready");
      } catch (error) {
        if (requestId !== calculationRequest.current) return;
        setParameterError(
          error instanceof Error
            ? error.message
            : "Проверьте выбранные параметры и попробуйте снова.",
        );
        setCalculationStatus("error");
      }
    }, 180);
  }, []);

  useEffect(() => () => {
    if (recalculationTimer.current) clearTimeout(recalculationTimer.current);
  }, []);

  const activateSource = useCallback((source: CreateWorkingAnalysisInput) => {
    calculationRequest.current += 1;
    if (recalculationTimer.current) clearTimeout(recalculationTimer.current);
    sourceRef.current = source;
    parametersRef.current = DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS;
    setParameters(DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS);
    setParameterError(null);
    setSelectedPeakId(null);
    setPeakPanelSection("parameters");
    setAnalysisViewState("composition");
    setSelectedSpectrumType(normalizeSpectrumType(source.spectrumType));
    const nextAnalysis = createWorkingAnalysis(source, DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS);
    const initialHypothesis = getInitialHypothesisSelection(nextAnalysis);
    setSelectedHypothesisId(initialHypothesis.id);
    setIdentificationTabState(initialHypothesis.tab);
    setSelectedIdentificationChannelId(nextAnalysis.channels[0]?.id ?? null);
    setHypothesisSelectionNotice(false);
    setAnalysis(nextAnalysis);
    setCalculationStatus("ready");
  }, []);

  const openDemoAnalysis = useCallback(() => {
    importRequest.current += 1;
    setImportError(null);
    setImportStatus("idle");
    activateSource(DEMO_ANALYSIS_INPUT);
  }, [activateSource]);

  const importSpectrumFile = useCallback(async (file: SpectrumFileLike) => {
    const requestId = importRequest.current + 1;
    importRequest.current = requestId;
    setImportError(null);
    setImportStatus("reading");

    try {
      const parsed = await parseSpectrumFile({
        fileName: file.name,
        data: await file.arrayBuffer(),
      });
      if (requestId !== importRequest.current) return;

      activateSource({
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
    setSelectedPeakId(peakId);
    if (peakId) setPeakPanelSection("selected");
  }, []);

  const selectHypothesis = useCallback((hypothesisId: string, tab?: IdentificationTab) => {
    setSelectedHypothesisId(hypothesisId);
    if (tab) setIdentificationTabState(tab);
    setHypothesisSelectionNotice(false);
  }, []);

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
    setIdentificationTabState(tab);
    const current = analysis;
    if (!current) return;
    const currentExistsInTab = tab === "hypotheses"
      ? current.hypotheses.some((hypothesis) => hypothesis.id === selectedHypothesisId)
        || current.molecularHypotheses.some((hypothesis) => hypothesis.id === selectedHypothesisId)
      : current.rejectedHypotheses.some((item) => item.hypothesis.id === selectedHypothesisId);
    if (!currentExistsInTab) {
      setSelectedHypothesisId(tab === "hypotheses"
        ? current.hypotheses[0]?.id ?? current.molecularHypotheses[0]?.id ?? null
        : current.rejectedHypotheses[0]?.hypothesis.id ?? null);
    }
    setHypothesisSelectionNotice(false);
  }, [analysis, selectedHypothesisId]);

  const selectIdentificationChannel = useCallback((channelId: string) => {
    setSelectedIdentificationChannelId(channelId);
    setSelectedPeakId(null);
  }, []);

  const setAnalysisView = useCallback((view: AnalysisView) => {
    setAnalysisViewState(view);
    if (view === "composition") {
      setPeakPanelSection("parameters");
    } else if (selectedPeakId) {
      setPeakPanelSection("selected");
    }
  }, [selectedPeakId]);

  const value = useMemo(
    () => ({
      analysis,
      parameters,
      calculationStatus,
      parameterError,
      importStatus,
      importError,
      selectedPeakId,
      peakPanelSection,
      selectedHypothesisId,
      identificationTab,
      selectedIdentificationChannelId,
      hypothesisSelectionNotice,
      analysisView,
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
      peakPanelSection,
      selectedHypothesisId,
      identificationTab,
      selectedIdentificationChannelId,
      hypothesisSelectionNotice,
      analysisView,
      selectedSpectrumType,
      resetPeakSearchParameters,
      resetProcessingParameters,
      selectPeak,
      selectedPeakId,
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
    <AnalysisWorkspaceContext.Provider value={value}>
      {children}
    </AnalysisWorkspaceContext.Provider>
  );
}

function getInitialHypothesisSelection(analysis: WorkingAnalysis): { id: string | null; tab: IdentificationTab } {
  if (analysis.hypotheses[0]) return { id: analysis.hypotheses[0].id, tab: "hypotheses" };
  if (analysis.molecularHypotheses[0]) return { id: analysis.molecularHypotheses[0].id, tab: "hypotheses" };
  return { id: null, tab: "hypotheses" };
}

export function useAnalysisWorkspace(): AnalysisWorkspaceContextValue {
  const value = useContext(AnalysisWorkspaceContext);
  if (!value) {
    throw new Error("useAnalysisWorkspace должен использоваться внутри AnalysisWorkspaceProvider.");
  }
  return value;
}
