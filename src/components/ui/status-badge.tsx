import type { ReactNode } from "react";
import styles from "./status-badge.module.css";

export function StatusBadge({ tone = "neutral", children }: Readonly<{ tone?: "neutral" | "success" | "warning" | "danger" | "info"; children: ReactNode }>) {
  return <span className={styles.badge} data-tone={tone}>{children}</span>;
}
