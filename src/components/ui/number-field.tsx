"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useRef } from "react";
import { Button } from "./button";
import { Input } from "./input";
import styles from "./controls.module.css";

/** Keep typing local; commit only on blur, Enter, or an explicit step. */
export function NumberField({ id, label, value, min, max, step, onCommit }: Readonly<{
  id: string; label?: string; value: number; min: number; max: number; step: number; onCommit: (value: number) => void;
}>) {
  const input = useRef<HTMLInputElement>(null);
  const commit = (field: HTMLInputElement) => {
    const parsed = Number(field.value);
    if (!field.value.trim() || !Number.isFinite(parsed)) { field.value = String(value); return; }
    field.value = String(parsed);
    if (parsed !== value) onCommit(parsed);
  };
  const changeStep = (direction: number) => {
    if (!input.current) return;
    if (direction > 0) input.current.stepUp(); else input.current.stepDown();
    commit(input.current);
  };
  return <span data-ui="number-field" className={styles.numberField}>
    <Input ref={input} key={`${id}:${value}`} id={id} aria-label={label} type="number" defaultValue={value} min={min} max={max} step={step}
      onBlur={(event) => commit(event.currentTarget)} onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") { event.currentTarget.value = String(value); event.currentTarget.blur(); }
      }} />
    <span className={styles.steppers}>
      <Button size="hint" variant="ghost" aria-label={`Увеличить: ${label ?? id}`} onPointerDown={(event) => event.preventDefault()} onClick={() => changeStep(1)}><ChevronUp size={12} /></Button>
      <Button size="hint" variant="ghost" aria-label={`Уменьшить: ${label ?? id}`} onPointerDown={(event) => event.preventDefault()} onClick={() => changeStep(-1)}><ChevronDown size={12} /></Button>
    </span>
  </span>;
}
