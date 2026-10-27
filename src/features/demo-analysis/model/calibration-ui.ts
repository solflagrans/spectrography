import type { WorkingAnalysis } from "@/application/analysis/working-analysis";

export function formatCalibrationReason(reason: WorkingAnalysis["channels"][number]["wavelengthCalibration"]["reason"]): string {
  const labels = {
    disabled: "отключена пользователем",
    "insufficient-anchors": "недостаточно однозначных сильных опор",
    "insufficient-span": "опоры недостаточно разнесены по диапазону",
    "shift-too-large": "оценённое смещение превышает физически допустимый предел",
    "validation-not-improved": "независимая проверка не улучшилась",
    "validation-residual-too-large": "остаток на независимых опорах слишком велик",
    applied: "подтверждена независимыми опорами",
  } as const;
  return labels[reason];
}

