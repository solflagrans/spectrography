import type { SpectralLine } from "@/domain/spectral-library/types";
import type { AnalyzedPeak, SpectralLineCandidate } from "@/domain/spectrum";

export type CandidateHypothesisRole = "main" | "accepted-alternative" | "diagnostic";
export type CandidateRelationFilter = "all" | "accepted" | "diagnostic" | "other";

interface CandidateEvidenceLike {
  readonly groupId: string;
  readonly memberLineIds: readonly string[];
  readonly observations: readonly { readonly peakId: string }[];
}

interface CandidateHypothesisLike {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly evidence: readonly CandidateEvidenceLike[];
}

export interface CandidateAnalysisLike {
  readonly hypotheses: readonly CandidateHypothesisLike[];
  readonly rejectedHypotheses: readonly { readonly hypothesis: CandidateHypothesisLike }[];
}

export interface CandidateHypothesisLink {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly role: CandidateHypothesisRole;
  readonly assignedGroupIds: readonly string[];
}

export interface CandidateSourceRecord {
  readonly id: string;
  readonly sourceName?: string;
  readonly datasetVersion?: string;
  readonly rawWavelength?: string;
  readonly notation?: string;
}

export interface CandidateDisplayGroup {
  readonly id: string;
  readonly representative: SpectralLineCandidate;
  readonly candidates: readonly SpectralLineCandidate[];
  readonly lineIds: readonly string[];
  readonly sourceRecords: readonly CandidateSourceRecord[];
  readonly firstCandidateIndex: number;
  readonly isNearest: boolean;
  readonly hypothesis: CandidateHypothesisLink | null;
  readonly acceptedAssignment: CandidateHypothesisLink | null;
}

export interface PeakCandidateView {
  readonly groups: readonly CandidateDisplayGroup[];
  readonly acceptedAssignments: readonly CandidateDisplayGroup[];
  readonly nearest: CandidateDisplayGroup | null;
  readonly compactAlternatives: readonly CandidateDisplayGroup[];
  readonly candidateCount: number;
}

export interface CandidateGroupFilters {
  readonly query?: string;
  readonly ionizationStage?: number | "all";
  readonly relation?: CandidateRelationFilter;
}

export function createPeakCandidateView(
  analysis: CandidateAnalysisLike,
  peak: Pick<AnalyzedPeak, "id" | "candidates" | "match">,
  spectralLines: readonly SpectralLine[] = [],
): PeakCandidateView {
  const lineById = new Map(spectralLines.map((line) => [line.id, line] as const));
  const hypothesisLinks = createHypothesisLinks(analysis, peak.id);
  const candidatesByKey = new Map<string, { candidate: SpectralLineCandidate; index: number }[]>();

  peak.candidates.forEach((candidate, index) => {
    const key = getDisplayIdentity(candidate);
    candidatesByKey.set(key, [...(candidatesByKey.get(key) ?? []), { candidate, index }]);
  });

  const groups = [...candidatesByKey.entries()].map(([id, entries]): CandidateDisplayGroup => {
    const representativeEntry = [...entries].sort((left, right) => (
      left.candidate.normalizedDelta - right.candidate.normalizedDelta
        || left.index - right.index
    ))[0];
    const candidates = entries.map((entry) => entry.candidate);
    const lineIds = candidates.map((candidate) => candidate.lineId);
    const hypothesis = hypothesisLinks.find((link) => link.symbol === representativeEntry.candidate.elementSymbol) ?? null;
    const assignedGroupIds = hypothesis
      ? getAssignedGroupIds(analysis, hypothesis, peak.id, new Set(lineIds))
      : [];
    const linkedHypothesis = hypothesis ? { ...hypothesis, assignedGroupIds } : null;
    const acceptedAssignment = linkedHypothesis
      && linkedHypothesis.role !== "diagnostic"
      && linkedHypothesis.assignedGroupIds.length > 0
      ? linkedHypothesis
      : null;

    return {
      id,
      representative: representativeEntry.candidate,
      candidates,
      lineIds,
      sourceRecords: candidates.map((candidate) => toSourceRecord(candidate, lineById.get(candidate.lineId))),
      firstCandidateIndex: Math.min(...entries.map((entry) => entry.index)),
      isNearest: Boolean(peak.match && lineIds.includes(peak.match.lineId)),
      hypothesis: linkedHypothesis,
      acceptedAssignment,
    };
  }).sort(compareByNormalizedDelta);

  const acceptedAssignments = createAcceptedAssignmentGroups(
    analysis,
    peak,
    hypothesisLinks,
    lineById,
  );
  const nearest = groups.find((group) => group.isNearest) ?? null;
  const assignedLineIds = new Set(acceptedAssignments.flatMap((group) => group.lineIds));
  const compactAlternatives = groups
    .filter((group) => (
      !group.lineIds.some((lineId) => assignedLineIds.has(lineId))
        && group.id !== nearest?.id
    ))
    .sort(compareCompactGroups)
    .slice(0, 5);

  return {
    groups,
    acceptedAssignments,
    nearest: nearest && !nearest.lineIds.some((lineId) => assignedLineIds.has(lineId)) ? nearest : null,
    compactAlternatives,
    candidateCount: peak.candidates.length,
  };
}

function createAcceptedAssignmentGroups(
  analysis: CandidateAnalysisLike,
  peak: Pick<AnalyzedPeak, "id" | "candidates" | "match">,
  hypothesisLinks: readonly CandidateHypothesisLink[],
  lineById: ReadonlyMap<string, SpectralLine>,
): readonly CandidateDisplayGroup[] {
  return hypothesisLinks.flatMap((link) => {
    if (link.role === "diagnostic") return [];
    const hypothesis = analysis.hypotheses.find((item) => item.id === link.id);
    if (!hypothesis) return [];
    return hypothesis.evidence.flatMap((evidence): readonly CandidateDisplayGroup[] => {
      if (!evidence.observations.some((observation) => observation.peakId === peak.id)) return [];
      const memberIds = new Set(evidence.memberLineIds);
      const entries = peak.candidates
        .map((candidate, index) => ({ candidate, index }))
        .filter(({ candidate }) => memberIds.has(candidate.lineId));
      if (!entries.length) return [];
      const representativeEntry = [...entries].sort((left, right) => (
        left.candidate.normalizedDelta - right.candidate.normalizedDelta
          || left.index - right.index
      ))[0];
      const candidates = entries.map((entry) => entry.candidate);
      const lineIds = candidates.map((candidate) => candidate.lineId);
      const assignment = { ...link, assignedGroupIds: [evidence.groupId] };
      return [{
        id: `assignment:${link.id}:${evidence.groupId}`,
        representative: representativeEntry.candidate,
        candidates,
        lineIds,
        sourceRecords: candidates.map((candidate) => toSourceRecord(candidate, lineById.get(candidate.lineId))),
        firstCandidateIndex: Math.min(...entries.map((entry) => entry.index)),
        isNearest: Boolean(peak.match && lineIds.includes(peak.match.lineId)),
        hypothesis: assignment,
        acceptedAssignment: assignment,
      }];
    });
  }).sort(compareCompactGroups);
}

export function filterCandidateGroups(
  groups: readonly CandidateDisplayGroup[],
  filters: CandidateGroupFilters,
): readonly CandidateDisplayGroup[] {
  const query = filters.query?.trim().toLocaleLowerCase("ru") ?? "";
  const ionizationStage = filters.ionizationStage ?? "all";
  const relation = filters.relation ?? "all";

  return groups.filter((group) => {
    const candidate = group.representative;
    if (query && !`${candidate.elementName} ${candidate.elementSymbol}`.toLocaleLowerCase("ru").includes(query)) return false;
    if (ionizationStage !== "all" && candidate.ionizationStage !== ionizationStage) return false;
    if (relation === "accepted" && !group.acceptedAssignment) return false;
    if (relation === "diagnostic" && group.hypothesis?.role !== "diagnostic") return false;
    if (relation === "other" && (group.acceptedAssignment || group.hypothesis?.role === "diagnostic")) return false;
    return true;
  });
}

function createHypothesisLinks(
  analysis: CandidateAnalysisLike,
  peakId: string,
): readonly CandidateHypothesisLink[] {
  return [
    ...analysis.hypotheses.map((hypothesis, index) => ({
      id: hypothesis.id,
      symbol: hypothesis.symbol,
      name: hypothesis.name,
      role: index === 0 ? "main" as const : "accepted-alternative" as const,
      assignedGroupIds: hypothesis.evidence
        .filter((evidence) => evidence.observations.some((observation) => observation.peakId === peakId))
        .map((evidence) => evidence.groupId),
    })),
    ...analysis.rejectedHypotheses.map(({ hypothesis }) => ({
      id: hypothesis.id,
      symbol: hypothesis.symbol,
      name: hypothesis.name,
      role: "diagnostic" as const,
      assignedGroupIds: hypothesis.evidence
        .filter((evidence) => evidence.observations.some((observation) => observation.peakId === peakId))
        .map((evidence) => evidence.groupId),
    })),
  ];
}

function getAssignedGroupIds(
  analysis: CandidateAnalysisLike,
  link: CandidateHypothesisLink,
  peakId: string,
  lineIds: ReadonlySet<string>,
): readonly string[] {
  const hypothesis = link.role === "diagnostic"
    ? analysis.rejectedHypotheses.find((item) => item.hypothesis.id === link.id)?.hypothesis
    : analysis.hypotheses.find((item) => item.id === link.id);
  return hypothesis?.evidence.filter((evidence) => (
    evidence.observations.some((observation) => observation.peakId === peakId)
      && evidence.memberLineIds.some((lineId) => lineIds.has(lineId))
  )).map((evidence) => evidence.groupId) ?? [];
}

function getDisplayIdentity(candidate: SpectralLineCandidate): string {
  return [
    candidate.atomicNumber,
    candidate.elementSymbol,
    candidate.elementName,
    candidate.ionizationStage,
    candidate.line.toFixed(3),
    candidate.wavelengthType,
    candidate.wavelengthMedium,
  ].join(":");
}

function compareByNormalizedDelta(left: CandidateDisplayGroup, right: CandidateDisplayGroup): number {
  return left.representative.normalizedDelta - right.representative.normalizedDelta
    || left.firstCandidateIndex - right.firstCandidateIndex;
}

function compareCompactGroups(left: CandidateDisplayGroup, right: CandidateDisplayGroup): number {
  return getHypothesisPriority(left) - getHypothesisPriority(right)
    || compareByNormalizedDelta(left, right);
}

function getHypothesisPriority(group: CandidateDisplayGroup): number {
  if (group.hypothesis?.role === "main" || group.hypothesis?.role === "accepted-alternative") return 0;
  if (group.hypothesis?.role === "diagnostic") return 1;
  return 2;
}

function toSourceRecord(candidate: SpectralLineCandidate, line: SpectralLine | undefined): CandidateSourceRecord {
  if (!line) {
    return {
      id: candidate.lineId,
      sourceName: candidate.sourceRecord?.sourceName,
      datasetVersion: candidate.sourceRecord?.datasetVersion,
      rawWavelength: candidate.sourceRecord?.rawWavelength,
      notation: candidate.sourceRecord?.notation,
    };
  }
  const wavelength = line.preferredWavelength.origin === "observed"
    ? line.observedWavelength
    : line.ritzWavelength;
  return {
    id: candidate.lineId,
    sourceName: line.source.name,
    datasetVersion: line.source.datasetVersion,
    rawWavelength: wavelength?.rawValue,
    notation: wavelength?.notation,
  };
}
