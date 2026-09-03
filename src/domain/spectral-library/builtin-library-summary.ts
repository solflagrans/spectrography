import { NIST_ASD_SHORT_LABEL } from "./selection";
import type { SpectralLibraryManifest, SpectralLineElement } from "./types";
import generatedSummary from "./generated/nist-asd-5.12-2026-08-30-summary.json";

/** Small client-safe projection; the full line library is loaded only by the analysis worker. */
export const BUILTIN_LIBRARY_LABEL = NIST_ASD_SHORT_LABEL;
export const builtinSpectralLibraryManifest = generatedSummary.manifest as SpectralLibraryManifest;
export const builtinSpectralLibraryElements = generatedSummary.elements as readonly SpectralLineElement[];
