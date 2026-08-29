import { BUILTIN_LIBRARY_VERSION } from "@/domain/spectral-library/builtin-library";
import { DEFAULT_ANALYSIS_OPTIONS } from "@/domain/spectrum";
import type { AnalysisOptions, SpectrumAnalysisResult, SpectrumDataset } from "@/domain/spectrum";

export const ANALYSIS_SESSION_SCHEMA_VERSION = 1 as const;

export type AnalysisSessionStatus = "empty" | "dataset-ready" | "analyzed";

export interface AnalysisSession {
  readonly schemaVersion: typeof ANALYSIS_SESSION_SCHEMA_VERSION;
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: AnalysisSessionStatus;
  readonly dataset: SpectrumDataset | null;
  readonly analysisOptions: AnalysisOptions;
  readonly analysisResult: SpectrumAnalysisResult | null;
  readonly spectralLibraryVersion: string;
}

export interface CreateAnalysisSessionInput {
  readonly id: string;
  readonly now?: Date;
}

export function createAnalysisSession({ id, now = new Date() }: CreateAnalysisSessionInput): AnalysisSession {
  if (!id.trim()) throw new Error("Идентификатор сессии не может быть пустым.");

  const timestamp = now.toISOString();
  return {
    schemaVersion: ANALYSIS_SESSION_SCHEMA_VERSION,
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "empty",
    dataset: null,
    analysisOptions: DEFAULT_ANALYSIS_OPTIONS,
    analysisResult: null,
    spectralLibraryVersion: BUILTIN_LIBRARY_VERSION,
  };
}
