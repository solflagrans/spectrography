import { describe, expect, it } from "vitest";

import type { SpectralLineCandidate } from "@/domain/spectrum";

import {
  createPeakCandidateView,
  filterCandidateGroups,
  type CandidateAnalysisLike,
} from "./peak-candidates-ui";

const emptyUncertainty = {
  gridSamplingNm: 0.01,
  spectralResolutionNm: 0.02,
  peakWidthNm: 0.03,
  peakPositionNm: 0.01,
  referenceLineNm: 0,
  calibrationNm: 0.01,
};

function candidate(
  lineId: string,
  elementSymbol: string,
  elementName: string,
  line: number,
  normalizedDelta: number,
  ionizationStage = 1,
  wavelengthType: SpectralLineCandidate["wavelengthType"] = "observed",
  wavelengthMedium: SpectralLineCandidate["wavelengthMedium"] = "air",
): SpectralLineCandidate {
  return {
    lineId,
    atomicNumber: elementSymbol.charCodeAt(0),
    elementSymbol,
    elementName,
    ionizationStage,
    ionizationLabel: ionizationStage === 1 ? "I" : "II",
    line,
    wavelengthType,
    wavelengthMedium,
    delta: 0.1,
    adaptiveToleranceNm: 0.2,
    combinedUncertaintyNm: 0.05,
    normalizedDelta,
    toleranceCapped: false,
    uncertainty: emptyUncertainty,
  };
}

function hypothesis(
  id: string,
  symbol: string,
  name: string,
  peakId: string,
  memberLineIds: readonly string[],
) {
  return {
    id,
    symbol,
    name,
    evidence: [{ groupId: `${id}-group`, memberLineIds, observations: [{ peakId }] }],
  };
}

describe("peak candidate UI projection", () => {
  it("separates the nearest line from an accepted hypothesis assignment", () => {
    const nearest = candidate("near", "Ne", "Неон", 500, 0.1);
    const assigned = candidate("assigned", "Fe", "Железо", 500.1, 0.3);
    const analysis: CandidateAnalysisLike = {
      hypotheses: [hypothesis("fe", "Fe", "Железо", "peak-1", ["assigned"])],
      rejectedHypotheses: [],
    };

    const view = createPeakCandidateView(analysis, {
      id: "peak-1",
      candidates: [nearest, assigned],
      match: nearest,
    }, []);

    expect(view.acceptedAssignments.map((group) => group.lineIds)).toEqual([["assigned"]]);
    expect(view.nearest?.lineIds).toEqual(["near"]);
    expect(view.nearest?.acceptedAssignment).toBeNull();
  });

  it("groups only visually identical records and keeps every stable identifier", () => {
    const duplicateA = candidate("same-a", "N", "Азот", 500.0001, 0.4);
    const duplicateB = candidate("same-b", "N", "Азот", 500.0002, 0.2);
    const differentOrigin = candidate("ritz", "N", "Азот", 500.0002, 0.1, 1, "ritz");
    const differentMedium = candidate("vacuum", "N", "Азот", 500.0002, 0.15, 1, "observed", "vacuum");
    const differentWavelength = candidate("visible-difference", "N", "Азот", 500.0006, 0.05);
    const candidates = [duplicateA, duplicateB, differentOrigin, differentMedium, differentWavelength];

    const view = createPeakCandidateView(
      { hypotheses: [], rejectedHypotheses: [] },
      { id: "peak-1", candidates, match: differentWavelength },
      [],
    );

    expect(view.groups).toHaveLength(4);
    expect(view.groups.find((group) => group.lineIds.includes("same-a"))?.lineIds).toEqual(["same-a", "same-b"]);
    expect(view.groups.find((group) => group.lineIds.includes("same-a"))?.representative.lineId).toBe("same-b");
    expect(view.groups.flatMap((group) => group.lineIds).sort()).toEqual(candidates.map((item) => item.lineId).sort());
    expect(view.candidateCount).toBe(candidates.length);
    expect(candidates.map((item) => item.lineId)).toEqual(["same-a", "same-b", "ritz", "vacuum", "visible-difference"]);
  });

  it("limits compact alternatives and orders accepted, diagnostic and remaining groups deterministically", () => {
    const items = [
      candidate("other-a", "A", "Альфа", 501, 0.01),
      candidate("diagnostic", "D", "Диагностика", 502, 0.9),
      candidate("accepted-unassigned", "F", "Феррум", 503, 0.8),
      candidate("other-b", "B", "Бета", 504, 0.02),
      candidate("other-c", "C", "Гамма", 505, 0.03),
      candidate("other-d", "E", "Дельта", 506, 0.04),
      candidate("other-e", "G", "Эпсилон", 507, 0.05),
      candidate("other-f", "H", "Дзета", 508, 0.06),
    ];
    const analysis: CandidateAnalysisLike = {
      hypotheses: [hypothesis("accepted", "F", "Феррум", "other-peak", ["accepted-unassigned"])],
      rejectedHypotheses: [{ hypothesis: hypothesis("diagnostic-hyp", "D", "Диагностика", "peak-1", ["diagnostic"]) }],
    };

    const view = createPeakCandidateView(analysis, { id: "peak-1", candidates: items, match: items[0] }, []);

    expect(view.compactAlternatives).toHaveLength(5);
    expect(view.compactAlternatives.map((group) => group.representative.lineId)).toEqual([
      "accepted-unassigned",
      "diagnostic",
      "other-b",
      "other-c",
      "other-d",
    ]);
  });

  it("filters by name, symbol, ionization and hypothesis relation independently and together", () => {
    const accepted = candidate("fe-i", "Fe", "Железо", 500, 0.1);
    const diagnostic = candidate("n-ii", "N", "Азот", 501, 0.2, 2);
    const other = candidate("o-i", "O", "Кислород", 502, 0.3);
    const analysis: CandidateAnalysisLike = {
      hypotheses: [hypothesis("fe", "Fe", "Железо", "peak-1", ["fe-i"])],
      rejectedHypotheses: [{ hypothesis: hypothesis("n", "N", "Азот", "peak-1", ["n-ii"]) }],
    };
    const groups = createPeakCandidateView(
      analysis,
      { id: "peak-1", candidates: [accepted, diagnostic, other], match: accepted },
      [],
    ).groups;

    expect(filterCandidateGroups(groups, { query: "железо" }).map((group) => group.lineIds[0])).toEqual(["fe-i"]);
    expect(filterCandidateGroups(groups, { query: "Fe" }).map((group) => group.lineIds[0])).toEqual(["fe-i"]);
    expect(filterCandidateGroups(groups, { ionizationStage: 2 }).map((group) => group.lineIds[0])).toEqual(["n-ii"]);
    expect(filterCandidateGroups(groups, { relation: "accepted" }).map((group) => group.lineIds[0])).toEqual(["fe-i"]);
    expect(filterCandidateGroups(groups, { relation: "diagnostic" }).map((group) => group.lineIds[0])).toEqual(["n-ii"]);
    expect(filterCandidateGroups(groups, { query: "Азот", ionizationStage: 2, relation: "diagnostic" })).toHaveLength(1);
    expect(filterCandidateGroups(groups, { query: "Азот", ionizationStage: 1, relation: "diagnostic" })).toHaveLength(0);
  });
});
