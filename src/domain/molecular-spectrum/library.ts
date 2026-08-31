import generated from "./generated/moose-nitrogen-systems.json";
import type {
  MolecularDataSource,
  MolecularReferencePreparation,
  MolecularSystemDefinition,
  MolecularTransition,
} from "./types";

type GeneratedTransition = readonly [number, number, number, number, number, number, number, number, string];

const source = generated.source as MolecularDataSource;
const preparation = generated.preparation as MolecularReferencePreparation;

export const BUILTIN_MOLECULAR_LIBRARY_VERSION = `${source.datasetVersion}; sha256:${source.filteredSourceSha256}`;

export const builtinMolecularSystems: readonly MolecularSystemDefinition[] = generated.systems.map((system) => ({
  id: system.id,
  molecule: system.molecule as "N2",
  formula: system.formula as "N₂" | "N₂⁺",
  charge: system.charge as 0 | 1,
  displayName: system.displayName,
  systemName: system.systemName,
  transition: system.transition,
  wavelengthRange: system.wavelengthRange,
  source,
  preparation,
  characteristicRegions: system.characteristicRegions.map((region) => ({
    id: region.id,
    label: region.label,
    minimumWavelengthNm: region.minimum,
    maximumWavelengthNm: region.maximum,
    key: region.key,
    transitions: (region.transitions as unknown as readonly GeneratedTransition[]).map(toTransition),
  })),
}));

function toTransition(value: GeneratedTransition): MolecularTransition {
  return {
    sourceLineId: value[0],
    wavelengthNm: value[1],
    einsteinAPerSecond: value[2],
    upperVibrationalEnergyCm: value[3],
    upperRotationalEnergyCm: value[4],
    upperJ: value[5],
    upperV: value[6],
    lowerV: value[7],
    branch: value[8],
  };
}
