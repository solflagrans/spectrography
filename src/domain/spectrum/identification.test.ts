import { describe, expect, it } from "vitest";

import type { SpectralLine } from "@/domain/spectral-library/types";

import { buildElementHypotheses, assignElementCandidates } from "./identification";
import { selectCharacteristicLines } from "./characteristic-lines";
import type { AnalyzedPeak, ChannelPreparationResult, SpectralLineCandidate } from "./types";
import { DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS } from "./interactive-analysis";

describe("deterministic element matching", () => {
  it("selects observed, numeric and unambiguous characteristic lines within coverage", () => {
    const accepted = line("accepted", "A", 1, 500, 10);
    const blended = { ...line("blended", "A", 1, 501, 100), relativeIntensity: { rawValue: "100bl", numericValue: 100, notations: ["bl"] } };
    const ritzOnly = { ...line("ritz", "A", 1, 502, 90), observedWavelength: undefined, preferredWavelength: { valueNm: 502, medium: "vacuum" as const, origin: "ritz" as const } };
    const result = selectCharacteristicLines([blended, ritzOnly, accepted, line("outside", "A", 1, 900, 1_000)], [{ minimum: 490, maximum: 510 }]);
    expect(result).toHaveLength(1);
    expect(result[0].lines.map((item) => item.lineId)).toEqual(["accepted"]);
  });

  it("maximizes cardinality before minimizing normalized wavelength deviation", () => {
    const peaks = [
      peak("p1", "c1", 0, 500, [candidate("l1", "Fe", 26, 499.8), candidate("l2", "Fe", 26, 499.9)]),
      peak("p2", "c1", 1, 500.1, [candidate("l2", "Fe", 26, 499.9)]),
    ];
    const assigned = assignElementCandidates(peaks, "Fe");
    expect(assigned.map((item) => [item.peak.id, item.candidate.lineId])).toEqual([["p1", "l1"], ["p2", "l2"]]);
  });

  it("combines complementary channels and keeps overlapping observations without double-counting a line", () => {
    const library = [
      line("fe-1", "Fe", 26, 500, 100),
      line("fe-2", "Fe", 26, 510, 90),
      line("fe-3", "Fe", 26, 520, 80),
      line("fe-4", "Fe", 26, 530, 70),
      line("fe-outside", "Fe", 26, 900, 1_000),
      line("x-1", "X", 99, 500.02, 100),
    ];
    const first = channel("c1", 495, 535, [
      peak("c1-p1", "c1", 0, 500.05, [candidateFromLine(library[0], 500.05), candidateFromLine(library[5], 500.05)]),
      peak("c1-p2", "c1", 1, 510.05, [candidateFromLine(library[1], 510.05)]),
    ]);
    const second = channel("c2", 498, 525, [
      peak("c2-p1", "c2", 0, 499.98, [candidateFromLine(library[0], 499.98)]),
      peak("c2-p3", "c2", 1, 520.04, [candidateFromLine(library[2], 520.04)]),
    ]);
    const result = buildElementHypotheses([first, second], library);
    const iron = result.hypotheses.find((item) => item.symbol === "Fe");

    expect(iron).toBeDefined();
    expect(iron?.independentMatchedLineCount).toBe(3);
    expect(iron?.foundCharacteristicLineCount).toBe(3);
    expect(iron?.availableCharacteristicLineCount).toBe(4);
    expect(iron?.missingCharacteristicLines.map((item) => item.lineId)).toEqual(["fe-4"]);
    expect(iron?.evidence.find((item) => item.lineId === "fe-1")?.observations).toHaveLength(2);
    expect(iron?.observationsByChannel.map((item) => item.channelId)).toEqual(["c1", "c2"]);
    expect(iron?.alternativeExplanations).toContainEqual({ peakId: "c1-p1", channelId: "c1", elementSymbols: ["X"] });
    expect(result.rejectedHypotheses.find((item) => item.hypothesis.symbol === "X")?.reasons).toContain("single-match");
  });

  it("rejects agreements that do not exceed the deterministic accidental-agreement reference", () => {
    const library = Array.from({ length: 10 }, (_, index) => line(`y-${index}`, "Y", 98, 500 + index * 0.1, 100 - index));
    const peaks = [
      peak("p1", "c", 0, 500.01, [candidateFromLine(library[0], 500.01)]),
      peak("p2", "c", 1, 500.11, [candidateFromLine(library[1], 500.11)]),
      peak("p3", "c", 2, 510, []),
      peak("p4", "c", 3, 519, []),
    ];
    const result = buildElementHypotheses([channel("c", 500, 520, peaks)], library);
    expect(result.hypotheses).toHaveLength(0);
    expect(result.rejectedHypotheses[0].reasons).toContain("random-like-agreement");
  });

  it("treats an unresolved multiplet as one observation and does not mark its neighboring members missing", () => {
    const library = [
      line("o-777-a", "O", 8, 777.194, 1_000),
      line("o-777-b", "O", 8, 777.417, 900),
      line("o-777-c", "O", 8, 777.539, 800),
      line("o-845", "O", 8, 844.625, 700),
      line("o-927", "O", 8, 926.601, 600),
    ];
    const observed = 777.32;
    const result = buildElementHypotheses([channel("c", 770, 930, [
      peak("p", "c", 0, observed, library.slice(0, 3).map((item) => candidateFromLine(item, observed))),
    ], 1.1)], library);
    const oxygen = result.rejectedHypotheses.find((item) => item.hypothesis.symbol === "O")!.hypothesis;

    expect(oxygen.independentMatchedGroupCount).toBe(1);
    expect(oxygen.foundCharacteristicGroupCount).toBe(1);
    expect(oxygen.evidence[0].memberLineIds).toEqual(["o-777-a", "o-777-b", "o-777-c"]);
    expect(oxygen.missingCharacteristicLines.map((item) => item.lineId)).toEqual(["o-845", "o-927"]);
  });

  it("raises the accidental-agreement threshold when many elements were searched", () => {
    const symbols = Array.from({ length: 20 }, (_, index) => `X${index + 1}`);
    const library = symbols.flatMap((symbol, symbolIndex) => Array.from({ length: 10 }, (_, lineIndex) => (
      line(`${symbol}-${lineIndex}`, symbol, symbolIndex + 1, 502 + lineIndex * 9, 100 - lineIndex)
    )));
    const matchedPeaks = Array.from({ length: 4 }, (_, peakIndex) => {
      const observed = 502 + peakIndex * 9 + 0.01;
      return {
        ...peak(`p${peakIndex}`, "c", peakIndex, observed, symbols.map((symbol) => (
          candidateFromLine(library.find((item) => item.id === `${symbol}-${peakIndex}`)!, observed)
        ))),
        snr: 5.2,
        prominence: 0.04,
      };
    });
    const noisePeaks = Array.from({ length: 36 }, (_, index) => peak(`noise-${index}`, "c", index + 4, 540 + index, []));
    const result = buildElementHypotheses([channel("c", 500, 600, [...matchedPeaks, ...noisePeaks], 0.2)], library);
    const candidate = result.hypotheses.find((item) => item.symbol === "X1")
      ?? result.rejectedHypotheses.find((item) => item.hypothesis.symbol === "X1")!.hypothesis;

    expect(candidate.randomAgreement.testedElementCount).toBe(20);
    expect(candidate.randomAgreement.requiredAgreements).toBeGreaterThan(4);
    expect(candidate.randomAgreement.observedAgreements).toBe(4);
    expect(candidate.randomAgreement.distinguishableFromRandom).toBe(false);
    expect(result.rejectedHypotheses.find((item) => item.hypothesis.symbol === "X1")?.reasons)
      .toContain("ambiguous-evidence");
  });

  it("is deterministic regardless of input peak order", () => {
    const library = [line("a", "A", 1, 500, 100), line("b", "A", 1, 501, 90), line("c", "A", 1, 502, 80)];
    const peaks = library.map((item, index) => peak(`p${index}`, "c", index, item.preferredWavelength.valueNm + 0.01, [candidateFromLine(item, item.preferredWavelength.valueNm + 0.01)]));
    const first = buildElementHypotheses([channel("c", 499, 503, peaks)], library);
    const second = buildElementHypotheses([channel("c", 499, 503, [...peaks].reverse())], library);
    expect(second).toEqual(first);
  });
});

function line(id: string, symbol: string, atomicNumber: number, wavelength: number, intensity?: number): SpectralLine {
  return {
    id,
    element: { atomicNumber, symbol, name: `Элемент ${symbol}` },
    ionizationStage: 1,
    ionizationLabel: "I",
    observedWavelength: { valueNm: wavelength, medium: "air", rawValue: String(wavelength) },
    preferredWavelength: { valueNm: wavelength, medium: "air", origin: "observed" },
    ...(intensity === undefined ? {} : { relativeIntensity: { rawValue: String(intensity), numericValue: intensity, notations: [] } }),
    source: { name: "NIST ASD", datasetVersion: "5.12", retrievedAt: "2026-08-30" },
  };
}

function candidateFromLine(item: SpectralLine, observed: number): SpectralLineCandidate {
  return candidate(item.id, item.element.symbol, item.element.atomicNumber, item.preferredWavelength.valueNm, observed, item.element.name);
}

function candidate(id: string, symbol: string, atomicNumber: number, wavelength: number, observed = 500, name = `Элемент ${symbol}`): SpectralLineCandidate {
  const delta = observed - wavelength;
  const adaptiveToleranceNm = 0.3;
  return {
    lineId: id,
    atomicNumber,
    elementSymbol: symbol,
    elementName: name,
    ionizationStage: 1,
    ionizationLabel: "I",
    line: wavelength,
    wavelengthType: "observed",
    wavelengthMedium: "air",
    delta,
    adaptiveToleranceNm,
    combinedUncertaintyNm: 0.12,
    normalizedDelta: Math.abs(delta) / adaptiveToleranceNm,
    toleranceCapped: false,
    uncertainty: { gridSamplingNm: 0.03, spectralResolutionNm: 0.03, peakWidthNm: 0.01, peakPositionNm: 0.03, referenceLineNm: 0, calibrationNm: 0.1 },
  };
}

function peak(id: string, channelId: string, sourceIndex: number, wavelength: number, candidates: readonly SpectralLineCandidate[]): AnalyzedPeak {
  return {
    id,
    channelId,
    sourceIndex,
    index: sourceIndex,
    sampledWavelength: wavelength,
    refinedWavelength: wavelength,
    wavelength,
    refinementOffsetNm: 0,
    localGridStepNm: 0.1,
    positionUncertaintyNm: 0.03,
    positionMethod: "quadratic-local-profile",
    positionRefined: true,
    rawIntensity: 100,
    intensity: 1,
    prominence: 0.8,
    snr: 20,
    widthNm: 0.2,
    candidates,
    match: candidates[0] ?? null,
  };
}

function channel(id: string, minimum: number, maximum: number, peaks: readonly AnalyzedPeak[], spectralResolutionNm = 0.2): ChannelPreparationResult {
  const wavelengths = [minimum, (minimum + maximum) / 2, maximum];
  const dataset = { wavelengths, intensities: [0, 1, 0] };
  return {
    id,
    name: id,
    rawDataset: dataset,
    uncalibratedPreparedDataset: dataset,
    preparedDataset: dataset,
    baselineDataset: { wavelengths, intensities: [0, 0, 0] },
    noiseDataset: { wavelengths, intensities: [0.01, 0.01, 0.01] },
    thresholdDataset: { wavelengths, intensities: [0.05, 0.05, 0.05] },
    preparedStats: { mean: 1 / 3, standardDeviation: 0.47, minimum: 0, maximum: 1 },
    parameters: DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS,
    peaks,
    wavelengthRange: { minimum, maximum },
    spectralResolutionNm,
    wavelengthCalibration: {
      status: "not-applied",
      enabled: true,
      shiftNm: 0,
      uncertaintyNm: 0.1,
      uncertaintyMethod: "resolution-and-grid-floor",
      method: "split-sample-robust-common-shift",
      anchors: [],
      fitAnchorIds: [],
      validationAnchorIds: [],
      reason: "insufficient-anchors",
    },
    suitability: {
      status: "sufficient",
      summary: "Данных достаточно.",
      issues: [],
      metrics: {
        pointCount: 3,
        wavelengthSpanNm: maximum - minimum,
        gridStepNm: (maximum - minimum) / 2,
        resolutionElements: (maximum - minimum) / spectralResolutionNm,
        noiseMedian: 0.01,
        usefulDynamicRangeSnr: 100,
        baselineDriftRatio: 0,
        isolatedOutlierCount: 0,
        isolatedOutlierFraction: 0,
        repeatedExtremeCount: 0,
        longestExtremeRun: 0,
        detectedFeatureCount: peaks.length,
        strongFeatureCount: peaks.length,
        resolutionPeakCount: peaks.length,
        resolutionRelativeMad: 0,
      },
    },
    usable: true,
    transformations: [],
  };
}
