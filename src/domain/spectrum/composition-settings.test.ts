import { describe, expect, it } from "vitest";
import { DEFAULT_COMPOSITION_SETTINGS, resolveCompositionSettings, isElementEnabled } from "./composition-settings";

describe("composition settings", () => {
  it("normalizes legacy defaults and enforces the selected preset", () => {
    expect(resolveCompositionSettings()).toEqual(DEFAULT_COMPOSITION_SETTINGS);
    expect(resolveCompositionSettings({ ...DEFAULT_COMPOSITION_SETTINGS, mode: "strict" }).minimumGroups).toBe(4);
    expect(resolveCompositionSettings({ ...DEFAULT_COMPOSITION_SETTINGS, mode: "sensitive" }).minimumQuality).toBe(0.4);
  });
  it("rejects unsafe custom thresholds and invalid persisted values", () => {
    for (const patch of [{ minimumGroups: 2 }, { minimumQuality: NaN }, { minimumMolecularRegions: 1 }, { profileVersion: "unknown" }, { elements: ["Fe", "Fe"] }]) {
      expect(() => resolveCompositionSettings({ ...DEFAULT_COMPOSITION_SETTINGS, ...patch } as typeof DEFAULT_COMPOSITION_SETTINGS)).toThrow();
    }
  });
  it("treats an empty allowlist as no elements and an empty denylist as all", () => {
    expect(isElementEnabled("N", { ...DEFAULT_COMPOSITION_SETTINGS, elementMode: "only" })).toBe(false);
    expect(isElementEnabled("N", { ...DEFAULT_COMPOSITION_SETTINGS, elementMode: "exclude" })).toBe(true);
    expect(isElementEnabled("N", { ...DEFAULT_COMPOSITION_SETTINGS, elementMode: "exclude", elements: ["N"] })).toBe(false);
  });
});
