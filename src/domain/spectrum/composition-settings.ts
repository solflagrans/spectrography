
export const COMPOSITION_PROFILE_VERSION = "composition-v1";
export interface CompositionSettings {
  readonly profileVersion: "composition-v1";
  readonly mode: "strict" | "standard" | "sensitive" | "custom";
  readonly elementMode: "all" | "exclude" | "only";
  readonly elements: readonly string[];
  readonly minimumGroups: number;
  readonly minimumQuality: number;
  readonly minimumStrongGroups: number;
  readonly minimumMolecularRegions: number;
  readonly minimumMolecularQuality: number;
}
export type CompositionMode = CompositionSettings["mode"];
export const COMPOSITION_PRESETS = {
  strict: { minimumGroups: 4, minimumQuality: 0.58, minimumStrongGroups: 2, minimumMolecularRegions: 3, minimumMolecularQuality: 0.52 },
  standard: { minimumGroups: 3, minimumQuality: 0.5, minimumStrongGroups: 0, minimumMolecularRegions: 2, minimumMolecularQuality: 0.42 },
  sensitive: { minimumGroups: 3, minimumQuality: 0.4, minimumStrongGroups: 0, minimumMolecularRegions: 2, minimumMolecularQuality: 0.36 },
} as const;
export const DEFAULT_COMPOSITION_SETTINGS: CompositionSettings = {
  profileVersion: COMPOSITION_PROFILE_VERSION, mode: "standard", elementMode: "all", elements: [], ...COMPOSITION_PRESETS.standard,
};
export const COMPOSITION_MODE_LABELS: Record<CompositionMode, string> = { strict: "Строгий", standard: "Стандартный", sensitive: "Чувствительный", custom: "Пользовательский" };
export function resolveCompositionSettings(settings?: CompositionSettings): CompositionSettings {
  const parsed = settings ?? DEFAULT_COMPOSITION_SETTINGS;
  const inRange = (value: number, minimum: number, maximum: number, integer = false) => Number.isFinite(value) && value >= minimum && value <= maximum && (!integer || Number.isInteger(value));
  if (parsed.profileVersion !== COMPOSITION_PROFILE_VERSION
    || !["strict", "standard", "sensitive", "custom"].includes(parsed.mode)
    || !["all", "exclude", "only"].includes(parsed.elementMode)
    || !Array.isArray(parsed.elements) || parsed.elements.length > 118
    || parsed.elements.some((symbol) => typeof symbol !== "string" || !/^[A-Z][a-z]?$/.test(symbol))
    || new Set(parsed.elements).size !== parsed.elements.length
    || !inRange(parsed.minimumGroups, 3, 10, true)
    || !inRange(parsed.minimumStrongGroups, 0, 5, true)
    || !inRange(parsed.minimumQuality, 0.4, 0.75)
    || !inRange(parsed.minimumMolecularRegions, 2, 5, true)
    || !inRange(parsed.minimumMolecularQuality, 0.36, 0.75)) throw new Error("Некорректные настройки определения состава.");
  return parsed.mode === "custom" ? parsed : { ...parsed, ...COMPOSITION_PRESETS[parsed.mode] };
}
export function isElementEnabled(symbol: string, settings: CompositionSettings): boolean {
  return settings.elementMode === "all" || (settings.elementMode === "only" ? settings.elements.includes(symbol) : !settings.elements.includes(symbol));
}
export function describeCompositionSettings(settings?: CompositionSettings): string {
  const value = resolveCompositionSettings(settings);
  return `${COMPOSITION_MODE_LABELS[value.mode]} · ${value.elementMode === "all" ? "Все элементы" : value.elementMode === "only" ? `Только: ${value.elements.join(", ") || "ни одного элемента"}` : `Исключены: ${value.elements.join(", ") || "нет"}`}`;
}
