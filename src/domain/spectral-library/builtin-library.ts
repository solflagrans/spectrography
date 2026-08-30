import generatedArtifact from "./generated/nist-asd-5.12-2026-08-30.json";
import { NIST_ASD_SHORT_LABEL } from "./selection";
import { hydrateSpectralLibrary, type SerializedSpectralLibraryArtifact } from "./serialization";
import { validateSpectralLibraryManifest } from "./validation";
import { createSpectralLibraryWavelengthIndex } from "./wavelength-index";

const library = hydrateSpectralLibrary(generatedArtifact as unknown as SerializedSpectralLibraryArtifact);
validateSpectralLibraryManifest(library.manifest);
if (library.lines.length !== library.manifest.lineCount) {
  throw new Error("Число линий не совпадает с манифестом спектральной библиотеки.");
}

export const BUILTIN_LIBRARY_VERSION = library.manifest.version;
export const BUILTIN_LIBRARY_LABEL = NIST_ASD_SHORT_LABEL;
export const builtinSpectralLibraryManifest = library.manifest;
export const builtinSpectralLibrary = library.lines;
export const builtinSpectralLibraryIndex = createSpectralLibraryWavelengthIndex(library.lines);
