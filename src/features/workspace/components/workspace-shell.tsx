"use client";

import { clsx } from "clsx";
import { Activity } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import {
  AnalysisSidePanel,
  ProcessingSettingsPanel,
} from "@/features/demo-analysis/components/analysis-side-panels";
import { useAnalysisWorkspaceCore } from "@/features/demo-analysis/model/analysis-workspace-context";
import { formatDecimal } from "@/features/workspace/model/display-format";

import { InfoTooltipProvider } from "./info-tooltip";
import { WorkspaceNavigation } from "./workspace-navigation";
import styles from "./workspace-shell.module.css";

export function WorkspaceShell({ children }: Readonly<{ children: ReactNode }>) {
  const { analysis } = useAnalysisWorkspaceCore();
  const pathname = usePathname();
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
          <div className={styles.logo} aria-label="Интерпретатор спектра">
            <span className={styles.logoMark} aria-hidden="true">
              <Activity size={17} strokeWidth={1.8} />
            </span>
            <span className={styles.productName}>Интерпретатор спектра</span>
          </div>

          <WorkspaceNavigation />

          {analysis ? (
            <p className={styles.topSummary} aria-label="Сводка анализа">
              {analysis.source.fileName} · {formatRange(analysis.wavelengthRange)}
            </p>
          ) : null}
        </header>

        <div className={clsx(styles.workspace, sidePanel && styles.workspaceWithPanel)}>
          {sidePanel ? (
            <aside className={clsx(styles.leftPanel, pathname.startsWith("/analysis") && styles.analysisLeftPanel)} aria-label="Панель текущего раздела">
              {sidePanel}
            </aside>
          ) : null}

          <main className={styles.canvas} aria-label="Рабочая область">
            {children}
          </main>
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
