import { createAnalysisSession } from "@/domain/session/model";
import type { AnalysisSession } from "@/domain/session/model";
import type { AnalysisSessionRepository } from "@/domain/session/repository";

import { IndexedDbAnalysisSessionRepository } from "./indexed-db-session-repository";

const ACTIVE_SESSION_KEY = "spectrography.active-session-id";

export async function loadOrCreateBrowserSession(
  repository: AnalysisSessionRepository = new IndexedDbAnalysisSessionRepository(),
): Promise<AnalysisSession> {
  const storage = getBrowserStorage();
  const activeSessionId = storage.getItem(ACTIVE_SESSION_KEY);

  if (activeSessionId) {
    const existingSession = await repository.findById(activeSessionId);
    if (existingSession) return existingSession;
  }

  return startNewBrowserSession(repository);
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
