"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { createDemoAnalysis } from "@/application/demo-analysis/create-demo-analysis";
import type { DemoAnalysis } from "@/application/demo-analysis/create-demo-analysis";

interface DemoAnalysisContextValue {
  readonly analysis: DemoAnalysis | null;
  readonly openDemoAnalysis: () => void;
}

const DemoAnalysisContext = createContext<DemoAnalysisContextValue | null>(null);

export function DemoAnalysisProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [analysis, setAnalysis] = useState<DemoAnalysis | null>(null);
  const openDemoAnalysis = useCallback(() => setAnalysis(createDemoAnalysis()), []);
  const value = useMemo(() => ({ analysis, openDemoAnalysis }), [analysis, openDemoAnalysis]);

  return <DemoAnalysisContext.Provider value={value}>{children}</DemoAnalysisContext.Provider>;
}

export function useDemoAnalysis(): DemoAnalysisContextValue {
  const value = useContext(DemoAnalysisContext);
  if (!value) throw new Error("useDemoAnalysis должен использоваться внутри DemoAnalysisProvider.");
  return value;
}
