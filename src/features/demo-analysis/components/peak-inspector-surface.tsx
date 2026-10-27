"use client";
import { Button } from "@/components/ui/button";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useAnalysisWorkspace, usePeakInspectorUi } from "../model/analysis-workspace-context";
import { PeakSettingsPanel } from "./analysis-side-panels";
import styles from "./analysis-page.module.css";

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.("(max-width: 820px)");
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}
export function useNarrowViewport() {
  return useSyncExternalStore(subscribe, () => window.matchMedia?.("(max-width: 820px)").matches ?? false, () => false);
}
export function MobilePeakInspector() {
  const { selectedPeakId } = useAnalysisWorkspace();
  const { open, setOpen } = usePeakInspectorUi();
  return <Dialog.Root open={open && Boolean(selectedPeakId)} onOpenChange={setOpen}>
    {selectedPeakId ? <Dialog.Trigger asChild><Button className={styles.mobileInspectorTrigger}>Открыть выбранный пик</Button></Dialog.Trigger> : null}
    <Dialog.Portal><Dialog.Overlay className={styles.dialogOverlay} />
      <Dialog.Content className={styles.inspectorDrawer} aria-describedby={undefined}>
        <Dialog.Title className={styles.visuallyHidden}>Инспектор пика</Dialog.Title>
        <Dialog.Close asChild><Button size="icon" className={styles.drawerClose} aria-label="Закрыть инспектор"><X size={18} /></Button></Dialog.Close>
        <PeakSettingsPanel />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
