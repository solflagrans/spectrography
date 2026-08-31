import { describe, expect, it } from "vitest";

import { DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS } from "@/domain/spectrum";
import type { ChannelPreparationResult, SpectrumDataset } from "@/domain/spectrum";

import { identifyMolecularSystems } from "./identification";
import { builtinMolecularSystems } from "./library";
import { renderMolecularReferenceProfile, shiftProfile } from "./profile";
import type { MolecularCharacteristicRegion, MolecularSystemDefinition } from "./types";

describe("molecular emission identification", () => {
  it("keeps molecule, charge, system and verifiable source metadata", () => {
    const neutral = builtinMolecularSystems.find((item) => item.formula === "N₂")!;
    const ion = builtinMolecularSystems.find((item) => item.formula === "N₂⁺")!;

    expect(neutral.charge).toBe(0);
    expect(neutral.transition).toContain("C³Π");
    expect(ion.charge).toBe(1);
    expect(ion.transition).toContain("B²Σ");
    expect(ion.source.license).toBe("MIT");
    expect(ion.source.filteredSourceSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(neutral.characteristicRegions.every((region) => region.transitions.length > 0)).toBe(true);
  });

  it("broadens the source profile to the measured resolution and grid", () => {
    const wavelengths = grid(9, 11, 0.02);
    const region = syntheticRegion("a", 9.5, 10.5, [9.98, 10.02]);
    const narrow = renderMolecularReferenceProfile(region, wavelengths, 0.06, 1_000);
    const broad = renderMolecularReferenceProfile(region, wavelengths, 0.4, 1_000);

    expect(narrow).toHaveLength(wavelengths.length);
    expect(broad.filter((value) => value >= 0.5).length).toBeGreaterThan(narrow.filter((value) => value >= 0.5).length);
  });

  it("recovers a small common wavelength shift from several band regions", () => {
    const system = syntheticSystem();
    const wavelengths = grid(5, 35, 0.05);
    const intensities = synthesize(system, wavelengths, 0.16, ["a", "b", "c"]);
    const result = identifyMolecularSystems({ channels: [channel(wavelengths, intensities)], systems: [system] });

    expect(result.hypotheses).toHaveLength(1);
    expect(result.hypotheses[0].supportedRegionIds.length).toBeGreaterThanOrEqual(2);
    expect(result.hypotheses[0].commonShiftNm).toBeCloseTo(0.16, 1);
  });

  it("treats one matching band as weak evidence", () => {
    const system = syntheticSystem();
    const wavelengths = grid(5, 35, 0.05);
    const intensities = synthesize(system, wavelengths, 0.12, ["a"]);
    const result = identifyMolecularSystems({ channels: [channel(wavelengths, intensities)], systems: [system] });

    expect(result.hypotheses).toHaveLength(0);
    expect(result.rejectedHypotheses[0].reasons).toContain("single-region");
  });

  it("rejects a profile that agrees only after a large accidental offset", () => {
    const system = syntheticSystem();
    const wavelengths = grid(-15, 55, 0.05);
    const intensities = synthesize(system, wavelengths, 8, ["a", "b", "c"]);
    const result = identifyMolecularSystems({ channels: [channel(wavelengths, intensities)], systems: [system] });

    expect(result.hypotheses).toHaveLength(0);
    expect(result.rejectedHypotheses[0].reasons).toContain("random-like-profile");
  });
});

function syntheticSystem(): MolecularSystemDefinition {
  const regions = [
    syntheticRegion("a", 9, 11, [9.55, 9.9, 10.25]),
    syntheticRegion("b", 19, 21, [19.45, 19.85, 20.3]),
    syntheticRegion("c", 29, 31, [29.5, 29.95, 30.35]),
  ];
  return {
    id: "synthetic-system",
    molecule: "N2",
    formula: "N₂",
    charge: 0,
    displayName: "Тестовая молекула",
    systemName: "Тестовая система",
    transition: "A → X",
    wavelengthRange: { minimum: 9, maximum: 31 },
    characteristicRegions: regions,
    source: {
      name: "Test source",
      datasetVersion: "1",
      retrievedAt: "2026-08-31",
      repository: "https://example.test",
      license: "CC0",
      licenseUrl: "https://example.test/license",
      attribution: "Test",
      citations: ["Test"],
      filteredSourceSha256: "0".repeat(64),
    },
    preparation: {
      wavelengthMedium: "air",
      maximumRotationalQuantumNumber: 10,
      rotationalTemperatureGridKelvin: [1_000],
      profile: "test",
      note: "test",
    },
  };
}

function syntheticRegion(id: string, minimum: number, maximum: number, lines: readonly number[]): MolecularCharacteristicRegion {
  return {
    id,
    label: id,
    minimumWavelengthNm: minimum,
    maximumWavelengthNm: maximum,
    key: id !== "c",
    transitions: lines.map((wavelengthNm, index) => ({
      sourceLineId: index + 1,
      wavelengthNm,
      einsteinAPerSecond: 1_000_000 / (index + 1),
      upperVibrationalEnergyCm: 0,
      upperRotationalEnergyCm: index * 20,
      upperJ: index + 1,
      upperV: 0,
      lowerV: 0,
      branch: "R",
    })),
  };
}

function synthesize(
  system: MolecularSystemDefinition,
  wavelengths: readonly number[],
  shiftNm: number,
  includedRegionIds: readonly string[],
): readonly number[] {
  const result = new Array<number>(wavelengths.length).fill(0.002);
  for (const region of system.characteristicRegions.filter((item) => includedRegionIds.includes(item.id))) {
    const profile = shiftProfile(wavelengths, renderMolecularReferenceProfile(region, wavelengths, 0.2, 1_000), shiftNm);
    profile.forEach((value, index) => { result[index] += value; });
  }
  return result;
}

function channel(wavelengths: readonly number[], intensities: readonly number[]): ChannelPreparationResult {
  const dataset: SpectrumDataset = { wavelengths, intensities };
  const noise = { wavelengths, intensities: intensities.map(() => 0.01) };
  return {
    id: "channel",
    name: "Channel",
    rawDataset: dataset,
    uncalibratedPreparedDataset: dataset,
    preparedDataset: dataset,
    baselineDataset: { wavelengths, intensities: intensities.map(() => 0) },
    noiseDataset: noise,
    thresholdDataset: noise,
    preparedStats: { mean: 0, standardDeviation: 0, minimum: 0, maximum: 1 },
    parameters: DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
    peaks: [],
    wavelengthRange: { minimum: wavelengths[0], maximum: wavelengths.at(-1)! },
    spectralResolutionNm: 0.2,
    wavelengthCalibration: {
      status: "not-applied", enabled: true, shiftNm: 0, uncertaintyNm: 0.05,
      uncertaintyMethod: "resolution-and-grid-floor", method: "split-sample-robust-common-shift",
      anchors: [], fitAnchorIds: [], validationAnchorIds: [], reason: "insufficient-anchors",
    },
    suitability: {
      status: "sufficient", summary: "Данных достаточно.", issues: [],
      metrics: {
        pointCount: wavelengths.length, wavelengthSpanNm: wavelengths.at(-1)! - wavelengths[0], gridStepNm: 0.05,
        resolutionElements: 150, noiseMedian: 0.01, usefulDynamicRangeSnr: 100, baselineDriftRatio: 0,
        isolatedOutlierCount: 0, isolatedOutlierFraction: 0, repeatedExtremeCount: 0, longestExtremeRun: 0,
        detectedFeatureCount: 3, strongFeatureCount: 3, resolutionPeakCount: 3, resolutionRelativeMad: 0,
      },
    },
    usable: true,
    transformations: [],
  };
}

function grid(minimum: number, maximum: number, step: number): readonly number[] {
  return Array.from({ length: Math.round((maximum - minimum) / step) + 1 }, (_, index) => minimum + index * step);
}
