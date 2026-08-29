import { describe, expect, it } from "vitest";

import { BUILTIN_LIBRARY_VERSION } from "@/domain/spectral-library/builtin-library";

import { createAnalysisSession } from "./model";

describe("createAnalysisSession", () => {
  it("creates a versioned empty workspace", () => {
    const session = createAnalysisSession({
      id: "session-1",
      now: new Date("2026-08-29T10:00:00.000Z"),
    });

    expect(session).toMatchObject({
      schemaVersion: 1,
      id: "session-1",
      status: "empty",
      dataset: null,
      analysisResult: null,
      spectralLibraryVersion: BUILTIN_LIBRARY_VERSION,
      createdAt: "2026-08-29T10:00:00.000Z",
      updatedAt: "2026-08-29T10:00:00.000Z",
    });
  });
});
