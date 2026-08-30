import { describe, expect, it } from "vitest";

import { NIST_ASD_ATTRIBUTION } from "./selection";
import type { SpectralLibraryManifest } from "./types";
import { validateSpectralLibraryManifest } from "./validation";

const manifest: SpectralLibraryManifest = {
  schemaVersion: 1,
  name: "Test NIST library",
  version: "test-1",
  source: "NIST Atomic Spectra Database",
  nistAsdVersion: "5.12",
  doi: "10.18434/T4W30F",
  retrievedAt: "2026-08-30",
  attribution: NIST_ASD_ATTRIBUTION,
  query: {
    elements: ["H"],
    ionizationStages: [1, 2],
    wavelengthRangeNm: { minimum: 200, maximum: 1000 },
    wavelengthMediumPolicy: "air",
    lineSelection: "test fixture",
    outputFormat: "tab-delimited",
  },
  lineCount: 2,
  checksum: { algorithm: "sha256", value: "a".repeat(64) },
};

describe("spectral library manifest", () => {
  it("accepts a complete versioned manifest", () => {
    expect(() => validateSpectralLibraryManifest(manifest)).not.toThrow();
  });

  it("rejects invalid retrieval dates and checksums", () => {
    expect(() => validateSpectralLibraryManifest({ ...manifest, retrievedAt: "30.08.2026" })).toThrow("YYYY-MM-DD");
    expect(() => validateSpectralLibraryManifest({
      ...manifest,
      checksum: { algorithm: "sha256", value: "not-a-checksum" },
    })).toThrow("Контрольная сумма");
  });
});
