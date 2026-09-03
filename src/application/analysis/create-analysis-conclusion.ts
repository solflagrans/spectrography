import type { InteractiveSpectrumAnalysis, SpectrumType } from "@/domain/spectrum";

/** Russian presentation of a structured analysis result. */
export function createAnalysisConclusion(result: InteractiveSpectrumAnalysis): string {
  return buildAtomicConclusion(
    result.hypotheses,
    result.molecularHypotheses,
    result.spectrumType,
    result.unmatchedPeaks.length,
    result.peaks.length,
  );
}

function buildAtomicConclusion(
  hypotheses: InteractiveSpectrumAnalysis["hypotheses"],
  molecularHypotheses: InteractiveSpectrumAnalysis["molecularHypotheses"],
  spectrumType: SpectrumType,
  unmatchedCount: number,
  totalPeakCount: number,
): string {
  if (totalPeakCount === 0) return appendMolecularConclusion("Атомные пики не найдены.", molecularHypotheses, spectrumType);
  if (hypotheses.length === 0) {
    return appendMolecularConclusion("Атомные элементы не определены.", molecularHypotheses, spectrumType);
  }
  const leading = hypotheses[0];
  const alternatives = hypotheses.slice(1, 4).map((item) => `${item.name} (${item.symbol})`).join(", ");
  const strongGroups = leading.strongCharacteristicGroupCount
    ? `; из них ${formatGroupCount(leading.strongCharacteristicGroupCount, "сильная", "сильные", "сильных")}`
    : "";
  return appendMolecularConclusion(
    `Обнаружено: ${leading.name} (${leading.symbol}). Подтверждение: ${formatGroupCount(leading.reliableCharacteristicGroupCount, "характерная", "характерные", "характерных")}${strongGroups}.${alternatives ? ` Также обнаружены: ${alternatives}.` : ""}${unmatchedCount ? ` Пиков без назначения: ${unmatchedCount}.` : ""}`,
    molecularHypotheses,
    spectrumType,
  );
}

function formatGroupCount(count: number, one: string, few: string, many: string): string {
  const lastTwo = count % 100;
  const form = lastTwo >= 11 && lastTwo <= 14
    ? many
    : count % 10 === 1
      ? one
      : count % 10 >= 2 && count % 10 <= 4
        ? few
        : many;
  return `${count} ${form} ${count % 10 === 1 && lastTwo !== 11 ? "группа" : count % 10 >= 2 && count % 10 <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? "группы" : "групп"}`;
}

function appendMolecularConclusion(
  atomicConclusion: string,
  molecularHypotheses: InteractiveSpectrumAnalysis["molecularHypotheses"],
  spectrumType: SpectrumType,
): string {
  if (spectrumType !== "plasma-emission") return atomicConclusion;
  if (!molecularHypotheses.length) return atomicConclusion;
  const forms = molecularHypotheses.map((item) => `${item.displayName} (${item.formula})`).join(", ");
  return `${atomicConclusion} Молекулярные системы: ${forms}.`;
}
