import type { SpectralLine } from "@/domain/spectral-library/types";

import { KEY_CHARACTERISTIC_LINES_PER_ELEMENT_ION, selectCharacteristicLines } from "./characteristic-lines";
import { round } from "./math";
import type {
  AnalysisEvidenceLine,
  AnalyzedPeak,
  ChannelPreparationResult,
  ElementInterpretation,
  EvidenceObservation,
  RejectedElementHypothesis,
  RejectedHypothesisReason,
  SpectralLineCandidate,
} from "./types";

interface AssignedCandidate {
  readonly peak: AnalyzedPeak;
  readonly candidate: SpectralLineCandidate;
}

export interface IdentificationResult {
  readonly hypotheses: readonly ElementInterpretation[];
  readonly rejectedHypotheses: readonly RejectedElementHypothesis[];
}

export function buildElementHypotheses(
  channels: readonly ChannelPreparationResult[],
  library: readonly SpectralLine[],
  tolerance: number,
): IdentificationResult {
  const usableChannels = channels.filter((channel) => channel.usable);
  const allPeaks = usableChannels.flatMap((channel) => channel.peaks);
  const elementSymbols = [...new Set(allPeaks.flatMap((peak) => peak.candidates.map((candidate) => candidate.elementSymbol)))].sort();
  const characteristicGroups = selectCharacteristicLines(library, usableChannels.map((channel) => channel.wavelengthRange));
  const lineById = new Map(library.map((line) => [line.id, line] as const));
  const alternativesByPeak = new Map(allPeaks.map((peak) => [
    peak.id,
    [...new Set(peak.candidates.map((candidate) => candidate.elementSymbol))].sort(),
  ] as const));
  const coveredWidthNm = unionWidth(usableChannels.map((channel) => channel.wavelengthRange));
  const interpretations: ElementInterpretation[] = [];
  const rejectedHypotheses: RejectedElementHypothesis[] = [];

  for (const symbol of elementSymbols) {
    const assignments = usableChannels.flatMap((channel) => assignElementCandidates(
      channel.peaks,
      symbol,
      channel.parameters.peakSearch.tolerance,
    ));
    if (assignments.length === 0) continue;
    const firstCandidate = assignments[0].candidate;
    const evidence = aggregateEvidence(assignments, lineById);
    const elementCharacteristicGroups = characteristicGroups.filter((group) => group.elementSymbol === symbol);
    const availableCharacteristicLines = elementCharacteristicGroups.flatMap((group) => group.lines);
    const matchedLineIds = new Set(evidence.map((item) => item.lineId));
    const foundCharacteristicLines = availableCharacteristicLines.filter((line) => matchedLineIds.has(line.lineId));
    const missingCharacteristicLines = availableCharacteristicLines.filter((line) => !matchedLineIds.has(line.lineId));
    const absoluteDeltas = evidence.flatMap((item) => item.observations.map((observation) => Math.abs(observation.delta)));
    const meanAbsoluteDelta = average(absoluteDeltas);
    const maximumAbsoluteDelta = Math.max(...absoluteDeltas, 0);
    const independentMatchedLineCount = evidence.length;
    const completeness = availableCharacteristicLines.length > 0
      ? foundCharacteristicLines.length / availableCharacteristicLines.length
      : 0;
    const randomAgreement = estimateRandomAgreement(
      allPeaks.length,
      tolerance,
      coveredWidthNm,
      availableCharacteristicLines.length,
      foundCharacteristicLines.length,
    );
    const ionizationStages = [...new Set([
      ...evidence.map((item) => item.ionizationStage),
      ...elementCharacteristicGroups.map((group) => group.ionizationStage),
    ])].sort((left, right) => left - right);
    const keyLineIds = new Set(elementCharacteristicGroups.flatMap((group) => group.lines.slice(0, KEY_CHARACTERISTIC_LINES_PER_ELEMENT_ION).map((line) => line.lineId)));
    const hasKeyLine = evidence.some((item) => keyLineIds.has(item.lineId));
    const hypothesis: ElementInterpretation = {
      id: `nist-element-${firstCandidate.atomicNumber}`,
      atomicNumber: firstCandidate.atomicNumber,
      symbol,
      name: firstCandidate.elementName,
      independentMatchedLineCount,
      foundCharacteristicLineCount: foundCharacteristicLines.length,
      availableCharacteristicLineCount: availableCharacteristicLines.length,
      characteristicCompleteness: round(completeness, 6),
      missingCharacteristicLines,
      meanAbsoluteDelta: round(meanAbsoluteDelta, 6),
      maximumAbsoluteDelta: round(maximumAbsoluteDelta, 6),
      ionizationStages,
      ionizationGroups: ionizationStages.map((stage) => {
        const characteristicGroup = elementCharacteristicGroups.find((group) => group.ionizationStage === stage);
        const availableLines = characteristicGroup?.lines ?? [];
        const groupEvidence = evidence.filter((item) => item.ionizationStage === stage);
        const foundIds = availableLines.filter((line) => matchedLineIds.has(line.lineId)).map((line) => line.lineId);
        return {
          ionizationStage: stage,
          ionizationLabel: characteristicGroup?.ionizationLabel ?? groupEvidence[0]?.ionizationLabel ?? String(stage),
          availableCharacteristicLines: availableLines,
          foundCharacteristicLineIds: foundIds,
          missingCharacteristicLines: availableLines.filter((line) => !matchedLineIds.has(line.lineId)),
          evidence: groupEvidence,
        };
      }),
      evidence,
      observationsByChannel: usableChannels.map((channel) => {
        const observations = evidence.flatMap((item) => item.observations).filter((item) => item.channelId === channel.id);
        return { channelId: channel.id, observationCount: observations.length, peakIds: [...new Set(observations.map((item) => item.peakId))].sort() };
      }).filter((summary) => summary.observationCount > 0),
      alternativeExplanations: [...new Set(assignments.map((item) => item.peak.id))].sort().map((peakId) => ({
        peakId,
        channelId: assignments.find((item) => item.peak.id === peakId)!.peak.channelId,
        elementSymbols: (alternativesByPeak.get(peakId) ?? []).filter((candidateSymbol) => candidateSymbol !== symbol),
      })).filter((item) => item.elementSymbols.length > 0),
      rankingReasons: [
        { code: "characteristic-lines", value: foundCharacteristicLines.length, description: `Найдено характерных линий: ${foundCharacteristicLines.length}.` },
        { code: "characteristic-completeness", value: round(completeness, 6), description: `Полнота характерного набора: ${foundCharacteristicLines.length} из ${availableCharacteristicLines.length}.` },
        { code: "independent-lines", value: independentMatchedLineCount, description: `Независимых согласованных линий: ${independentMatchedLineCount}.` },
        { code: "wavelength-agreement", value: round(meanAbsoluteDelta, 6), description: `Среднее абсолютное отклонение: ${round(meanAbsoluteDelta, 4)} нм.` },
      ],
      randomAgreement,
      explanation: `${independentMatchedLineCount} независимых линий; характерных найдено ${foundCharacteristicLines.length} из ${availableCharacteristicLines.length}.`,
    };
    const reasons: RejectedHypothesisReason[] = [];
    if (independentMatchedLineCount < 2) reasons.push("single-match");
    if (availableCharacteristicLines.length < 2) reasons.push("insufficient-characteristic-lines");
    if (!hasKeyLine && availableCharacteristicLines.length > 0) reasons.push("missing-key-characteristic-lines");
    if (!randomAgreement.distinguishableFromRandom) reasons.push("random-like-agreement");
    if (reasons.length > 0) rejectedHypotheses.push({ hypothesis, reasons });
    else interpretations.push(hypothesis);
  }

  interpretations.sort(compareHypotheses);
  rejectedHypotheses.sort((left, right) => compareHypotheses(left.hypothesis, right.hypothesis));
  return { hypotheses: interpretations, rejectedHypotheses };
}

export function assignElementCandidates(
  peaks: readonly AnalyzedPeak[],
  elementSymbol: string,
  tolerance: number,
): readonly AssignedCandidate[] {
  const orderedPeaks = [...peaks].sort((left, right) => left.sourceIndex - right.sourceIndex || left.id.localeCompare(right.id));
  const candidatesByPeak = orderedPeaks.map((peak) => peak.candidates.filter((candidate) => candidate.elementSymbol === elementSymbol));
  const lineIds = [...new Set(candidatesByPeak.flatMap((items) => items.map((item) => item.lineId)))].sort();
  if (lineIds.length === 0) return [];
  const lineIndex = new Map(lineIds.map((id, index) => [id, index] as const));
  const nodeCount = 2 + orderedPeaks.length + lineIds.length;
  const source = nodeCount - 2;
  const sink = nodeCount - 1;
  const graph = Array.from({ length: nodeCount }, () => [] as FlowEdge[]);
  orderedPeaks.forEach((_, peakIndex) => addEdge(graph, source, peakIndex, 1, 0));
  lineIds.forEach((_, index) => addEdge(graph, orderedPeaks.length + index, sink, 1, 0));
  candidatesByPeak.forEach((candidates, peakIndex) => candidates
    .slice()
    .sort((left, right) => Math.abs(left.delta) - Math.abs(right.delta) || left.lineId.localeCompare(right.lineId))
    .forEach((candidate) => addEdge(
      graph,
      peakIndex,
      orderedPeaks.length + lineIndex.get(candidate.lineId)!,
      1,
      Math.abs(candidate.delta) / tolerance,
      candidate,
    )));
  runMinimumCostMaximumFlow(graph, source, sink);
  const result: AssignedCandidate[] = [];
  for (let peakIndex = 0; peakIndex < orderedPeaks.length; peakIndex += 1) {
    for (const edge of graph[peakIndex]) {
      if (edge.candidate && edge.capacity === 0) result.push({ peak: orderedPeaks[peakIndex], candidate: edge.candidate });
    }
  }
  return result.sort((left, right) => left.candidate.lineId.localeCompare(right.candidate.lineId) || left.peak.id.localeCompare(right.peak.id));
}

interface FlowEdge { to: number; reverse: number; capacity: number; cost: number; candidate?: SpectralLineCandidate }

function addEdge(graph: FlowEdge[][], from: number, to: number, capacity: number, cost: number, candidate?: SpectralLineCandidate): void {
  const forward: FlowEdge = { to, reverse: graph[to].length, capacity, cost, ...(candidate ? { candidate } : {}) };
  const reverse: FlowEdge = { to: from, reverse: graph[from].length, capacity: 0, cost: -cost };
  graph[from].push(forward);
  graph[to].push(reverse);
}

function runMinimumCostMaximumFlow(graph: FlowEdge[][], source: number, sink: number): void {
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
    if (previousNode[sink] === -1) return;
    for (let node = sink; node !== source; node = previousNode[node]) {
      const edge = graph[previousNode[node]][previousEdge[node]];
      edge.capacity -= 1;
      graph[node][edge.reverse].capacity += 1;
    }
  }
}

function aggregateEvidence(assignments: readonly AssignedCandidate[], lineById: ReadonlyMap<string, SpectralLine>): readonly AnalysisEvidenceLine[] {
  const groups = new Map<string, AssignedCandidate[]>();
  for (const assignment of assignments) groups.set(assignment.candidate.lineId, [...(groups.get(assignment.candidate.lineId) ?? []), assignment]);
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([lineId, items]) => {
    const line = lineById.get(lineId);
    const candidate = items[0].candidate;
    if (!line) throw new Error(`Справочная линия ${lineId} отсутствует в библиотеке.`);
    const observations: EvidenceObservation[] = items.map(({ peak, candidate: itemCandidate }) => ({
      channelId: peak.channelId,
      peakId: peak.id,
      peakWavelength: peak.wavelength,
      peakIntensity: peak.intensity,
      snr: peak.snr,
      delta: round(itemCandidate.delta, 6),
    })).sort((left, right) => left.channelId.localeCompare(right.channelId) || left.peakId.localeCompare(right.peakId));
    const primary = observations[0];
    return {
      lineId,
      referenceWavelength: candidate.line,
      elementSymbol: candidate.elementSymbol,
      elementName: candidate.elementName,
      ionizationStage: candidate.ionizationStage,
      ionizationLabel: candidate.ionizationLabel,
      wavelengthType: candidate.wavelengthType,
      wavelengthMedium: candidate.wavelengthMedium,
      observations,
      peakId: primary.peakId,
      peakWavelength: primary.peakWavelength,
      observedWavelength: primary.peakWavelength,
      delta: primary.delta,
    };
  });
}

function estimateRandomAgreement(peakCount: number, tolerance: number, coveredWidthNm: number, characteristicCount: number, observed: number) {
  const density = coveredWidthNm > 0 ? characteristicCount / coveredWidthNm : 0;
  const expected = peakCount * Math.min(1, 2 * tolerance * density);
  const separationThreshold = Math.max(2, Math.ceil(expected + Math.sqrt(expected + 0.25)));
  return {
    expectedAgreements: round(expected, 6),
    observedAgreements: observed,
    coveredWidthNm: round(coveredWidthNm, 6),
    peakCount,
    characteristicLineDensityPerNm: round(density, 8),
    distinguishableFromRandom: observed >= separationThreshold,
  };
}

function compareHypotheses(left: ElementInterpretation, right: ElementInterpretation): number {
  return right.foundCharacteristicLineCount - left.foundCharacteristicLineCount
    || right.characteristicCompleteness - left.characteristicCompleteness
    || right.independentMatchedLineCount - left.independentMatchedLineCount
    || left.meanAbsoluteDelta - right.meanAbsoluteDelta
    || left.id.localeCompare(right.id);
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
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
