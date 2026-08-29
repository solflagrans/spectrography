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
import { DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS } from "@/domain/spectrum";
import type {
  InteractiveAnalysisParameters,
  PeakSearchParameters,
  SpectrumProcessingParameters,
} from "@/domain/spectrum";

export type AnalysisCalculationStatus = "idle" | "calculating" | "ready" | "error";
export type SpectrumImportStatus = "idle" | "reading" | "error";

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
  readonly openDemoAnalysis: () => void;
  readonly importSpectrumFile: (file: SpectrumFileLike) => Promise<void>;
  readonly updateProcessingParameters: (patch: Partial<SpectrumProcessingParameters>) => void;
  readonly updatePeakSearchParameters: (patch: Partial<PeakSearchParameters>) => void;
  readonly resetProcessingParameters: () => void;
  readonly resetPeakSearchParameters: () => void;
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
  const recalculationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceRef = useRef<CreateWorkingAnalysisInput | null>(null);
  const parametersRef = useRef<InteractiveAnalysisParameters>(
    DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  );
  const importRequest = useRef(0);

  const calculate = useCallback((nextParameters: InteractiveAnalysisParameters) => {
    const source = sourceRef.current;
    if (!source) return;
    if (recalculationTimer.current) clearTimeout(recalculationTimer.current);
    setParameterError(null);
    setCalculationStatus("calculating");
    recalculationTimer.current = setTimeout(() => {
      try {
        setAnalysis(createWorkingAnalysis(source, nextParameters));
        setCalculationStatus("ready");
      } catch (error) {
        setParameterError(
          error instanceof Error ? error.message : "Не удалось пересчитать анализ.",
        );
        setCalculationStatus("error");
      }
    }, 180);
  }, []);

  useEffect(() => () => {
    if (recalculationTimer.current) clearTimeout(recalculationTimer.current);
  }, []);

  const activateSource = useCallback((source: CreateWorkingAnalysisInput) => {
    if (recalculationTimer.current) clearTimeout(recalculationTimer.current);
    sourceRef.current = source;
    parametersRef.current = DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS;
    setParameters(DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS);
    setParameterError(null);
    setAnalysis(createWorkingAnalysis(source, DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS));
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
      setImportError(error instanceof Error ? error.message : "Не удалось прочитать файл спектра.");
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

  const value = useMemo(
    () => ({
      analysis,
      parameters,
      calculationStatus,
      parameterError,
      importStatus,
      importError,
      openDemoAnalysis,
      importSpectrumFile,
      updateProcessingParameters,
      updatePeakSearchParameters,
      resetPeakSearchParameters,
      resetProcessingParameters,
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
      resetPeakSearchParameters,
      resetProcessingParameters,
      updatePeakSearchParameters,
      updateProcessingParameters,
    ],
  );

  return (
    <AnalysisWorkspaceContext.Provider value={value}>
      {children}
    </AnalysisWorkspaceContext.Provider>
  );
}

export function useAnalysisWorkspace(): AnalysisWorkspaceContextValue {
  const value = useContext(AnalysisWorkspaceContext);
  if (!value) {
    throw new Error("useAnalysisWorkspace должен использоваться внутри AnalysisWorkspaceProvider.");
  }
  return value;
}
