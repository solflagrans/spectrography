// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { createAnalysisSession } from "@/domain/session/model";
import type { AnalysisSession } from "@/domain/session/model";
import type { AnalysisSessionRepository } from "@/domain/session/repository";

import { loadOrCreateBrowserSession } from "./session-manager";

const ACTIVE_SESSION_KEY = "spectrography.active-session-id";

class MemorySessionRepository implements AnalysisSessionRepository {
  readonly sessions = new Map<string, AnalysisSession>();

  async findById(id: string): Promise<AnalysisSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async save(session: AnalysisSession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async remove(id: string): Promise<void> {
    this.sessions.delete(id);
  }
}

beforeEach(() => window.localStorage.clear());

describe("browser analysis session migration", () => {
  it("adds an unspecified spectrum type to a legacy session without assuming plasma emission", async () => {
    const repository = new MemorySessionRepository();
    const current = createAnalysisSession({ id: "legacy-session", now: new Date("2026-01-01T00:00:00Z") });
    const { spectrumType, ...legacy } = current;
    expect(spectrumType).toBe("unspecified");
    const { wavelengthCalibration, ...legacyAnalysisOptions } = current.analysisOptions;
    expect(wavelengthCalibration.allowAutomaticCorrection).toBe(true);
    repository.sessions.set(current.id, { ...legacy, schemaVersion: 1, analysisOptions: legacyAnalysisOptions } as unknown as AnalysisSession);
    window.localStorage.setItem(ACTIVE_SESSION_KEY, current.id);

    const migrated = await loadOrCreateBrowserSession(repository);

    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.spectrumType).toBe("unspecified");
    expect(migrated.analysisOptions.wavelengthCalibration.allowAutomaticCorrection).toBe(true);
    expect(repository.sessions.get(current.id)).toEqual(migrated);
  });

  it("keeps an explicitly saved plasma-emission type", async () => {
    const repository = new MemorySessionRepository();
    const current = { ...createAnalysisSession({ id: "plasma-session" }), spectrumType: "plasma-emission" as const };
    repository.sessions.set(current.id, current);
    window.localStorage.setItem(ACTIVE_SESSION_KEY, current.id);

    await expect(loadOrCreateBrowserSession(repository)).resolves.toMatchObject({
      id: current.id,
      spectrumType: "plasma-emission",
    });
  });
});
