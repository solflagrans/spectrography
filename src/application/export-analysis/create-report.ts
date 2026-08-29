import type { AnalysisSession } from "@/domain/session/model";

export interface AnalysisReport {
  readonly schemaVersion: 1;
  readonly createdAt: string;
  readonly sessionId: string;
  readonly spectralLibraryVersion: string;
  readonly dataset: AnalysisSession["dataset"];
  readonly analysisOptions: AnalysisSession["analysisOptions"];
  readonly analysisResult: AnalysisSession["analysisResult"];
}

export function createAnalysisReport(
  session: AnalysisSession,
  createdAt = new Date(),
): AnalysisReport {
  return {
    schemaVersion: 1,
    createdAt: createdAt.toISOString(),
    sessionId: session.id,
    spectralLibraryVersion: session.spectralLibraryVersion,
    dataset: session.dataset,
    analysisOptions: session.analysisOptions,
    analysisResult: session.analysisResult,
  };
}
