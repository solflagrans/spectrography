"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { clsx } from "clsx";
import { X } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button } from "./button";
import styles from "./dialog.module.css";

export function DialogSurface({ className, variant = "modal", ...props }: ComponentPropsWithoutRef<typeof Dialog.Content> & { variant?: "modal" | "drawer" }) {
  return <Dialog.Portal><Dialog.Overlay className={clsx(styles.overlay, variant === "drawer" && styles.drawerOverlay)} /><Dialog.Content aria-describedby={undefined} className={clsx(styles.surface, styles[variant], className)} {...props} /></Dialog.Portal>;
}

export function DialogHeader({ title, closeLabel = "Закрыть", className }: Readonly<{ title: ReactNode; closeLabel?: string; className?: string }>) {
  return <div className={clsx(styles.header, className)}><Dialog.Title>{title}</Dialog.Title><Dialog.Close asChild><Button size="icon" aria-label={closeLabel}><X size={18} aria-hidden="true" /></Button></Dialog.Close></div>;
}
