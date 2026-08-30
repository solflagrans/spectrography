import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import generatedArtifact from "../src/domain/spectral-library/generated/nist-asd-5.12-2026-08-30.json";
import type { SerializedSpectralLibraryArtifact } from "../src/domain/spectral-library/serialization";
import { validateSpectralLibraryManifest } from "../src/domain/spectral-library/validation";

import {
  buildNistAsdLibraryArtifact,
  calculateRecordsChecksum,
  serializeLibraryArtifact,
} from "./build-spectral-library";

const fixture = readFileSync(
  fileURLToPath(new URL("../src/fixtures/nist-asd-lines-sample.tsv", import.meta.url)),
  "utf8",
);

describe("spectral library generator", () => {
  it("is deterministic for the same official export", () => {
    const first = buildNistAsdLibraryArtifact(fixture);
    const second = buildNistAsdLibraryArtifact(fixture);

    expect(serializeLibraryArtifact(first)).toBe(serializeLibraryArtifact(second));
    expect(first.manifest.lineCount).toBe(2);
    expect(first.manifest.checksum.value).toBe(calculateRecordsChecksum(first.records));
  });

  it("ships a manifest matching the generated records and checksum", () => {
    const artifact = generatedArtifact as unknown as SerializedSpectralLibraryArtifact;

    expect(() => validateSpectralLibraryManifest(artifact.manifest)).not.toThrow();
    expect(artifact.records).toHaveLength(artifact.manifest.lineCount);
    expect(calculateRecordsChecksum(artifact.records)).toBe(artifact.manifest.checksum.value);
    expect(new Set(artifact.records.map((record) => record.id)).size).toBe(artifact.records.length);
  });
});
