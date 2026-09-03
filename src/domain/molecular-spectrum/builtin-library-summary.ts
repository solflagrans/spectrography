import generatedSummary from "./generated/moose-nitrogen-systems-summary.json";

export interface MolecularSystemSummary {
  readonly id: string;
  readonly formula: "N₂" | "N₂⁺";
  readonly displayName: string;
  readonly transition: string;
  readonly wavelengthRange: { readonly minimum: number; readonly maximum: number };
  readonly characteristicRegionCount: number;
}

/** Small client-safe projection; transition profiles stay in the analysis worker chunk. */
export const builtinMolecularSystemSummaries = generatedSummary as readonly MolecularSystemSummary[];
