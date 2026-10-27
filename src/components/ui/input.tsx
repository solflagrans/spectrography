"use client";

import { clsx } from "clsx";
import type { ComponentPropsWithRef, CSSProperties } from "react";
import styles from "./controls.module.css";

export function Input({ className, ...props }: ComponentPropsWithRef<"input">) {
  return <input data-ui="input" className={clsx(styles.input, className)} {...props} />;
}

export function Checkbox({ className, ...props }: Omit<ComponentPropsWithRef<"input">, "type">) {
  return <input type="checkbox" data-ui="checkbox" className={clsx(styles.checkbox, className)} {...props} />;
}

export function Switch({ className, ...props }: Omit<ComponentPropsWithRef<"input">, "type" | "role">) {
  return <input type="checkbox" role="switch" data-ui="switch" className={clsx(styles.switch, className)} {...props} />;
}

export function RangeInput({ className, min = 0, max = 100, value, style, ...props }: Omit<ComponentPropsWithRef<"input">, "type">) {
  const progress = Math.max(0, Math.min(100, (Number(value) - Number(min)) / (Number(max) - Number(min)) * 100));
  return <input type="range" data-ui="range" className={clsx(styles.range, className)} min={min} max={max} value={value} style={{ ...style, "--range-progress": `${progress}%` } as CSSProperties} {...props} />;
}
