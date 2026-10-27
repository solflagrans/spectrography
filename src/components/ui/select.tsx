"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "./button";
import menuStyles from "./menu-surface.module.css";
import styles from "./select.module.css";

type SelectProps = Pick<ComponentProps<"button">, "id" | "className" | "aria-label" | "aria-labelledby" | "aria-describedby" | "disabled"> & {
  value: string | number;
  onValueChange: (value: string) => void;
  children: ReactNode;
  placeholder?: string;
};

export function Select({ value, onValueChange, children, placeholder = "Выбрать", disabled, className, ...props }: SelectProps) {
  return <SelectPrimitive.Root value={String(value)} onValueChange={onValueChange} disabled={disabled}>
    <SelectPrimitive.Trigger asChild>
      <Button {...props} className={clsx(styles.trigger, className)} data-ui="select">
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild><ChevronDown size={14} aria-hidden="true" /></SelectPrimitive.Icon>
      </Button>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content position="popper" align="start" sideOffset={6} collisionPadding={12} className={clsx(menuStyles.content, styles.content)}>
        <SelectPrimitive.Viewport className={styles.viewport}>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}

export function SelectItem({ value, children, disabled }: { value: string | number; children: ReactNode; disabled?: boolean }) {
  return <SelectPrimitive.Item value={String(value)} disabled={disabled} className={menuStyles.item}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className={styles.indicator}><Check size={14} aria-hidden="true" /></SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>;
}
