"use client";

import { clsx } from "clsx";
import { Activity } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import {
  IdentificationLinesPanel,
  PeakSettingsPanel,
  ProcessingSettingsPanel,
} from "@/features/demo-analysis/components/analysis-side-panels";
import { useDemoAnalysis } from "@/features/demo-analysis/model/demo-analysis-context";

import { WorkspaceNavigation } from "./workspace-navigation";
import styles from "./workspace-shell.module.css";

export function WorkspaceShell({ children }: Readonly<{ children: ReactNode }>) {
  const { analysis } = useDemoAnalysis();
  const pathname = usePathname();
  const sidePanel = analysis
    ? pathname.startsWith("/processing")
      ? <ProcessingSettingsPanel />
      : pathname.startsWith("/peaks")
        ? <PeakSettingsPanel />
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
            {analysis.source.format} · {analysis.rawDataset.wavelengths.length} точки · {analysis.peaks.length} пиков
          </p>
        ) : null}
      </header>

      <WorkspaceNavigation />

      <div className={clsx(styles.workspace, sidePanel && styles.workspaceWithPanel)}>
        {sidePanel ? (
          <aside className={styles.leftPanel} aria-label="Панель текущего раздела">
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
