import type { AnalysisSession } from "./model";

export interface AnalysisSessionRepository {
  findById(id: string): Promise<AnalysisSession | null>;
  save(session: AnalysisSession): Promise<void>;
  remove(id: string): Promise<void>;
}
