"use client";

import { Button } from "@/components/ui/button";
import styles from "./analysis-page.module.css";

/** A selectable analysis result has a different layout from a toolbar action. */
export function ResultChoice({ symbol, name, summary, reason, sensitive, selected, onSelect }: Readonly<{
  symbol: string;
  name: string;
  summary: string;
  reason?: string;
  sensitive?: boolean;
  selected: boolean;
  onSelect: () => void;
}>) {
  return <Button variant="ghost" role="option" aria-selected={selected} className={styles.resultChoice} onClick={onSelect}>
    <span className={styles.resultChoiceTitle}><strong>{symbol}</strong><span>{name}</span></span>
    <span className={styles.resultChoiceSummary}>{summary}</span>
    {sensitive ? <span className={styles.resultChoiceNote}>Чувствительный отбор</span> : null}
    {reason ? <span className={styles.resultChoiceReason}>Не подтверждён: {reason.charAt(0).toLocaleLowerCase("ru") + reason.slice(1)}</span> : null}
  </Button>;
}
