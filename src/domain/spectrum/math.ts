import type { SpectrumStats } from "./types";

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function getSpectrumStats(values: readonly number[]): SpectrumStats {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return {
    mean,
    standardDeviation: Math.sqrt(variance),
    maximum: Math.max(...values),
    minimum: Math.min(...values),
  };
}
