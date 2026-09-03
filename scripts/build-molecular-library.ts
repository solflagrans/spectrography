import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface SourceRow {
  systemId: string;
  regionId: string;
  sourceLineId: number;
  wavelength: number;
  einsteinA: number;
  upperVibrationalEnergy: number;
  upperRotationalEnergy: number;
  upperJ: number;
  upperV: number;
  lowerV: number;
  branch: string;
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(repositoryRoot, "data/molecular-spectra/moose-nitrogen-systems.tsv");
const manifestPath = resolve(repositoryRoot, "data/molecular-spectra/source-manifest.json");
const outputPath = resolve(repositoryRoot, "src/domain/molecular-spectrum/generated/moose-nitrogen-systems.json");
const summaryOutputPath = resolve(repositoryRoot, "src/domain/molecular-spectrum/generated/moose-nitrogen-systems-summary.json");
const check = process.argv.includes("--check");
const sourceText = readFileSync(sourcePath, "utf8");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
const sourceSha256 = createHash("sha256").update(sourceText).digest("hex");
if (manifest.filteredSourceSha256 !== sourceSha256) {
  throw new Error("Контрольная сумма ограниченной выгрузки молекулярных переходов не совпала с манифестом.");
}

const rows = sourceText.trim().split(/\r?\n/u).slice(1).map(parseRow);
const definitions = [
  {
    id: "n2-second-positive",
    molecule: "N2",
    formula: "N₂",
    charge: 0,
    displayName: "Молекулярный азот",
    systemName: "Вторая положительная система",
    transition: "C³Πᵤ → B³Πg",
    regions: [
      ["n2-sps-315", "Полоса около 315,9 нм", 313.5, 318.5, true],
      ["n2-sps-337", "Полоса около 337,1 нм", 334.5, 341, true],
      ["n2-sps-358", "Полоса около 357,7 нм", 354.5, 361, true],
      ["n2-sps-380", "Полоса около 380,5 нм", 377, 384, false],
    ],
  },
  {
    id: "n2plus-first-negative",
    molecule: "N2",
    formula: "N₂⁺",
    charge: 1,
    displayName: "Ионизированный молекулярный азот",
    systemName: "Первая отрицательная система",
    transition: "B²Σᵤ⁺ → X²Σg⁺",
    regions: [
      ["n2plus-fns-391", "Полоса около 391,4 нм", 387.5, 395, true],
      ["n2plus-fns-428", "Полоса около 427,8 нм", 424, 431, true],
      ["n2plus-fns-471", "Полоса около 470,9 нм", 466, 474, false],
    ],
  },
] as const;

const generated = {
  schemaVersion: 1,
  source: manifest,
  preparation: {
    wavelengthMedium: "air",
    maximumRotationalQuantumNumber: 100,
    rotationalTemperatureGridKelvin: [500, 1_000, 2_000, 4_000],
    profile: "A × (2J + 1) × exp(-E_v/kT_vib - E_J/kT_rot); each characteristic region is normalized independently",
    note: "Temperature variants model band shape only; fitted values are not reported as plasma temperature or concentration.",
  },
  systems: definitions.map((definition) => ({
    id: definition.id,
    molecule: definition.molecule,
    formula: definition.formula,
    charge: definition.charge,
    displayName: definition.displayName,
    systemName: definition.systemName,
    transition: definition.transition,
    wavelengthRange: {
      minimum: Math.min(...definition.regions.map((region) => region[2])),
      maximum: Math.max(...definition.regions.map((region) => region[3])),
    },
    characteristicRegions: definition.regions.map(([id, label, minimum, maximum, key]) => ({
      id,
      label,
      minimum,
      maximum,
      key,
      transitions: rows.filter((row) => row.systemId === definition.id && row.regionId === id).map((row) => [
        row.sourceLineId,
        row.wavelength,
        row.einsteinA,
        row.upperVibrationalEnergy,
        row.upperRotationalEnergy,
        row.upperJ,
        row.upperV,
        row.lowerV,
        row.branch,
      ]),
    })),
  })),
};
const serialized = `${JSON.stringify(generated)}\n`;
const serializedSummary = `${JSON.stringify(generated.systems.map((system) => ({
  id: system.id,
  formula: system.formula,
  displayName: system.displayName,
  transition: system.transition,
  wavelengthRange: system.wavelengthRange,
  characteristicRegionCount: system.characteristicRegions.length,
})))}\n`;
if (check) {
  if (readFileSync(outputPath, "utf8") !== serialized || readFileSync(summaryOutputPath, "utf8") !== serializedSummary) {
    throw new Error("Сгенерированная молекулярная библиотека устарела.");
  }
} else {
  writeFileSync(outputPath, serialized);
  writeFileSync(summaryOutputPath, serializedSummary);
}

function parseRow(line: string): SourceRow {
  const values = line.split("\t");
  if (values.length !== 11) throw new Error(`Некорректная строка молекулярной выгрузки: ${line}`);
  const numbers = values.slice(2, 10).map(Number);
  if (numbers.some((value) => !Number.isFinite(value))) throw new Error(`Некорректное числовое значение: ${line}`);
  return {
    systemId: values[0],
    regionId: values[1],
    sourceLineId: numbers[0],
    wavelength: numbers[1],
    einsteinA: numbers[2],
    upperVibrationalEnergy: numbers[3],
    upperRotationalEnergy: numbers[4],
    upperJ: numbers[5],
    upperV: numbers[6],
    lowerV: numbers[7],
    branch: values[10],
  };
}
