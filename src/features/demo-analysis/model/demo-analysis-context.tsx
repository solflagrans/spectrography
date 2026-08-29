"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { createDemoAnalysis } from "@/application/demo-analysis/create-demo-analysis";
import type { DemoAnalysis } from "@/application/demo-analysis/create-demo-analysis";
import { DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS } from "@/domain/spectrum";
import type {
  InteractiveAnalysisParameters,
  PeakSearchParameters,
  SpectrumProcessingParameters,
} from "@/domain/spectrum";

export type DemoCalculationStatus = "idle" | "calculating" | "ready" | "error";

interface DemoAnalysisContextValue {
  readonly analysis: DemoAnalysis | null;
  readonly parameters: InteractiveAnalysisParameters;
  readonly calculationStatus: DemoCalculationStatus;
  readonly parameterError: string | null;
  readonly openDemoAnalysis: () => void;
  readonly updateProcessingParameters: (patch: Partial<SpectrumProcessingParameters>) => void;
  readonly updatePeakSearchParameters: (patch: Partial<PeakSearchParameters>) => void;
  readonly resetProcessingParameters: () => void;
  readonly resetPeakSearchParameters: () => void;
}

const DemoAnalysisContext = createContext<DemoAnalysisContextValue | null>(null);

export function DemoAnalysisProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [analysis, setAnalysis] = useState<DemoAnalysis | null>(null);
  const [parameters, setParameters] = useState<InteractiveAnalysisParameters>(
    DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  );
  const [calculationStatus, setCalculationStatus] = useState<DemoCalculationStatus>("idle");
  const [parameterError, setParameterError] = useState<string | null>(null);
  const recalculationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisIsOpen = useRef(false);
  const parametersRef = useRef<InteractiveAnalysisParameters>(
    DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  );

  const calculate = useCallback((nextParameters: InteractiveAnalysisParameters) => {
    if (recalculationTimer.current) clearTimeout(recalculationTimer.current);
    setParameterError(null);
    setCalculationStatus("calculating");
    recalculationTimer.current = setTimeout(() => {
      try {
        setAnalysis(createDemoAnalysis(nextParameters));
        setCalculationStatus("ready");
      } catch (error) {
        setParameterError(
          error instanceof Error ? error.message : "Не удалось пересчитать демонстрационный анализ.",
        );
        setCalculationStatus("error");
      }
    }, 180);
  }, []);

  useEffect(() => () => {
    if (recalculationTimer.current) clearTimeout(recalculationTimer.current);
  }, []);

  const openDemoAnalysis = useCallback(() => {
    analysisIsOpen.current = true;
    parametersRef.current = DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS;
    setParameterError(null);
    setParameters(DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS);
    setAnalysis(createDemoAnalysis(DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS));
    setCalculationStatus("ready");
  }, []);

  const updateProcessingParameters = useCallback(
    (patch: Partial<SpectrumProcessingParameters>) => {
      const current = parametersRef.current;
      const next = { ...current, processing: { ...current.processing, ...patch } };
      parametersRef.current = next;
      setParameters(next);
      if (analysisIsOpen.current) calculate(next);
    },
    [calculate],
  );

  const updatePeakSearchParameters = useCallback(
    (patch: Partial<PeakSearchParameters>) => {
      const current = parametersRef.current;
      const next = { ...current, peakSearch: { ...current.peakSearch, ...patch } };
      parametersRef.current = next;
      setParameters(next);
      if (analysisIsOpen.current) calculate(next);
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
    if (analysisIsOpen.current) calculate(next);
  }, [calculate]);

  const resetPeakSearchParameters = useCallback(() => {
    const next = {
      ...parametersRef.current,
      peakSearch: DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch,
    };
    parametersRef.current = next;
    setParameters(next);
    if (analysisIsOpen.current) calculate(next);
  }, [calculate]);

  const value = useMemo(
    () => ({
      analysis,
      parameters,
      calculationStatus,
      parameterError,
      openDemoAnalysis,
      updateProcessingParameters,
      updatePeakSearchParameters,
      resetPeakSearchParameters,
      resetProcessingParameters,
    }),
    [
      analysis,
      calculationStatus,
      openDemoAnalysis,
      parameterError,
      parameters,
      resetPeakSearchParameters,
      resetProcessingParameters,
      updatePeakSearchParameters,
      updateProcessingParameters,
    ],
  );

  return <DemoAnalysisContext.Provider value={value}>{children}</DemoAnalysisContext.Provider>;
}

export function useDemoAnalysis(): DemoAnalysisContextValue {
  const value = useContext(DemoAnalysisContext);
  if (!value) throw new Error("useDemoAnalysis должен использоваться внутри DemoAnalysisProvider.");
  return value;
}
