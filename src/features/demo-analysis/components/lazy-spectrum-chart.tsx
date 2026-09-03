"use client";

import { lazy, Suspense } from "react";

import type { SpectrumChartProps } from "./spectrum-chart";

const LazySpectrumChart = lazy(async () => ({
  default: (await import("./spectrum-chart")).SpectrumChart,
}));

export function SpectrumChart(props: SpectrumChartProps) {
  return (
    <Suspense fallback={<div role="status">Загружаем интерактивный график…</div>}>
      <LazySpectrumChart {...props} />
    </Suspense>
  );
}
