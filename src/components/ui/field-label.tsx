import type { ReactNode } from "react";
import { clsx } from "clsx";
import styles from "./surfaces.module.css";

export function FieldLabel({ htmlFor, label, help, className }: Readonly<{ htmlFor: string; label: string; help?: ReactNode; className?: string }>) {
  return <div className={clsx(styles.fieldLabel, className)}><label htmlFor={htmlFor}>{label}</label>{help}</div>;
}
