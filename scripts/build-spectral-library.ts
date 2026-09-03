import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { normalizeNistAsdLines } from "../src/application/spectral-library/normalize-nist-asd";
import { parseNistAsdExport } from "../src/application/spectral-library/parse-nist-asd-export";
import {
  NIST_ASD_ATTRIBUTION,
  NIST_ASD_DOI,
  NIST_ASD_SELECTED_ELEMENTS,
  NIST_ASD_VERSION,
} from "../src/domain/spectral-library/selection";
import {
  serializeSpectralLines,
  type SerializedSpectralLibraryArtifact,
} from "../src/domain/spectral-library/serialization";
import type { SpectralLibraryManifest } from "../src/domain/spectral-library/types";
import { validateSpectralLibraryManifest } from "../src/domain/spectral-library/validation";

const RETRIEVED_AT = "2026-08-30";
const LIBRARY_VERSION = `nist-asd-${NIST_ASD_VERSION}-${RETRIEVED_AT}`;
const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_EXPORT = path.join(REPOSITORY_ROOT, "data/nist-asd/raw/nist-asd-5.12-2026-08-30.tsv");
const GENERATED_LIBRARY = path.join(REPOSITORY_ROOT, "src/domain/spectral-library/generated/nist-asd-5.12-2026-08-30.json");
const GENERATED_ANALYSIS_LIBRARY = path.join(REPOSITORY_ROOT, "src/domain/spectral-library/generated/nist-asd-5.12-2026-08-30-analysis.json");
const GENERATED_SUMMARY = path.join(REPOSITORY_ROOT, "src/domain/spectral-library/generated/nist-asd-5.12-2026-08-30-summary.json");

export function buildNistAsdLibraryArtifact(rawExport: string): SerializedSpectralLibraryArtifact {
  const rows = parseNistAsdExport(rawExport);
  const lines = normalizeNistAsdLines(rows, {
    datasetVersion: NIST_ASD_VERSION,
    retrievedAt: RETRIEVED_AT,
    elements: NIST_ASD_SELECTED_ELEMENTS,
  });
  const records = serializeSpectralLines(lines);
  const manifest: SpectralLibraryManifest = {
    schemaVersion: 1,
    name: "NIST ASD spectral lines · selected elements I–II · 200–1000 nm",
    version: LIBRARY_VERSION,
    source: "NIST Atomic Spectra Database",
    nistAsdVersion: NIST_ASD_VERSION,
    doi: NIST_ASD_DOI,
    retrievedAt: RETRIEVED_AT,
    attribution: NIST_ASD_ATTRIBUTION,
    query: {
      elements: NIST_ASD_SELECTED_ELEMENTS.map((element) => element.symbol),
      ionizationStages: [1, 2],
      wavelengthRangeNm: { minimum: 200, maximum: 1000 },
      wavelengthMediumPolicy: "NIST default: air from 200 to 1000 nm for this query; medium is retained per exported wavelength column",
      lineSelection: "Only lines with observed wavelengths or relative intensities (line_out=3)",
      outputFormat: "tab-delimited",
    },
    lineCount: records.length,
    checksum: { algorithm: "sha256", value: calculateRecordsChecksum(records) },
  };
  validateSpectralLibraryManifest(manifest);
  return { recordSchema: "nist-asd-line-v1", manifest, records };
}

export function calculateRecordsChecksum(records: SerializedSpectralLibraryArtifact["records"]): string {
  return createHash("sha256").update(JSON.stringify(records)).digest("hex");
}

export function serializeLibraryArtifact(artifact: SerializedSpectralLibraryArtifact): string {
  return `${JSON.stringify(artifact)}\n`;
}

async function main(): Promise<void> {
  const rawExport = await readFile(RAW_EXPORT, "utf8");
  const artifact = buildNistAsdLibraryArtifact(rawExport);
  const generated = serializeLibraryArtifact(artifact);
  const generatedAnalysisLibrary = serializeLibraryArtifact({
    ...artifact,
    records: artifact.records.map((record) => ({
      id: record.id,
      element: record.element,
      ionization: record.ionization,
      ...(record.observed ? { observed: record.observed } : {}),
      ...(record.ritz ? { ritz: record.ritz } : {}),
      preferred: record.preferred,
      ...(record.intensity ? { intensity: record.intensity } : {}),
    })),
  });
  const elements = [...NIST_ASD_SELECTED_ELEMENTS].sort((left, right) => left.atomicNumber - right.atomicNumber);
  const generatedSummary = `${JSON.stringify({ manifest: artifact.manifest, elements })}\n`;
  if (process.argv.includes("--check")) {
    const current = await readFile(GENERATED_LIBRARY, "utf8").catch(() => "");
    const currentAnalysisLibrary = await readFile(GENERATED_ANALYSIS_LIBRARY, "utf8").catch(() => "");
    const currentSummary = await readFile(GENERATED_SUMMARY, "utf8").catch(() => "");
    if (current !== generated || currentAnalysisLibrary !== generatedAnalysisLibrary || currentSummary !== generatedSummary) {
      throw new Error("Сгенерированная спектральная библиотека устарела. Запустите pnpm library:build.");
    }
    return;
  }
  await Promise.all([
    writeFile(GENERATED_LIBRARY, generated, "utf8"),
    writeFile(GENERATED_ANALYSIS_LIBRARY, generatedAnalysisLibrary, "utf8"),
    writeFile(GENERATED_SUMMARY, generatedSummary, "utf8"),
  ]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
