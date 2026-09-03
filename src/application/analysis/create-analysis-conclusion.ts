import type { InteractiveSpectrumAnalysis, SpectrumType } from "@/domain/spectrum";

/** Russian presentation of a structured analysis result. */
export function createAnalysisConclusion(result: InteractiveSpectrumAnalysis): string {
  return `${result.suitability.summary} ${buildAtomicConclusion(
    result.hypotheses,
    result.rejectedHypotheses,
    result.molecularHypotheses,
    result.spectrumType,
    result.unmatchedPeaks.length,
    result.peaks.length,
  )}`;
}

function buildAtomicConclusion(
  hypotheses: InteractiveSpectrumAnalysis["hypotheses"],
  rejectedHypotheses: InteractiveSpectrumAnalysis["rejectedHypotheses"],
  molecularHypotheses: InteractiveSpectrumAnalysis["molecularHypotheses"],
  spectrumType: SpectrumType,
  unmatchedCount: number,
  totalPeakCount: number,
): string {
  const rejectedCount = rejectedHypotheses.length;
  if (totalPeakCount === 0) return appendMolecularConclusion("При выбранных параметрах устойчивые атомные пики не найдены; автоматическая интерпретация остаётся неопределённой.", molecularHypotheses, spectrumType);
  if (hypotheses.length === 0) {
    const diagnostic = rejectedCount > 0 ? ` Зафиксированы единичные совпадения или согласования, не отличающиеся от случайных: ${rejectedCount}.` : "";
    return appendMolecularConclusion(`Многолинейная атомная гипотеза не сформирована.${diagnostic}`, molecularHypotheses, spectrumType);
  }
  const leading = hypotheses[0];
  const alternatives = hypotheses.slice(1, 4).map((item) => `${item.name} (${item.symbol})`).join(", ");
  return appendMolecularConclusion(`Лучше всего атомными линиями поддержан ${leading.name} (${leading.symbol}): ${formatGroupCount(leading.strongCharacteristicGroupCount, "сильная", "сильные", "сильных")} и ${formatGroupCount(leading.reliableCharacteristicGroupCount, "качественная характерная", "качественные характерные", "качественных характерных")}. Это ранжирование спектральных доказательств, а не оценка концентрации.${alternatives ? ` Другие надёжные гипотезы: ${alternatives}.` : ""}${rejectedCount ? ` Слабые и неоднозначные совпадения сохранены в подробностях: ${rejectedCount}.` : ""}${unmatchedCount ? ` Пиков без кандидатов: ${unmatchedCount}.` : ""}`, molecularHypotheses, spectrumType);
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
  if (!molecularHypotheses.length) return `${atomicConclusion} Надёжного совпадения молекулярных полос N₂ или N₂⁺ не найдено.`;
  const forms = molecularHypotheses.map((item) => `${item.displayName} (${item.formula})`).join(", ");
  return `${atomicConclusion} Форма молекулярных полос независимо поддерживает: ${forms}. Совпадающие участки не суммируются с атомными линиями.`;
}
