import type { WorkingAnalysis } from "@/application/analysis/create-working-analysis";
import type { ElementInterpretation, RejectedHypothesisReason } from "@/domain/spectrum";

export type IdentificationTab = "hypotheses" | "diagnostics";
export type IdentificationSort = "ranking" | "characteristic" | "independent" | "deviation" | "name";

export interface IdentificationListEntry {
  readonly id: string;
  readonly tab: IdentificationTab;
  readonly hypothesis: ElementInterpretation;
  readonly rank: number;
  readonly rejectionReasons: readonly RejectedHypothesisReason[];
}

export const diagnosticReasonLabels: Record<RejectedHypothesisReason, string> = {
  "single-match": "Единичное совпадение",
  "random-like-agreement": "Не отличается от случайного согласования",
  "insufficient-characteristic-lines": "Недостаточно характерных линий в диапазоне",
  "missing-key-characteristic-lines": "Ключевые характерные линии не найдены",
  "weak-evidence-dominated": "Результат построен преимущественно на слабых совпадениях",
  "ambiguous-evidence": "Совпавшие пики не отличают элемент от конкурирующих объяснений",
  "incoherent-wavelength-shift": "Линии требуют несогласованных поправок шкалы",
  "insufficient-reliable-groups": "Недостаточно независимых качественных групп",
};

export function getIdentificationEntries(
  analysis: WorkingAnalysis,
  tab: IdentificationTab,
  query = "",
  sort: IdentificationSort = "ranking",
): readonly IdentificationListEntry[] {
  const entries: IdentificationListEntry[] = tab === "hypotheses"
    ? analysis.hypotheses.map((hypothesis, index) => ({
        id: hypothesis.id,
        tab,
        hypothesis,
        rank: index + 1,
        rejectionReasons: [],
      }))
    : analysis.rejectedHypotheses.map((item, index) => ({
        id: item.hypothesis.id,
        tab,
        hypothesis: item.hypothesis,
        rank: index + 1,
        rejectionReasons: item.reasons,
      }));
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const filtered = normalizedQuery
    ? entries.filter(({ hypothesis }) => `${hypothesis.symbol} ${hypothesis.name}`.toLocaleLowerCase("ru").includes(normalizedQuery))
    : entries;
  return [...filtered].sort((left, right) => compareEntries(left, right, sort));
}

export function findIdentificationEntry(
  analysis: WorkingAnalysis,
  hypothesisId: string | null,
): IdentificationListEntry | null {
  if (!hypothesisId) return null;
  return getIdentificationEntries(analysis, "hypotheses").find((entry) => entry.id === hypothesisId)
    ?? getIdentificationEntries(analysis, "diagnostics").find((entry) => entry.id === hypothesisId)
    ?? null;
}

function compareEntries(
  left: IdentificationListEntry,
  right: IdentificationListEntry,
  sort: IdentificationSort,
): number {
  if (sort === "characteristic") {
    return right.hypothesis.strongCharacteristicGroupCount - left.hypothesis.strongCharacteristicGroupCount
      || right.hypothesis.reliableCharacteristicGroupCount - left.hypothesis.reliableCharacteristicGroupCount
      || left.rank - right.rank;
  }
  if (sort === "independent") {
    return right.hypothesis.independentMatchedGroupCount - left.hypothesis.independentMatchedGroupCount
      || left.rank - right.rank;
  }
  if (sort === "deviation") {
    return left.hypothesis.meanAbsoluteDelta - right.hypothesis.meanAbsoluteDelta
      || left.rank - right.rank;
  }
  if (sort === "name") {
    return left.hypothesis.name.localeCompare(right.hypothesis.name, "ru")
      || left.hypothesis.id.localeCompare(right.hypothesis.id);
  }
  return left.rank - right.rank;
}
