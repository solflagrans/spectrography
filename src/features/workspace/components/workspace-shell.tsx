"use client";

import { Activity, CloudOff } from "lucide-react";
import type { ReactNode } from "react";

import { useDemoAnalysis } from "@/features/demo-analysis/model/demo-analysis-context";

import { WorkspaceNavigation } from "./workspace-navigation";
import styles from "./workspace-shell.module.css";

export function WorkspaceShell({ children }: Readonly<{ children: ReactNode }>) {
  const { analysis } = useDemoAnalysis();

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <div className={styles.sessionContext}>
          <span className={styles.contextMark} aria-hidden="true">
            <Activity size={17} strokeWidth={1.8} />
          </span>
          <span className={styles.contextDivider} aria-hidden="true" />
          <span className={styles.contextLabel}>
            {analysis?.title ?? "Локальная рабочая сессия"}
          </span>
        </div>

        <div className={styles.sessionStatus} aria-label="Состояние сессии">
          <span className={styles.draftBadge}>{analysis ? "Демо" : "Черновик"}</span>
          <span className={styles.localOnlyNote}>
            <CloudOff size={14} strokeWidth={1.8} aria-hidden="true" />
            {analysis ? "Состояние не сохраняется" : "Данные остаются в браузере"}
          </span>
        </div>
      </header>

      <WorkspaceNavigation />

      <div className={styles.workspace}>
        <aside className={styles.leftPanel} aria-label="Параметры текущего раздела">
          {analysis ? (
            <>
              <div className={styles.panelHeader}>
                <span>Демонстрация</span>
                <span className={styles.panelMeta}>Только просмотр</span>
              </div>
              <dl className={styles.panelDetails}>
                <div><dt>Набор</dt><dd>Fe-12</dd></div>
                <div><dt>Источник</dt><dd>{analysis.source.format}</dd></div>
                <div><dt>Библиотека</dt><dd>{analysis.libraryVersion}</dd></div>
              </dl>
            </>
          ) : (
            <>
              <div className={styles.panelHeader}>
                <span>Параметры этапа</span>
                <span className={styles.panelMeta}>Не настроены</span>
              </div>
              <div className={styles.parameterList} aria-hidden="true">
                <div className={styles.parameterPlaceholder} />
                <div className={styles.parameterPlaceholder} />
                <div className={styles.parameterPlaceholderShort} />
              </div>
            </>
          )}
        </aside>

        <main className={styles.canvas} aria-label="Рабочая область">
          {children}
        </main>

        <aside className={styles.rightPanel} aria-label="Сводка текущего анализа">
          <div className={styles.panelHeader}>Сводка</div>
          <dl className={styles.summaryList}>
            <div>
              <dt>Источник данных</dt>
              <dd>{analysis?.source.format ?? "—"}</dd>
            </div>
            <div>
              <dt>Точек спектра</dt>
              <dd>{analysis?.rawDataset.wavelengths.length ?? "—"}</dd>
            </div>
            <div>
              <dt>Статус анализа</dt>
              <dd>{analysis ? "Готов" : "Не начат"}</dd>
            </div>
            <div>
              <dt>Найдено пиков</dt>
              <dd>{analysis?.peaks.length ?? "—"}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
