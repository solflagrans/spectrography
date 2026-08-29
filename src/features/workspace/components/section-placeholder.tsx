import { CircleDashed } from "lucide-react";

import { getWorkspaceSection } from "../model/sections";
import type { WorkspaceSectionId } from "../model/sections";
import styles from "./workspace-shell.module.css";

export function SectionPlaceholder({ sectionId }: Readonly<{ sectionId: WorkspaceSectionId }>) {
  const section = getWorkspaceSection(sectionId);
  const Icon = section.icon;

  return (
    <section className={styles.emptySurface} aria-labelledby={`${section.id}-title`}>
      <div className={styles.emptyContent}>
        <span className={styles.stageLabel}>Этап {section.index}</span>
        <div className={styles.emptyIcon} aria-hidden="true">
          <Icon size={26} strokeWidth={1.65} />
        </div>
        <h1 id={`${section.id}-title`}>{section.label}</h1>
        <p>{section.description}</p>
        <div className={styles.emptyStatus}>
          <CircleDashed size={15} strokeWidth={1.8} aria-hidden="true" />
          Интерфейс раздела появится в следующей итерации
        </div>
      </div>
    </section>
  );
}
