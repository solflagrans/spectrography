"use client";

import { clsx } from "clsx";
import { Activity } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import {
  AnalysisSidePanel,
  ProcessingSettingsPanel,
} from "@/features/demo-analysis/components/analysis-side-panels";
import { MobilePeakInspector, useNarrowViewport } from "@/features/demo-analysis/components/peak-inspector-surface";
import { useAnalysisWorkspace } from "@/features/demo-analysis/model/analysis-workspace-context";
import { formatDecimal } from "@/features/workspace/model/display-format";

import { InfoTooltipProvider } from "./info-tooltip";
import { WorkspaceNavigation } from "./workspace-navigation";
import styles from "./workspace-shell.module.css";

export function WorkspaceShell({ children }: Readonly<{ children: ReactNode }>) {
  const { analysis, analysisView } = useAnalysisWorkspace();
  const pathname = usePathname();
  const narrow = useNarrowViewport();
  const peakWorkspace = pathname.startsWith("/analysis") && analysisView === "peaks" && Boolean(analysis);
  const mobileInspector = peakWorkspace && narrow;
  const sidePanel = analysis
    ? pathname.startsWith("/processing")
      ? <ProcessingSettingsPanel />
      : pathname.startsWith("/analysis")
        ? <AnalysisSidePanel />
        : null
    : null;

  return (
    <InfoTooltipProvider>
      <div className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.logo} aria-label="Анализ спектра">
            <span className={styles.logoMark} aria-hidden="true">
              <Activity size={17} strokeWidth={1.8} />
            </span>
            <span className={styles.productName}>Анализ спектра</span>
          </div>

          <WorkspaceNavigation />

          {analysis ? (
            <p className={styles.topSummary} aria-label="Сводка анализа">
              {analysis.source.fileName} · {formatRange(analysis.wavelengthRange)}
            </p>
          ) : null}
        </header>

        <div className={clsx(styles.workspace, sidePanel && !mobileInspector && styles.workspaceWithPanel, sidePanel && pathname.startsWith("/analysis") && styles.analysisWorkspace, sidePanel && pathname.startsWith("/processing") && styles.processingWorkspace)}>
          {sidePanel && !mobileInspector ? (
            <aside className={clsx(styles.leftPanel, pathname.startsWith("/processing") && styles.processingPanel, pathname.startsWith("/analysis") && styles.rightPanel, pathname.startsWith("/analysis") && analysisView === "composition" && styles.analysisLeftPanel)} aria-label="Панель текущего раздела">
              {sidePanel}
            </aside>
          ) : null}

          <main className={styles.canvas} aria-label="Рабочая область">
            {children}
          </main>
          {mobileInspector ? <MobilePeakInspector /> : null}
        </div>
      </div>
    </InfoTooltipProvider>
  );
}

function formatRange(range: WorkingRange): string {
  return `${formatNumber(range.minimum)}–${formatNumber(range.maximum)} нм`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : formatDecimal(value, 2);
}

interface WorkingRange {
  readonly minimum: number;
  readonly maximum: number;
}
