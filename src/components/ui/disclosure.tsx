import { clsx } from "clsx";
import type { ComponentPropsWithRef, ReactNode } from "react";
import styles from "./disclosure.module.css";

export function Disclosure({ title, children, className, contentClassName, ...props }: Omit<ComponentPropsWithRef<"details">, "title"> & { title: ReactNode; contentClassName?: string }) {
  return <details className={clsx(styles.root, className)} {...props}><summary>{title}</summary><div className={clsx(styles.content, contentClassName)}>{children}</div></details>;
}
