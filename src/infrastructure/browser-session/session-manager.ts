import {
  ANALYSIS_SESSION_SCHEMA_VERSION,
  createAnalysisSession,
} from "@/domain/session/model";
import type { AnalysisSession } from "@/domain/session/model";
import type { AnalysisSessionRepository } from "@/domain/session/repository";
import { DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS } from "@/domain/spectrum";

import { IndexedDbAnalysisSessionRepository } from "./indexed-db-session-repository";

const ACTIVE_SESSION_KEY = "spectrography.active-session-id";

export async function loadOrCreateBrowserSession(
  repository: AnalysisSessionRepository = new IndexedDbAnalysisSessionRepository(),
): Promise<AnalysisSession> {
  const storage = getBrowserStorage();
  const activeSessionId = storage.getItem(ACTIVE_SESSION_KEY);

  if (activeSessionId) {
    const existingSession = await repository.findById(activeSessionId);
    if (existingSession) {
      if (existingSession.schemaVersion === ANALYSIS_SESSION_SCHEMA_VERSION) return existingSession;

      const migratedSession = migrateLegacySession(existingSession);
      await repository.save(migratedSession);
      return migratedSession;
    }
  }

  return startNewBrowserSession(repository);
}

function migrateLegacySession(session: AnalysisSession): AnalysisSession {
  const legacySession = session as unknown as Omit<AnalysisSession, "schemaVersion" | "spectrumType"> & {
    readonly schemaVersion?: number;
    readonly spectrumType?: AnalysisSession["spectrumType"];
  };

  return {
    ...legacySession,
    schemaVersion: ANALYSIS_SESSION_SCHEMA_VERSION,
    spectrumType: legacySession.spectrumType ?? "unspecified",
    analysisOptions: {
      ...legacySession.analysisOptions,
      wavelengthCalibration: legacySession.analysisOptions?.wavelengthCalibration
        ?? DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.wavelengthCalibration,
    },
  };
}

export async function startNewBrowserSession(
  repository: AnalysisSessionRepository = new IndexedDbAnalysisSessionRepository(),
): Promise<AnalysisSession> {
  const storage = getBrowserStorage();
  const session = createAnalysisSession({ id: crypto.randomUUID() });
  await repository.save(session);
  storage.setItem(ACTIVE_SESSION_KEY, session.id);
  return session;
}

function getBrowserStorage(): Storage {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("Рабочая сессия доступна только в браузере.");
  }
  return window.localStorage;
}
