"use client";

import { clsx } from "clsx";
import { Activity } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import {
  AnalysisSidePanel,
  IdentificationLinesPanel,
  ProcessingSettingsPanel,
} from "@/features/demo-analysis/components/analysis-side-panels";
import { useAnalysisWorkspace } from "@/features/demo-analysis/model/analysis-workspace-context";

import { WorkspaceNavigation } from "./workspace-navigation";
import styles from "./workspace-shell.module.css";

export function WorkspaceShell({ children }: Readonly<{ children: ReactNode }>) {
  const { analysis } = useAnalysisWorkspace();
  const pathname = usePathname();
  const sidePanel = analysis
    ? pathname.startsWith("/processing")
      ? <ProcessingSettingsPanel />
      : pathname.startsWith("/analysis")
        ? <AnalysisSidePanel />
        : pathname.startsWith("/identification")
          ? <IdentificationLinesPanel />
          : null
    : null;

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <div className={styles.logo} aria-label="Логотип">
          <span className={styles.logoMark} aria-hidden="true">
            <Activity size={17} strokeWidth={1.8} />
          </span>
        </div>

        {analysis ? (
          <p className={styles.topSummary} aria-label="Сводка анализа">
            {analysis.source.fileName} · {analysis.source.format} · {formatCount(analysis.rawDataset.wavelengths.length, "точка", "точки", "точек")} · {formatRange(analysis.wavelengthRange)} · {formatCount(analysis.peaks.length, "пик", "пика", "пиков")}
          </p>
        ) : null}
      </header>

      <WorkspaceNavigation />

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
  );
}

function formatRange(range: WorkingRange): string {
  return `${formatNumber(range.minimum)}–${formatNumber(range.maximum)} нм`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatCount(value: number, one: string, few: string, many: string): string {
  const mod100 = value % 100;
  const mod10 = value % 10;
  const form = mod100 >= 11 && mod100 <= 14
    ? many
    : mod10 === 1
      ? one
      : mod10 >= 2 && mod10 <= 4
        ? few
        : many;
  return `${value} ${form}`;
}

interface WorkingRange {
  readonly minimum: number;
  readonly maximum: number;
}
