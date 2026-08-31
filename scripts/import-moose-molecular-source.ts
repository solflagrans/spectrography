import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface SourceDefinition {
  readonly database: string;
  readonly expectedSha256: string;
  readonly systemId: string;
  readonly maximumJ: number;
  readonly regions: readonly {
    readonly id: string;
    readonly minimum: number;
    readonly maximum: number;
  }[];
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = process.argv[2];
if (!sourceDirectory) {
  throw new Error("Укажите каталог src/Moose/data из проверенной копии репозитория Moose.");
}

const sources: readonly SourceDefinition[] = [
  {
    database: "N2CB.db",
    expectedSha256: "af63d35c45415bb4d1f931a13a434b917271dde2cdeed0e85f70f20af9b4ba9b",
    systemId: "n2-second-positive",
    maximumJ: 100,
    regions: [
      { id: "n2-sps-315", minimum: 313.5, maximum: 318.5 },
      { id: "n2-sps-337", minimum: 334.5, maximum: 341 },
      { id: "n2-sps-358", minimum: 354.5, maximum: 361 },
      { id: "n2-sps-380", minimum: 377, maximum: 384 },
    ],
  },
  {
    database: "N2PlusBX.db",
    expectedSha256: "74660ba7f919838620f45de2a72bb025feb5c812e77dafe9829e213899f50d80",
    systemId: "n2plus-first-negative",
    maximumJ: 100,
    regions: [
      { id: "n2plus-fns-391", minimum: 387.5, maximum: 395 },
      { id: "n2plus-fns-428", minimum: 424, maximum: 431 },
      { id: "n2plus-fns-471", minimum: 466, maximum: 474 },
    ],
  },
];

const rows = ["system_id\tregion_id\tsource_line_id\tair_wavelength_nm\teinstein_a_s-1\tupper_e_v_cm-1\tupper_e_j_cm-1\tupper_j\tupper_v\tlower_v\tbranch"];
for (const source of sources) {
  const databasePath = resolve(sourceDirectory, source.database);
  const checksum = createHash("sha256").update(readFileSync(databasePath)).digest("hex");
  if (checksum !== source.expectedSha256) {
    throw new Error(`${source.database}: контрольная сумма исходной базы не совпала.`);
  }
  for (const region of source.regions) {
    const sql = `SELECT '${source.systemId}', '${region.id}', lines.id, printf('%.12g', air_wavelength), printf('%.12g', A), printf('%.12g', upper_states.E_v), printf('%.12g', upper_states.E_J), printf('%.12g', upper_states.J), upper_states.v, lower_states.v, branch FROM lines INNER JOIN upper_states ON lines.upper_state=upper_states.id INNER JOIN lower_states ON lines.lower_state=lower_states.id WHERE upper_states.J <= ${source.maximumJ} AND air_wavelength BETWEEN ${region.minimum} AND ${region.maximum} ORDER BY air_wavelength, lines.id;`;
    const output = execFileSync("sqlite3", ["-separator", "\t", databasePath, sql], { encoding: "utf8" }).trim();
    if (output) rows.push(output);
  }
}

writeFileSync(resolve(repositoryRoot, "data/molecular-spectra/moose-nitrogen-systems.tsv"), `${rows.join("\n")}\n`);
