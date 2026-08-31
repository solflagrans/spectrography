import type { AnalysisSession } from "@/domain/session/model";

export interface AnalysisReport {
  readonly schemaVersion: 3;
  readonly createdAt: string;
  readonly sessionId: string;
  readonly spectralLibraryVersion: string;
  readonly spectrumType: AnalysisSession["spectrumType"];
  readonly dataset: AnalysisSession["dataset"];
  readonly analysisOptions: AnalysisSession["analysisOptions"];
  readonly analysisResult: AnalysisSession["analysisResult"];
}

export function createAnalysisReport(
  session: AnalysisSession,
  createdAt = new Date(),
): AnalysisReport {
  return {
    schemaVersion: 3,
    createdAt: createdAt.toISOString(),
    sessionId: session.id,
    spectralLibraryVersion: session.spectralLibraryVersion,
    spectrumType: session.spectrumType,
    dataset: session.dataset,
    analysisOptions: session.analysisOptions,
    analysisResult: session.analysisResult,
  };
}
