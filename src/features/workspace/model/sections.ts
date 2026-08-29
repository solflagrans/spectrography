import type { LucideIcon } from "lucide-react";
import {
  ChartNoAxesCombined,
  Database,
  FileCheck2,
  ScanSearch,
  SlidersHorizontal,
} from "lucide-react";

export const workspaceSections = [
  {
    id: "data",
    href: "/data",
    label: "Данные",
    index: "01",
    icon: Database,
    description:
      "Здесь появятся импорт спектра, проверка формата и диагностика качества исходного измерения.",
  },
  {
    id: "processing",
    href: "/processing",
    label: "Обработка",
    index: "02",
    icon: SlidersHorizontal,
    description:
      "Здесь появятся обратимые преобразования: сглаживание, нормализация и коррекция базовой линии.",
  },
  {
    id: "peaks",
    href: "/peaks",
    label: "Пики",
    index: "03",
    icon: ChartNoAxesCombined,
    description:
      "Здесь появятся поиск, ручная проверка и редактирование обнаруженных пиков.",
  },
  {
    id: "identification",
    href: "/identification",
    label: "Идентификация",
    index: "04",
    icon: ScanSearch,
    description:
      "Здесь появятся кандидаты спектральных линий и объяснимые гипотезы состава.",
  },
  {
    id: "result",
    href: "/result",
    label: "Результат",
    index: "05",
    icon: FileCheck2,
    description:
      "Здесь появятся итоговое заключение, история решений и экспорт воспроизводимого отчёта.",
  },
] as const satisfies readonly {
  id: string;
  href: string;
  label: string;
  index: string;
  icon: LucideIcon;
  description: string;
}[];

export type WorkspaceSectionId = (typeof workspaceSections)[number]["id"];

export function getWorkspaceSection(id: WorkspaceSectionId) {
  const section = workspaceSections.find((item) => item.id === id);
  if (!section) throw new Error(`Неизвестный раздел: ${id}`);
  return section;
}
