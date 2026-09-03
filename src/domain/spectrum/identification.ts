import type { SpectralLine } from "@/domain/spectral-library/types";

import { selectCharacteristicSpectralGroups } from "./characteristic-lines";
import { calculateAdaptiveTolerance } from "./matching";
import { round } from "./math";
import { groupSpectralLines, type SpectralLineGroup } from "./spectral-groups";
import { IDENTIFICATION_QUALITY_PROFILE } from "./quality-profile";
import type {
  AnalysisEvidenceLine,
  AnalyzedPeak,
  ChannelPreparationResult,
  CharacteristicSpectralGroupSummary,
  ElementInterpretation,
  EvidenceObservation,
  EvidenceStrength,
  RejectedElementHypothesis,
  RejectedHypothesisReason,
  SpectralLineCandidate,
} from "./types";

interface AssignedCandidate {
  readonly peak: AnalyzedPeak;
  readonly candidate: SpectralLineCandidate;
}

interface AssignedGroupCandidate extends AssignedCandidate {
  readonly group: SpectralLineGroup;
}

export interface IdentificationResult {
  readonly hypotheses: readonly ElementInterpretation[];
  readonly rejectedHypotheses: readonly RejectedElementHypothesis[];
}

export function buildElementHypotheses(
  channels: readonly ChannelPreparationResult[],
  library: readonly SpectralLine[],
): IdentificationResult {
  const usableChannels = channels.filter((channel) => channel.usable);
  if (!usableChannels.length) return { hypotheses: [], rejectedHypotheses: [] };
  const allPeaks = usableChannels.flatMap((channel) => channel.peaks);
  const elementSymbols = [...new Set(allPeaks.flatMap((peak) => peak.candidates.map((candidate) => candidate.elementSymbol)))].sort();
  const testedElementCount = elementSymbols.length;
  const groupingResolutionNm = Math.max(Math.min(...usableChannels.map((channel) => channel.spectralResolutionNm)), Number.EPSILON);
  const spectralGroups = groupSpectralLines(library, groupingResolutionNm);
  const groupByLineId = new Map(spectralGroups.flatMap((group) => group.lines.map((line) => [line.id, group] as const)));
  const groupById = new Map(spectralGroups.map((group) => [group.id, group] as const));
  const characteristicCollections = selectCharacteristicSpectralGroups(
    library,
    usableChannels.map((channel) => channel.wavelengthRange),
    groupingResolutionNm,
  );
  const characteristicGroups = characteristicCollections.flatMap((collection) => collection.groups);
  const characteristicById = new Map(characteristicGroups.map((group) => [group.id, group] as const));
  const characteristicByLineId = new Map(characteristicGroups.flatMap((group) => group.lines.map((line) => [line.lineId, group] as const)));
  const lineById = new Map(library.map((line) => [line.id, line] as const));
  const channelById = new Map(usableChannels.map((channel) => [channel.id, channel] as const));
  const peakById = new Map(allPeaks.map((peak) => [peak.id, peak] as const));
  const alternativesByPeak = new Map(allPeaks.map((peak) => [
    peak.id,
    [...new Set(peak.candidates.map((candidate) => candidate.elementSymbol))].sort(),
  ] as const));
  const coveredWidthNm = unionWidth(usableChannels.map((channel) => channel.wavelengthRange));
  const accepted: ElementInterpretation[] = [];
  const rejected: RejectedElementHypothesis[] = [];

  for (const symbol of elementSymbols) {
    const assignments = usableChannels.flatMap((channel) => assignElementGroupCandidates(
      channel.peaks,
      symbol,
      groupByLineId,
    ));
    if (!assignments.length) continue;
    const firstCandidate = assignments[0].candidate;
    const evidence = aggregateGroupEvidence(
      assignments,
      groupById,
      lineById,
      characteristicByLineId,
      channelById,
      groupingResolutionNm,
    );
    const elementCollections = characteristicCollections.filter((collection) => collection.elementSymbol === symbol);
    const availableCharacteristicGroups = elementCollections.flatMap((collection) => collection.groups);
    const foundCharacteristicGroups = availableCharacteristicGroups.filter((group) => (
      evidence.some((item) => item.characteristicGroupId === group.id)
    ));
    const foundGroupIds = new Set(foundCharacteristicGroups.map((group) => group.id));
    const missingCharacteristicGroups = availableCharacteristicGroups.filter((group) => !foundGroupIds.has(group.id));
    const reliableCharacteristicEvidence = evidence.filter((item) => item.isCharacteristic && item.strength !== "weak");
    const strongCharacteristicEvidence = evidence.filter((item) => item.isCharacteristic && item.strength === "strong");
    const controlComparableCharacteristicEvidence = evidence.filter((item) => (
      item.isCharacteristic
      && item.observations.some((observation) => (
        observation.normalizedDelta <= IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.maximumPatternNormalizedDelta
      ))
    ));
    const reliableKeyEvidence = reliableCharacteristicEvidence.filter((item) => item.isKeyCharacteristic);
    const highSpecificityCharacteristicEvidence = reliableCharacteristicEvidence.filter((item) => (
      item.specificity >= IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.minimumHighSpecificity
    ));
    const wavelengthCoherence = assessWavelengthCoherence(reliableCharacteristicEvidence, channelById);
    const characteristicPriorityIndex = reliableCharacteristicEvidence.reduce((sum, item) => {
      const group = item.characteristicGroupId ? characteristicById.get(item.characteristicGroupId) : undefined;
      const ambiguity = Math.min(...item.observations.map((observation) => {
        const peak = peakById.get(observation.peakId);
        return new Set(peak?.candidates.map((candidate) => candidate.elementSymbol)).size || 1;
      }));
      return sum + (group ? characteristicPriorityWeight(group) / Math.sqrt(ambiguity) : 0);
    }, 0);
    const keyGroups = availableCharacteristicGroups.filter((group) => group.key);
    const foundReliableKeyIds = new Set(reliableKeyEvidence.map((item) => item.characteristicGroupId));
    const weakEvidenceGroupCount = evidence.filter((item) => item.strength === "weak" || !item.isCharacteristic).length;
    const absoluteDeltas = evidence.flatMap((item) => item.observations.map((observation) => Math.abs(observation.delta)));
    const meanAbsoluteDelta = average(absoluteDeltas);
    const maximumAbsoluteDelta = Math.max(...absoluteDeltas, 0);
    const completeness = availableCharacteristicGroups.length
      ? foundCharacteristicGroups.length / availableCharacteristicGroups.length
      : 0;
    const randomAgreementEstimate = estimateRandomAgreement(
      allPeaks,
      coveredWidthNm,
      availableCharacteristicGroups,
      controlComparableCharacteristicEvidence.length,
      testedElementCount,
      usableChannels,
      lineById,
    );
    const preciseConstellation = reliableKeyEvidence.length >= 1
      && wavelengthCoherence.coherent
      && median(reliableCharacteristicEvidence.flatMap((item) => (
        item.observations.map((observation) => observation.normalizedDelta)
      ))) <= IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.constellationMaximumMedianNormalizedDelta;
    const coherentConstellationOverride = preciseConstellation && (
      (
        reliableCharacteristicEvidence.length
          >= IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.constellationMinimumGroups
        && highSpecificityCharacteristicEvidence.length
          >= IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.constellationMinimumGroups
        && randomAgreementEstimate.empiricalExceedanceFraction
          <= IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.constellationMaximumControlExceedanceFraction
      )
      || (
        reliableCharacteristicEvidence.length
          >= IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.strongConstellationMinimumGroups
        && strongCharacteristicEvidence.length
          >= IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.strongConstellationMinimumStrongGroups
        && highSpecificityCharacteristicEvidence.length >= reliableCharacteristicEvidence.length
        && randomAgreementEstimate.empiricalExceedanceFraction
          <= IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.strongConstellationMaximumControlExceedanceFraction
      )
    );
    const randomAgreement = {
      ...randomAgreementEstimate,
      coherentConstellationOverride,
      distinguishableFromRandom: randomAgreementEstimate.distinguishableFromRandom || coherentConstellationOverride,
    };
    const ionizationStages = [...new Set([
      ...evidence.map((item) => item.ionizationStage),
      ...elementCollections.map((collection) => collection.ionizationStage),
    ])].sort((left, right) => left - right);
    const observationsByChannel = usableChannels.map((channel) => {
      const observations = evidence.flatMap((item) => item.observations).filter((item) => item.channelId === channel.id);
      return { channelId: channel.id, observationCount: observations.length, peakIds: [...new Set(observations.map((item) => item.peakId))].sort() };
    }).filter((summary) => summary.observationCount > 0);
    const reliableChannelCount = new Set(reliableCharacteristicEvidence.flatMap((item) => item.observations.map((observation) => observation.channelId))).size;
    const hypothesisBase = {
      id: `nist-element-${firstCandidate.atomicNumber}`,
      atomicNumber: firstCandidate.atomicNumber,
      symbol,
      name: firstCandidate.elementName,
      independentMatchedGroupCount: evidence.length,
      independentMatchedLineCount: evidence.length,
      strongCharacteristicGroupCount: strongCharacteristicEvidence.length,
      reliableCharacteristicGroupCount: reliableCharacteristicEvidence.length,
      foundCharacteristicGroupCount: foundCharacteristicGroups.length,
      availableCharacteristicGroupCount: availableCharacteristicGroups.length,
      characteristicGroupCompleteness: round(completeness, 6),
      reliableKeyCharacteristicGroupCount: reliableKeyEvidence.length,
      highSpecificityCharacteristicGroupCount: highSpecificityCharacteristicEvidence.length,
      characteristicPriorityIndex: round(characteristicPriorityIndex, 6),
      missingKeyCharacteristicGroupCount: keyGroups.filter((group) => !foundReliableKeyIds.has(group.id)).length,
      weakEvidenceGroupCount,
      foundCharacteristicLineCount: foundCharacteristicGroups.length,
      availableCharacteristicLineCount: availableCharacteristicGroups.length,
      characteristicCompleteness: round(completeness, 6),
      missingCharacteristicLines: missingCharacteristicGroups.map(representativeCharacteristicLine),
      meanAbsoluteDelta: round(meanAbsoluteDelta, 6),
      maximumAbsoluteDelta: round(maximumAbsoluteDelta, 6),
      ionizationStages,
      ionizationGroups: ionizationStages.map((stage) => {
        const collection = elementCollections.find((item) => item.ionizationStage === stage);
        const availableGroups = collection?.groups ?? [];
        const groupEvidence = evidence.filter((item) => item.ionizationStage === stage);
        const foundIds = new Set(groupEvidence.map((item) => item.characteristicGroupId).filter(Boolean));
        const missingGroups = availableGroups.filter((group) => !foundIds.has(group.id));
        return {
          ionizationStage: stage,
          ionizationLabel: collection?.ionizationLabel ?? groupEvidence[0]?.ionizationLabel ?? String(stage),
          availableCharacteristicLines: availableGroups.flatMap((group) => group.lines),
          foundCharacteristicLineIds: availableGroups.filter((group) => foundIds.has(group.id)).flatMap((group) => group.lines.map((line) => line.lineId)),
          missingCharacteristicLines: missingGroups.map(representativeCharacteristicLine),
          availableCharacteristicGroups: availableGroups,
          foundCharacteristicGroupIds: availableGroups.filter((group) => foundIds.has(group.id)).map((group) => group.id),
          missingCharacteristicGroups: missingGroups,
          evidence: groupEvidence,
        };
      }),
      evidence,
      observationsByChannel,
      alternativeExplanations: [...new Set(assignments.map((item) => item.peak.id))].sort().map((peakId) => ({
        peakId,
        channelId: assignments.find((item) => item.peak.id === peakId)!.peak.channelId,
        elementSymbols: (alternativesByPeak.get(peakId) ?? []).filter((candidateSymbol) => candidateSymbol !== symbol),
      })).filter((item) => item.elementSymbols.length > 0),
      rankingReasons: [
        { code: "strong-groups" as const, value: strongCharacteristicEvidence.length, description: `Сильных характерных групп: ${strongCharacteristicEvidence.length}.` },
        { code: "characteristic-groups" as const, value: reliableCharacteristicEvidence.length, description: `Качественных характерных групп: ${reliableCharacteristicEvidence.length} из ${availableCharacteristicGroups.length}.` },
        { code: "key-groups" as const, value: reliableKeyEvidence.length, description: `Ключевых групп с качественным наблюдением: ${reliableKeyEvidence.length}.` },
        { code: "independent-groups" as const, value: evidence.length, description: `Независимых разрешаемых групп: ${evidence.length}.` },
        { code: "weak-evidence" as const, value: weakEvidenceGroupCount, description: `Слабых или нехарактерных групп: ${weakEvidenceGroupCount}.` },
        { code: "channel-support" as const, value: reliableChannelCount, description: `Каналов с качественными характерными наблюдениями: ${reliableChannelCount}.` },
        { code: "wavelength-agreement" as const, value: round(meanAbsoluteDelta, 6), description: `Среднее абсолютное отклонение: ${round(meanAbsoluteDelta, 4)} нм.` },
      ],
      randomAgreement,
      wavelengthCoherence,
    };
    const reasons: RejectedHypothesisReason[] = [];
    if (evidence.length < 2) reasons.push("single-match");
    if (availableCharacteristicGroups.length < 2) reasons.push("insufficient-characteristic-lines");
    if (!reliableKeyEvidence.length && availableCharacteristicGroups.length) reasons.push("missing-key-characteristic-lines");
    if (!randomAgreement.distinguishableFromRandom) reasons.push("random-like-agreement");
    if (reliableCharacteristicEvidence.length < IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.minimumReliableGroups) {
      reasons.push("insufficient-reliable-groups");
    }
    if (
      strongCharacteristicEvidence.length === 0
      && reliableCharacteristicEvidence.length
        < IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.minimumReliableGroupsWithoutStrongEvidence
    ) {
      reasons.push("weak-evidence-dominated");
    }
    if (highSpecificityCharacteristicEvidence.length < IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.minimumHighSpecificityGroups) {
      reasons.push("ambiguous-evidence");
    }
    if (!wavelengthCoherence.coherent) reasons.push("incoherent-wavelength-shift");
    const reliable = reasons.length === 0;
    const hypothesis: ElementInterpretation = {
      ...hypothesisBase,
      reliability: reliable ? "reliable" : "tentative",
      explanation: reliable
        ? `${strongCharacteristicEvidence.length} сильных и ${reliableCharacteristicEvidence.length} качественных характерных спектральных групп; ${reliableKeyEvidence.length} из них ключевые.`
        : `${reliableCharacteristicEvidence.length} качественных характерных спектральных групп; вывод требует осторожности и вынесен в подробности.`,
    };
    if (reliable) accepted.push(hypothesis);
    else rejected.push({ hypothesis, reasons });
  }

  accepted.sort(compareHypotheses);
  rejected.sort((left, right) => compareHypotheses(left.hypothesis, right.hypothesis));
  return { hypotheses: accepted, rejectedHypotheses: rejected };
}

/** Retained as a line-level utility for peak inspection and focused unit tests. */
export function assignElementCandidates(
  peaks: readonly AnalyzedPeak[],
  elementSymbol: string,
): readonly AssignedCandidate[] {
  return assignCandidatesByIdentity(peaks, elementSymbol, (candidate) => candidate.lineId)
    .map(({ peak, candidate }) => ({ peak, candidate }));
}

function assignElementGroupCandidates(
  peaks: readonly AnalyzedPeak[],
  elementSymbol: string,
  groupByLineId: ReadonlyMap<string, SpectralLineGroup>,
): readonly AssignedGroupCandidate[] {
  const assigned = assignCandidatesByIdentity(peaks, elementSymbol, (candidate) => groupByLineId.get(candidate.lineId)?.id);
  return assigned.flatMap(({ peak, candidate, identity }) => {
    const group = groupByLineId.get(candidate.lineId);
    return group && group.id === identity ? [{ peak, candidate, group }] : [];
  });
}

function assignCandidatesByIdentity(
  peaks: readonly AnalyzedPeak[],
  elementSymbol: string,
  getIdentity: (candidate: SpectralLineCandidate) => string | undefined,
): readonly (AssignedCandidate & { readonly identity: string })[] {
  const orderedPeaks = [...peaks].sort((left, right) => left.sourceIndex - right.sourceIndex || left.id.localeCompare(right.id));
  const candidatesByPeak = orderedPeaks.map((peak) => {
    const byIdentity = new Map<string, SpectralLineCandidate>();
    for (const candidate of peak.candidates.filter((item) => item.elementSymbol === elementSymbol)) {
      const identity = getIdentity(candidate);
      if (!identity) continue;
      const current = byIdentity.get(identity);
      if (!current || Math.abs(candidate.delta) < Math.abs(current.delta) || (Math.abs(candidate.delta) === Math.abs(current.delta) && candidate.lineId.localeCompare(current.lineId) < 0)) {
        byIdentity.set(identity, candidate);
      }
    }
    return byIdentity;
  });
  const identities = [...new Set(candidatesByPeak.flatMap((items) => [...items.keys()]))].sort();
  if (!identities.length) return [];
  const identityIndex = new Map(identities.map((id, index) => [id, index] as const));
  const nodeCount = 2 + orderedPeaks.length + identities.length;
  const source = nodeCount - 2;
  const sink = nodeCount - 1;
  const graph = Array.from({ length: nodeCount }, () => [] as FlowEdge[]);
  orderedPeaks.forEach((_, peakIndex) => addEdge(graph, source, peakIndex, 1, 0));
  identities.forEach((_, index) => addEdge(graph, orderedPeaks.length + index, sink, 1, 0));
  candidatesByPeak.forEach((candidates, peakIndex) => [...candidates.entries()]
    .sort((left, right) => Math.abs(left[1].delta) - Math.abs(right[1].delta) || left[0].localeCompare(right[0]))
    .forEach(([identity, candidate]) => addEdge(
      graph,
      peakIndex,
      orderedPeaks.length + identityIndex.get(identity)!,
      1,
      candidate.normalizedDelta - IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.maximumAssignmentNormalizedDelta,
      candidate,
      identity,
    )));
  runMinimumCostFlowWhileBeneficial(graph, source, sink);
  const result: (AssignedCandidate & { identity: string })[] = [];
  for (let peakIndex = 0; peakIndex < orderedPeaks.length; peakIndex += 1) {
    for (const edge of graph[peakIndex]) {
      if (edge.candidate && edge.identity && edge.capacity === 0) result.push({ peak: orderedPeaks[peakIndex], candidate: edge.candidate, identity: edge.identity });
    }
  }
  return result.sort((left, right) => left.identity.localeCompare(right.identity) || left.peak.id.localeCompare(right.peak.id));
}

interface FlowEdge { to: number; reverse: number; capacity: number; cost: number; candidate?: SpectralLineCandidate; identity?: string }

function addEdge(graph: FlowEdge[][], from: number, to: number, capacity: number, cost: number, candidate?: SpectralLineCandidate, identity?: string): void {
  const forward: FlowEdge = { to, reverse: graph[to].length, capacity, cost, ...(candidate ? { candidate } : {}), ...(identity ? { identity } : {}) };
  const reverse: FlowEdge = { to: from, reverse: graph[from].length, capacity: 0, cost: -cost };
  graph[from].push(forward);
  graph[to].push(reverse);
}

function runMinimumCostFlowWhileBeneficial(graph: FlowEdge[][], source: number, sink: number): void {
  for (;;) {
    const distance = new Array<number>(graph.length).fill(Number.POSITIVE_INFINITY);
    const previousNode = new Array<number>(graph.length).fill(-1);
    const previousEdge = new Array<number>(graph.length).fill(-1);
    distance[source] = 0;
    for (let pass = 0; pass < graph.length - 1; pass += 1) {
      let changed = false;
      for (let node = 0; node < graph.length; node += 1) {
        if (!Number.isFinite(distance[node])) continue;
        for (let edgeIndex = 0; edgeIndex < graph[node].length; edgeIndex += 1) {
          const edge = graph[node][edgeIndex];
          const nextDistance = distance[node] + edge.cost;
          if (edge.capacity > 0 && nextDistance < distance[edge.to] - 1e-12) {
            distance[edge.to] = nextDistance;
            previousNode[edge.to] = node;
            previousEdge[edge.to] = edgeIndex;
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
    if (previousNode[sink] === -1 || distance[sink] >= -1e-12) return;
    for (let node = sink; node !== source; node = previousNode[node]) {
      const edge = graph[previousNode[node]][previousEdge[node]];
      edge.capacity -= 1;
      graph[node][edge.reverse].capacity += 1;
    }
  }
}

function aggregateGroupEvidence(
  assignments: readonly AssignedGroupCandidate[],
  groupById: ReadonlyMap<string, SpectralLineGroup>,
  lineById: ReadonlyMap<string, SpectralLine>,
  characteristicByLineId: ReadonlyMap<string, CharacteristicSpectralGroupSummary>,
  channelById: ReadonlyMap<string, ChannelPreparationResult>,
  resolutionNm: number,
): readonly AnalysisEvidenceLine[] {
  const groups = new Map<string, AssignedGroupCandidate[]>();
  for (const assignment of assignments) groups.set(assignment.group.id, [...(groups.get(assignment.group.id) ?? []), assignment]);
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([groupId, items]) => {
    const group = groupById.get(groupId);
    if (!group) throw new Error(`Спектральная группа ${groupId} отсутствует в библиотеке.`);
    const primaryAssignment = [...items].sort((left, right) => Math.abs(left.candidate.delta) - Math.abs(right.candidate.delta) || left.candidate.lineId.localeCompare(right.candidate.lineId))[0];
    const candidate = primaryAssignment.candidate;
    const line = lineById.get(candidate.lineId);
    if (!line) throw new Error(`Справочная линия ${candidate.lineId} отсутствует в библиотеке.`);
    const observations: EvidenceObservation[] = items.map(({ peak, candidate: itemCandidate }) => ({
      channelId: peak.channelId,
      peakId: peak.id,
      peakWavelength: peak.wavelength,
      peakIntensity: peak.intensity,
      snr: peak.snr,
      prominence: peak.prominence,
      widthNm: peak.widthNm,
      delta: round(itemCandidate.delta, 6),
      adaptiveToleranceNm: itemCandidate.adaptiveToleranceNm,
      combinedUncertaintyNm: itemCandidate.combinedUncertaintyNm,
      normalizedDelta: itemCandidate.normalizedDelta,
      competingElementCount: new Set(peak.candidates.map((item) => item.elementSymbol)).size,
      specificity: round(scoreCandidateSpecificity(peak, itemCandidate), 6),
      uncertainty: itemCandidate.uncertainty,
    })).sort((left, right) => left.channelId.localeCompare(right.channelId) || left.peakId.localeCompare(right.peakId));
    const observationQualities = items.map(({ peak, candidate: itemCandidate }) => {
      const channel = channelById.get(peak.channelId)!;
      return scoreObservation(peak, itemCandidate, channel, scoreCandidateSpecificity(peak, itemCandidate));
    });
    const channelSupportCount = new Set(observations.map((observation) => observation.channelId)).size;
    const quality = Math.min(1, Math.max(...observationQualities, 0) + Math.min(0.15, (channelSupportCount - 1) * 0.08));
    const specificity = Math.max(...observations.map((observation) => observation.specificity), 0);
    const normalizedDelta = Math.min(...items.map((item) => item.candidate.normalizedDelta));
    const strength: EvidenceStrength = quality >= IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.minimumStrongQuality
        && normalizedDelta <= 0.67
        && specificity >= IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.minimumSpecificityForStrong
      ? "strong"
      : quality >= IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.minimumModerateQuality
          && normalizedDelta <= 0.85
          && specificity >= IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.minimumSpecificityForModerate
        ? "moderate"
        : "weak";
    const characteristicGroup = group.lines.map((item) => characteristicByLineId.get(item.id)).find(Boolean);
    const primary = observations[0];
    return {
      groupId,
      lineId: candidate.lineId,
      memberLineIds: group.lines.map((item) => item.id),
      memberWavelengths: group.lines.map((item) => item.preferredWavelength.valueNm),
      spectralResolutionNm: resolutionNm,
      referenceWavelength: candidate.line,
      elementSymbol: candidate.elementSymbol,
      elementName: candidate.elementName,
      ionizationStage: candidate.ionizationStage,
      ionizationLabel: candidate.ionizationLabel,
      wavelengthType: candidate.wavelengthType,
      wavelengthMedium: candidate.wavelengthMedium,
      strength,
      quality: round(quality, 6),
      specificity: round(specificity, 6),
      channelSupportCount,
      ...(characteristicGroup ? { characteristicGroupId: characteristicGroup.id } : {}),
      isCharacteristic: Boolean(characteristicGroup),
      isKeyCharacteristic: characteristicGroup?.key ?? false,
      observations,
      peakId: primary.peakId,
      peakWavelength: primary.peakWavelength,
      observedWavelength: primary.peakWavelength,
      delta: primary.delta,
    };
  });
}

function scoreObservation(
  peak: AnalyzedPeak,
  candidate: SpectralLineCandidate,
  channel: ChannelPreparationResult,
  specificity: number,
): number {
  const snrScale = Math.max(20, channel.parameters.peakSearch.minimumSnr * 4);
  const snrFactor = clamp(Math.log1p(peak.snr) / Math.log1p(snrScale));
  const prominenceFactor = clamp(peak.prominence / Math.max(0.1, channel.parameters.peakSearch.prominence * 3));
  const deltaFactor = Math.exp(-0.5 * Math.pow(candidate.normalizedDelta / 0.55, 2));
  const widthRatio = peak.widthNm / channel.spectralResolutionNm;
  const widthFactor = widthRatio > 0 ? Math.exp(-Math.abs(Math.log(widthRatio))) : 0;
  const physicalQuality = 0.35 * deltaFactor + 0.25 * snrFactor + 0.25 * prominenceFactor + 0.15 * widthFactor;
  return physicalQuality * (0.6 + 0.4 * specificity);
}

function scoreCandidateSpecificity(peak: AnalyzedPeak, candidate: SpectralLineCandidate): number {
  const bestByElement = new Map<string, number>();
  for (const item of peak.candidates) {
    const current = bestByElement.get(item.elementSymbol);
    if (current === undefined || item.normalizedDelta < current) bestByElement.set(item.elementSymbol, item.normalizedDelta);
  }
  if (bestByElement.size <= 1) return 1;
  const current = bestByElement.get(candidate.elementSymbol) ?? candidate.normalizedDelta;
  const closestCompetitor = Math.min(...[...bestByElement.entries()]
    .filter(([symbol]) => symbol !== candidate.elementSymbol)
    .map(([, normalizedDelta]) => normalizedDelta));
  const separation = clamp((closestCompetitor - current) / 0.4);
  const uniqueness = 1 / Math.sqrt(bestByElement.size);
  return clamp(uniqueness * (0.7 + 0.3 * separation));
}

function assessWavelengthCoherence(
  evidence: readonly AnalysisEvidenceLine[],
  channelById: ReadonlyMap<string, ChannelPreparationResult>,
) {
  const profile = IDENTIFICATION_QUALITY_PROFILE.atomicEvidence;
  const channels = [...channelById.values()].flatMap((channel) => {
    const observations = evidence.flatMap((item) => item.observations.filter((observation) => observation.channelId === channel.id))
      .sort((left, right) => left.peakId.localeCompare(right.peakId));
    if (!observations.length) return [];
    const shift = median(observations.map((observation) => observation.delta));
    const residuals = observations.map((observation) => observation.delta - shift);
    const residualMad = 1.4826 * median(residuals.map((value) => Math.abs(value)));
    const uncertaintyFloor = median(observations.map((observation) => observation.combinedUncertaintyNm))
      * profile.coherenceUncertaintyFactor;
    const inlierLimit = Math.max(channel.spectralResolutionNm * profile.coherenceResolutionFraction, uncertaintyFloor);
    const inlierCount = residuals.filter((value) => Math.abs(value) <= inlierLimit).length;
    const evaluated = observations.length >= profile.coherenceMinimumObservations;
    const coherent = !evaluated || (
      inlierCount / observations.length >= profile.coherenceMinimumInlierFraction
      && residualMad <= inlierLimit
    );
    return [{
      channelId: channel.id,
      observationCount: observations.length,
      fittedShiftNm: round(shift, 6),
      residualMadNm: round(residualMad, 6),
      inlierCount,
      evaluated,
      coherent,
    }];
  });
  return { coherent: channels.every((channel) => channel.coherent), channels };
}

function estimateRandomAgreement(
  peaks: readonly AnalyzedPeak[],
  coveredWidthNm: number,
  characteristicGroups: readonly CharacteristicSpectralGroupSummary[],
  observed: number,
  testedElementCount: number,
  channels: readonly ChannelPreparationResult[],
  lineById: ReadonlyMap<string, SpectralLine>,
) {
  const peakCount = peaks.length;
  const characteristicCount = characteristicGroups.length;
  const density = coveredWidthNm > 0 ? characteristicCount / coveredWidthNm : 0;
  const channelById = new Map(channels.map((channel) => [channel.id, channel] as const));
  const expected = peaks.reduce((sum, peak) => {
    const channel = channelById.get(peak.channelId);
    if (!channel) return sum;
    const coveredByGroups = unionWidth(characteristicGroups.flatMap((group) => {
      const representative = representativeCharacteristicLine(group);
      const line = lineById.get(representative.lineId);
      if (!line) return [];
      const adaptive = calculateAdaptiveTolerance(peak, line, {
        spectralResolutionNm: channel.spectralResolutionNm,
        calibrationUncertaintyNm: channel.wavelengthCalibration.uncertaintyNm,
      });
      const minimum = Math.max(channel.wavelengthRange.minimum, group.minimumWavelength - adaptive.toleranceNm);
      const maximum = Math.min(channel.wavelengthRange.maximum, group.maximumWavelength + adaptive.toleranceNm);
      return maximum > minimum ? [{ minimum, maximum }] : [];
    }));
    const channelWidth = channel.wavelengthRange.maximum - channel.wavelengthRange.minimum;
    return sum + Math.min(1, channelWidth > 0 ? coveredByGroups / channelWidth : 0);
  }, 0);
  const searchFactor = 1 + Math.log2(Math.max(1, testedElementCount)) / 2;
  const adjustedExpected = expected * searchFactor;
  const controlCounts = shiftedPatternControlCounts(characteristicGroups, channels, lineById);
  const orderedControls = [...controlCounts].sort((left, right) => left - right);
  const percentileIndex = Math.min(
    orderedControls.length - 1,
    Math.ceil(orderedControls.length * IDENTIFICATION_QUALITY_PROFILE.atomicEvidence.negativeControlPercentile) - 1,
  );
  const control95 = orderedControls[Math.max(0, percentileIndex)] ?? 0;
  const maximumControlAgreements = Math.max(...controlCounts, 0);
  const requiredAgreements = Math.max(2, maximumControlAgreements + 1);
  const exceedanceCount = controlCounts.filter((count) => count >= observed).length;
  return {
    expectedAgreements: round(expected, 6),
    observedAgreements: observed,
    coveredWidthNm: round(coveredWidthNm, 6),
    peakCount,
    characteristicLineDensityPerNm: round(density, 8),
    testedElementCount,
    adjustedExpectedAgreements: round(adjustedExpected, 6),
    requiredAgreements,
    testedOffsets: controlCounts.length,
    maximumControlAgreements,
    control95PercentileAgreements: control95,
    empiricalExceedanceFraction: round((exceedanceCount + 1) / (controlCounts.length + 1), 6),
    coherentConstellationOverride: false,
    distinguishableFromRandom: observed >= requiredAgreements,
  };
}

function shiftedPatternControlCounts(
  characteristicGroups: readonly CharacteristicSpectralGroupSummary[],
  channels: readonly ChannelPreparationResult[],
  lineById: ReadonlyMap<string, SpectralLine>,
): readonly number[] {
  const profile = IDENTIFICATION_QUALITY_PROFILE.atomicEvidence;
  const fractions: number[] = [];
  for (let index = 1; fractions.length < profile.negativeControlCount; index += 1) {
    const fraction = (index * 0.3819660112501051) % 1;
    if (fraction >= 0.05 && fraction <= 0.95) fractions.push(fraction);
  }
  return fractions.map((fraction) => {
    const matchedGroupIds = new Set<string>();
    for (const channel of channels) {
      const minimum = channel.wavelengthRange.minimum;
      const maximum = channel.wavelengthRange.maximum;
      const width = maximum - minimum;
      if (!(width > 0)) continue;
      const possible: { groupId: string; peakId: string; normalizedDelta: number }[] = [];
      for (const group of characteristicGroups) {
        if (group.representativeWavelength < minimum || group.representativeWavelength > maximum) continue;
        const representative = representativeCharacteristicLine(group);
        const line = lineById.get(representative.lineId);
        if (!line) continue;
        const shiftedWavelength = minimum + ((group.representativeWavelength - minimum + fraction * width) % width);
        for (const peak of channel.peaks) {
          const adaptive = calculateAdaptiveTolerance(peak, line, {
            spectralResolutionNm: channel.spectralResolutionNm,
            calibrationUncertaintyNm: channel.wavelengthCalibration.uncertaintyNm,
          });
          const normalizedDelta = Math.abs(peak.wavelength - shiftedWavelength) / adaptive.toleranceNm;
          if (normalizedDelta <= profile.maximumPatternNormalizedDelta) {
            possible.push({ groupId: group.id, peakId: peak.id, normalizedDelta });
          }
        }
      }
      const usedGroups = new Set<string>();
      const usedPeaks = new Set<string>();
      for (const candidate of possible.sort((left, right) => (
        left.normalizedDelta - right.normalizedDelta
          || left.groupId.localeCompare(right.groupId)
          || left.peakId.localeCompare(right.peakId)
      ))) {
        if (usedGroups.has(candidate.groupId) || usedPeaks.has(candidate.peakId)) continue;
        usedGroups.add(candidate.groupId);
        usedPeaks.add(candidate.peakId);
        matchedGroupIds.add(candidate.groupId);
      }
    }
    return matchedGroupIds.size;
  });
}

function compareHypotheses(left: ElementInterpretation, right: ElementInterpretation): number {
  return right.strongCharacteristicGroupCount - left.strongCharacteristicGroupCount
    || right.reliableCharacteristicGroupCount - left.reliableCharacteristicGroupCount
    || right.reliableKeyCharacteristicGroupCount - left.reliableKeyCharacteristicGroupCount
    || left.weakEvidenceGroupCount - right.weakEvidenceGroupCount
    || right.characteristicGroupCompleteness - left.characteristicGroupCompleteness
    || left.meanAbsoluteDelta - right.meanAbsoluteDelta
    || left.id.localeCompare(right.id);
}

function characteristicPriorityWeight(group: CharacteristicSpectralGroupSummary): number {
  return group.key ? 4 - group.rankWithinIonization : 1 / group.rankWithinIonization;
}

function representativeCharacteristicLine(group: CharacteristicSpectralGroupSummary) {
  return [...group.lines].sort((left, right) => (
    right.relativeIntensity - left.relativeIntensity
      || left.wavelength - right.wavelength
      || left.lineId.localeCompare(right.lineId)
  ))[0];
}

function unionWidth(ranges: readonly { minimum: number; maximum: number }[]): number {
  const sorted = [...ranges].sort((left, right) => left.minimum - right.minimum || left.maximum - right.maximum);
  let total = 0;
  let current: { minimum: number; maximum: number } | undefined;
  for (const range of sorted) {
    if (!current) current = { ...range };
    else if (range.minimum <= current.maximum) current.maximum = Math.max(current.maximum, range.maximum);
    else { total += current.maximum - current.minimum; current = { ...range }; }
  }
  return total + (current ? current.maximum - current.minimum : 0);
}

function average(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
