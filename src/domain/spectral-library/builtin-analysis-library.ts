import generatedArtifact from "./generated/nist-asd-5.12-2026-08-30-analysis.json";
import { NIST_ASD_SHORT_LABEL } from "./selection";
import { hydrateSpectralLibrary, type SerializedSpectralLibraryArtifact } from "./serialization";
import { validateSpectralLibraryManifest } from "./validation";
import { createSpectralLibraryWavelengthIndex } from "./wavelength-index";

const library = hydrateSpectralLibrary(generatedArtifact as unknown as SerializedSpectralLibraryArtifact);
validateSpectralLibraryManifest(library.manifest);
if (library.lines.length !== library.manifest.lineCount) {
  throw new Error("Число линий не совпадает с манифестом спектральной библиотеки.");
}

/** Calculation projection without transition and bibliography fields unused by identification. */
export const BUILTIN_ANALYSIS_LIBRARY_VERSION = library.manifest.version;
export const BUILTIN_ANALYSIS_LIBRARY_LABEL = NIST_ASD_SHORT_LABEL;
export const builtinAnalysisSpectralLibraryIndex = createSpectralLibraryWavelengthIndex(library.lines);
