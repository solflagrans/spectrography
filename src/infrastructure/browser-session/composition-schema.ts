import { z } from "zod";
import { COMPOSITION_PROFILE_VERSION } from "@/domain/spectrum/composition-settings";
export const compositionSettingsSchema = z.object({
  profileVersion: z.literal(COMPOSITION_PROFILE_VERSION),
  mode: z.enum(["strict", "standard", "sensitive", "custom"]),
  elementMode: z.enum(["all", "exclude", "only"]),
  elements: z.array(z.string().regex(/^[A-Z][a-z]?$/)).max(118).refine((items) => new Set(items).size === items.length),
  minimumGroups: z.number().int().min(3).max(10),
  minimumQuality: z.number().min(0.4).max(0.75),
  minimumStrongGroups: z.number().int().min(0).max(5),
  minimumMolecularRegions: z.number().int().min(2).max(5),
  minimumMolecularQuality: z.number().min(0.36).max(0.75),
});
