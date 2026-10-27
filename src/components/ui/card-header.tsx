import { clsx } from "clsx";
import type { ReactNode } from "react";
import styles from "./surfaces.module.css";

export function CardHeader({ title, description, accessory, className, headingClassName }: Readonly<{
  title: ReactNode; description?: ReactNode; accessory?: ReactNode; className?: string; headingClassName?: string;
}>) {
  return <header data-ui="card-header" className={clsx(styles.cardHeader, className)}>
    <div className={clsx(styles.cardHeading, headingClassName)}><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
    {accessory}
  </header>;
}

export function MetricList({ items, className }: Readonly<{ items: readonly (readonly [string, ReactNode])[]; className?: string }>) {
  return <dl data-ui="metrics" className={clsx(styles.metrics, className)}>{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
