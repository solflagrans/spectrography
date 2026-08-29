import { Activity, CloudOff } from "lucide-react";
import type { ReactNode } from "react";

import { WorkspaceNavigation } from "./workspace-navigation";
import styles from "./workspace-shell.module.css";

export function WorkspaceShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <div className={styles.sessionContext}>
          <span className={styles.contextMark} aria-hidden="true">
            <Activity size={17} strokeWidth={1.8} />
          </span>
          <span className={styles.contextDivider} aria-hidden="true" />
          <span className={styles.contextLabel}>Локальная рабочая сессия</span>
        </div>

        <div className={styles.sessionStatus} aria-label="Состояние сессии">
          <span className={styles.draftBadge}>Черновик</span>
          <span className={styles.localOnlyNote}>
            <CloudOff size={14} strokeWidth={1.8} aria-hidden="true" />
            Данные остаются в браузере
          </span>
        </div>
      </header>

      <WorkspaceNavigation />

      <div className={styles.workspace}>
        <aside className={styles.leftPanel} aria-label="Параметры текущего раздела">
          <div className={styles.panelHeader}>
            <span>Параметры этапа</span>
            <span className={styles.panelMeta}>Не настроены</span>
          </div>
          <div className={styles.parameterList} aria-hidden="true">
            <div className={styles.parameterPlaceholder} />
            <div className={styles.parameterPlaceholder} />
            <div className={styles.parameterPlaceholderShort} />
          </div>
        </aside>

        <main className={styles.canvas} aria-label="Рабочая область">
          {children}
        </main>

        <aside className={styles.rightPanel} aria-label="Сводка текущего анализа">
          <div className={styles.panelHeader}>Сводка</div>
          <dl className={styles.summaryList}>
            <div>
              <dt>Источник данных</dt>
              <dd>—</dd>
            </div>
            <div>
              <dt>Точек спектра</dt>
              <dd>—</dd>
            </div>
            <div>
              <dt>Статус анализа</dt>
              <dd>Не начат</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
