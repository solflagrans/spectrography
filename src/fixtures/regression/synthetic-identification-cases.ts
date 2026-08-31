import { builtinMolecularSystems, renderMolecularReferenceProfile, shiftProfile } from "@/domain/molecular-spectrum";
import type { SpectralLine } from "@/domain/spectral-library/types";
import {
  DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
  runInteractiveSpectrumAnalysis,
} from "@/domain/spectrum";
import type { InteractiveSpectrumAnalysis, SpectrumDataset } from "@/domain/spectrum";

export interface SyntheticCaseDefinition {
  readonly id: string;
  readonly description: string;
  readonly dataset: SpectrumDataset;
  readonly expectedAtomicSymbols: readonly string[];
  readonly expectedMolecularFormulae: readonly string[];
  readonly expectedRefusal: boolean;
  readonly perturbation: {
    readonly noiseAmplitude: number;
    readonly baselineSlope: number;
    readonly resolutionNm: number;
    readonly wavelengthShiftNm: number;
    readonly atomicLineCount: number;
    readonly molecularBands: boolean;
  };
}

export interface SyntheticCaseResult {
  readonly definition: SyntheticCaseDefinition;
  readonly analysis: InteractiveSpectrumAnalysis;
}

const syntheticAtomicLines = [305, 405, 415, 440, 455, 495];

export const syntheticLibrary: readonly SpectralLine[] = syntheticAtomicLines.map((wavelength, index) => ({
  id: `synthetic-line-${index + 1}`,
  element: { atomicNumber: 999, symbol: "Sx", name: "Синтетический компонент" },
  ionizationStage: 1,
  ionizationLabel: "I",
  observedWavelength: { valueNm: wavelength, medium: "air", rawValue: String(wavelength), uncertaintyNm: 0.01 },
  preferredWavelength: { valueNm: wavelength, medium: "air", origin: "observed", uncertaintyNm: 0.01 },
  relativeIntensity: { rawValue: String(100 - index * 8), numericValue: 100 - index * 8, notations: [] },
  source: { name: "Synthetic verification fixture", datasetVersion: "synthetic-test-only", retrievedAt: "2026-08-31" },
}));

export const syntheticCaseDefinitions: readonly SyntheticCaseDefinition[] = [
  createCase({ id: "clean-mixture", description: "Чистая смесь атомных линий и полос N₂", noiseAmplitude: 0.003, baselineSlope: 0.0002, resolutionNm: 0.6, wavelengthShiftNm: 0, atomicLineCount: 6, molecularBands: true, expectedAtomicSymbols: ["Sx"], expectedMolecularFormulae: ["N₂"] }),
  createCase({ id: "noisy-mixture", description: "Та же смесь при повышенном шуме", noiseAmplitude: 0.018, baselineSlope: 0.0002, resolutionNm: 0.6, wavelengthShiftNm: 0, atomicLineCount: 6, molecularBands: true, expectedAtomicSymbols: ["Sx"], expectedMolecularFormulae: ["N₂"] }),
  createCase({ id: "shifted-scale", description: "Общее контролируемое смещение шкалы", noiseAmplitude: 0.003, baselineSlope: 0.0002, resolutionNm: 0.6, wavelengthShiftNm: 0.24, atomicLineCount: 6, molecularBands: true, expectedAtomicSymbols: ["Sx"], expectedMolecularFormulae: ["N₂"] }),
  createCase({ id: "broader-resolution", description: "Ухудшенное спектральное разрешение", noiseAmplitude: 0.004, baselineSlope: 0.0002, resolutionNm: 1.2, wavelengthShiftNm: 0, atomicLineCount: 6, molecularBands: true, expectedAtomicSymbols: ["Sx"], expectedMolecularFormulae: ["N₂"] }),
  createCase({ id: "missing-features", description: "Пропущены пять из шести характерных атомных признаков", noiseAmplitude: 0.003, baselineSlope: 0.0002, resolutionNm: 0.6, wavelengthShiftNm: 0, atomicLineCount: 1, molecularBands: false, expectedAtomicSymbols: [], expectedMolecularFormulae: [], expectedRefusal: true }),
  createRandomCase(),
];

export function runSyntheticIdentificationCases(): readonly SyntheticCaseResult[] {
  const parameters = {
    ...DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
    processing: { ...DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing, smoothingWindow: 5 },
    peakSearch: {
      ...DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.peakSearch,
      minimumSnr: 4,
      prominence: 0.02,
      minimumWidth: 0.1,
      maximumWidth: 4,
      minimumDistance: 2,
    },
  };
  return syntheticCaseDefinitions.map((definition) => ({
    definition,
    analysis: runInteractiveSpectrumAnalysis(definition.dataset, syntheticLibrary, parameters, "plasma-emission"),
  }));
}

interface CreateCaseInput {
  readonly id: string;
  readonly description: string;
  readonly noiseAmplitude: number;
  readonly baselineSlope: number;
  readonly resolutionNm: number;
  readonly wavelengthShiftNm: number;
  readonly atomicLineCount: number;
  readonly molecularBands: boolean;
  readonly expectedAtomicSymbols: readonly string[];
  readonly expectedMolecularFormulae: readonly string[];
  readonly expectedRefusal?: boolean;
}

function createCase(input: CreateCaseInput): SyntheticCaseDefinition {
  const wavelengths = grid(300, 500, 0.1);
  const random = deterministicNoise(input.id);
  const molecularSystem = builtinMolecularSystems.find((system) => system.formula === "N₂")!;
  const molecule = input.molecularBands
    ? molecularSystem.characteristicRegions.reduce((sum, region) => {
        const base = renderMolecularReferenceProfile(region, wavelengths, input.resolutionNm, 1_000);
        const shifted = shiftProfile(wavelengths, base, input.wavelengthShiftNm);
        return sum.map((value, index) => value + shifted[index] * 0.55);
      }, new Array<number>(wavelengths.length).fill(0))
    : new Array<number>(wavelengths.length).fill(0);
  const atomicCenters = syntheticAtomicLines.slice(0, input.atomicLineCount).map((value) => value + input.wavelengthShiftNm);
  const intensities = wavelengths.map((wavelength, index) => {
    const atomic = atomicCenters.reduce((sum, center, lineIndex) => sum + (1 - lineIndex * 0.07) * gaussian(wavelength, center, input.resolutionNm), 0);
    const baseline = 0.08 + input.baselineSlope * (wavelength - wavelengths[0]);
    return baseline + atomic + molecule[index] + input.noiseAmplitude * random();
  });
  return {
    id: input.id,
    description: input.description,
    dataset: { wavelengths, intensities },
    expectedAtomicSymbols: input.expectedAtomicSymbols,
    expectedMolecularFormulae: input.expectedMolecularFormulae,
    expectedRefusal: input.expectedRefusal ?? false,
    perturbation: {
      noiseAmplitude: input.noiseAmplitude,
      baselineSlope: input.baselineSlope,
      resolutionNm: input.resolutionNm,
      wavelengthShiftNm: input.wavelengthShiftNm,
      atomicLineCount: input.atomicLineCount,
      molecularBands: input.molecularBands,
    },
  };
}

function createRandomCase(): SyntheticCaseDefinition {
  const wavelengths = grid(300, 500, 0.1);
  const random = deterministicNoise("random-coincidences");
  const randomCenters = Array.from({ length: 24 }, () => 302 + random() * 196);
  const intensities = wavelengths.map((wavelength) => (
    0.08 + 0.008 * random() + randomCenters.reduce((sum, center) => sum + 0.2 * gaussian(wavelength, center, 0.7), 0)
  ));
  return {
    id: "random-coincidences",
    description: "Случайно размещённые пики без заданного состава",
    dataset: { wavelengths, intensities },
    expectedAtomicSymbols: [],
    expectedMolecularFormulae: [],
    expectedRefusal: true,
    perturbation: { noiseAmplitude: 0.008, baselineSlope: 0, resolutionNm: 0.7, wavelengthShiftNm: 0, atomicLineCount: 0, molecularBands: false },
  };
}

function deterministicNoise(seedText: string): () => number {
  let state = [...seedText].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0x9e3779b9);
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff - 0.5;
  };
}

function grid(minimum: number, maximum: number, step: number): readonly number[] {
  return Array.from({ length: Math.round((maximum - minimum) / step) + 1 }, (_, index) => minimum + index * step);
}

function gaussian(x: number, center: number, fwhm: number): number {
  return Math.exp(-4 * Math.log(2) * Math.pow((x - center) / fwhm, 2));
}
