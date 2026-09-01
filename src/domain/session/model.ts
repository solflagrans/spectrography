import { BUILTIN_LIBRARY_VERSION } from "@/domain/spectral-library/builtin-library";
import { DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS, DEFAULT_SPECTRUM_TYPE } from "@/domain/spectrum";
import type {
  InteractiveAnalysisParameters,
  InteractiveSpectrumAnalysis,
  SpectrumDataset,
  SpectrumType,
} from "@/domain/spectrum";

export const ANALYSIS_SESSION_SCHEMA_VERSION = 3 as const;

export type AnalysisSessionStatus = "empty" | "dataset-ready" | "analyzed";

export interface AnalysisSession {
  readonly schemaVersion: typeof ANALYSIS_SESSION_SCHEMA_VERSION;
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: AnalysisSessionStatus;
  readonly spectrumType: SpectrumType;
  readonly dataset: SpectrumDataset | null;
  readonly analysisOptions: InteractiveAnalysisParameters;
  readonly analysisResult: InteractiveSpectrumAnalysis | null;
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
    spectrumType: DEFAULT_SPECTRUM_TYPE,
    dataset: null,
    analysisOptions: DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
    analysisResult: null,
    spectralLibraryVersion: BUILTIN_LIBRARY_VERSION,
  };
}
