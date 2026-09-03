import { describe, expect, it } from "vitest";

import { builtinMolecularSystems } from "@/domain/molecular-spectrum";
import { builtinMolecularSystemSummaries } from "@/domain/molecular-spectrum/builtin-library-summary";

import {
  builtinSpectralLibrary,
  builtinSpectralLibraryManifest as fullManifest,
} from "./builtin-library";
import { builtinAnalysisSpectralLibraryIndex } from "./builtin-analysis-library";
import {
  builtinSpectralLibraryElements,
  builtinSpectralLibraryManifest as summaryManifest,
} from "./builtin-library-summary";

describe("client-safe library summaries", () => {
  it("stays synchronized with the generated atomic library", () => {
    expect(summaryManifest).toEqual(fullManifest);
    const fullElements = [...new Map(
      builtinSpectralLibrary.map((line) => [line.element.symbol, line.element]),
    ).values()].sort((left, right) => left.atomicNumber - right.atomicNumber);
    expect(builtinSpectralLibraryElements).toEqual(fullElements);
  });

  it("keeps every calculation field in the compact analysis projection", () => {
    const analysisLines = builtinAnalysisSpectralLibraryIndex.lines;
    expect(analysisLines).toHaveLength(builtinSpectralLibrary.length);
    for (const index of [0, Math.floor(analysisLines.length / 2), analysisLines.length - 1]) {
      const compact = analysisLines[index];
      const full = builtinSpectralLibrary[index];
      expect(compact).toMatchObject({
        id: full.id,
        element: full.element,
        ionizationStage: full.ionizationStage,
        ionizationLabel: full.ionizationLabel,
        observedWavelength: full.observedWavelength,
        ritzWavelength: full.ritzWavelength,
        preferredWavelength: full.preferredWavelength,
        relativeIntensity: full.relativeIntensity,
        source: full.source,
      });
      expect(compact.transition).toBeUndefined();
      expect(compact.bibliography).toBeUndefined();
    }
  });

  it("stays synchronized with the generated molecular library", () => {
    expect(builtinMolecularSystemSummaries).toEqual(builtinMolecularSystems.map((system) => ({
      id: system.id,
      formula: system.formula,
      displayName: system.displayName,
      transition: system.transition,
      wavelengthRange: system.wavelengthRange,
      characteristicRegionCount: system.characteristicRegions.length,
    })));
  });
});
