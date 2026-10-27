"use client";

import { Disclosure } from "@/components/ui/disclosure";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { AnalysisCalculationStatus } from "../model/analysis-workspace-context";
import styles from "./analysis-page.module.css";

/** A parameter editor stays available when its last edit failed validation. */
export function SettingsDisclosure({ title, value, children, status = "idle", error = null, readOnly = false, invalid = false }: Readonly<{
  title: string;
  value?: string;
  children: ReactNode;
  status?: AnalysisCalculationStatus;
  error?: string | null;
  readOnly?: boolean;
  invalid?: boolean;
}>) {
  const details = useRef<HTMLDetailsElement>(null);
  const edited = useRef(false);
  const blocked = useRef(false);

  useEffect(() => {
    if (error && (edited.current || invalid)) {
      blocked.current = true;
      if (details.current) details.current.open = true;
    } else if (status === "ready" && !error) {
      edited.current = false;
      blocked.current = false;
    }
  }, [error, invalid, status]);

  return <Disclosure title={<span className={styles.disclosureSummary}><span>{title}</span>{value ? <span className={styles.disclosureValue}>{value}</span> : null}</span>} contentClassName={styles.disclosureContent} ref={details} className={styles.settingsDisclosure} data-disclosure-kind={readOnly ? "result" : "parameter"}
    onChangeCapture={() => { edited.current = true; }}
    onToggle={(event) => { if (blocked.current && !event.currentTarget.open) event.currentTarget.open = true; }}>
    {children}
  </Disclosure>;
}
