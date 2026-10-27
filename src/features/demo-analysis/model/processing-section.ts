"use client";

import { useSyncExternalStore } from "react";

export type ProcessingSection = "preparation-settings" | "peak-settings" | "composition-settings";

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getSection(): ProcessingSection {
  const hash = window.location.hash;
  return hash === "#peak-settings" ? "peak-settings" : hash === "#composition-settings" ? "composition-settings" : "preparation-settings";
}

export function useProcessingSection() {
  return useSyncExternalStore(subscribe, getSection, () => "preparation-settings" as const);
}
