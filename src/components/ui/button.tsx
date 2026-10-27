"use client";

import { Slot } from "@radix-ui/react-slot";
import { clsx } from "clsx";
import type { ComponentPropsWithRef } from "react";

import styles from "./button.module.css";

type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: "secondary" | "primary" | "ghost" | "text";
  size?: "default" | "compact" | "icon" | "hint";
  /** Preserve link or Radix semantics without nesting interactive elements. */
  asChild?: boolean;
};

export function Button({ variant = "secondary", size = "default", asChild = false, className, type = "button", ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component {...(!asChild ? { type } : {})} className={clsx(styles.button, styles[variant], styles[size], className)} {...props} />;
}
