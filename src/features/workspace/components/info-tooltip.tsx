"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { createContext, useContext, useId, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import styles from "./info-tooltip.module.css";

interface InfoTooltipContextValue {
  readonly activeId: string | null;
  readonly setActiveId: Dispatch<SetStateAction<string | null>>;
}

const InfoTooltipContext = createContext<InfoTooltipContextValue | null>(null);

export function InfoTooltipProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <Tooltip.Provider delayDuration={250} skipDelayDuration={100}>
      <InfoTooltipContext.Provider value={{ activeId, setActiveId }}>
        {children}
      </InfoTooltipContext.Provider>
    </Tooltip.Provider>
  );
}

export function InfoTooltip({ content, label }: Readonly<{ content: ReactNode; label: string }>) {
  const context = useContext(InfoTooltipContext);
  const id = useId();
  if (!context) throw new Error("InfoTooltip must be rendered inside InfoTooltipProvider");
  const { activeId, setActiveId } = context;
  const open = activeId === id;

  function setOpen(nextOpen: boolean) {
    setActiveId((current) => nextOpen ? id : current === id ? null : current);
  }

  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger asChild>
        <button
          className={styles.trigger}
          type="button"
          aria-label={`Подсказка: ${label}`}
          onClick={() => setOpen(!open)}
        >
          <Info size={14} aria-hidden="true" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className={styles.content} sideOffset={6} collisionPadding={8}>
          {content}
          <Tooltip.Arrow className={styles.arrow} width={10} height={5} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
