import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Database,
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
      "Загрузка, сведения об измерении, тип спектра и краткая оценка качества.",
  },
  {
    id: "processing",
    href: "/processing",
    label: "Обработка",
    index: "02",
    icon: SlidersHorizontal,
    description:
      "Основные параметры подготовки и график автоматически обработанного спектра.",
  },
  {
    id: "analysis",
    href: "/analysis",
    label: "Анализ",
    index: "03",
    icon: ScanSearch,
    description:
      "Состав, пики и прослеживаемые доказательства идентификации.",
  },
  {
    id: "library",
    href: "/library",
    label: "Библиотека",
    index: "04",
    icon: BookOpen,
    description:
      "Самостоятельный справочный раздел по атомным линиям и молекулярным системам.",
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
