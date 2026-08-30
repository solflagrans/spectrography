import type { WavelengthMedium } from "@/domain/spectral-library/types";

export interface ParsedNistAsdLine {
  readonly elementSymbol: string;
  readonly ionizationStage: string;
  readonly observedWavelength: string;
  readonly observedUncertainty: string;
  readonly observedMedium: WavelengthMedium;
  readonly ritzWavelength: string;
  readonly ritzUncertainty: string;
  readonly ritzMedium: WavelengthMedium;
  readonly relativeIntensity: string;
  readonly transitionProbability: string;
  readonly transitionProbabilityAccuracy: string;
  readonly lowerEnergy: string;
  readonly upperEnergy: string;
  readonly lowerConfiguration: string;
  readonly upperConfiguration: string;
  readonly lowerTerm: string;
  readonly upperTerm: string;
  readonly lowerJ: string;
  readonly upperJ: string;
  readonly lowerStatisticalWeight: string;
  readonly upperStatisticalWeight: string;
  readonly transitionType: string;
  readonly transitionProbabilityReference: string;
  readonly lineReference: string;
  readonly sourceRow: number;
}

export function parseNistAsdExport(input: string): readonly ParsedNistAsdLine[] {
  const table = parseTabDelimited(input.replace(/^\uFEFF/, ""));
  if (table.length < 2) throw new Error("Выгрузка NIST ASD не содержит строк данных.");

  const headers = table[0].map((value) => value.trim());
  const index = new Map(headers.map((header, column) => [header, column] as const));
  const observed = findWavelengthColumn(headers, "obs_wl");
  const ritz = findWavelengthColumn(headers, "ritz_wl");
  requireColumns(index, ["element", "sp_num", "intens"]);

  return table.slice(1).flatMap((row, offset): readonly ParsedNistAsdLine[] => {
    if (row.every((value) => !value.trim())) return [];
    const sourceRow = offset + 2;
    const value = (column: string) => getCell(row, index.get(column), column, sourceRow);
    const optionalValue = (column: string) => {
      const columnIndex = index.get(column);
      return columnIndex === undefined ? "" : getCell(row, columnIndex, column, sourceRow);
    };

    return [{
      elementSymbol: value("element"),
      ionizationStage: value("sp_num"),
      observedWavelength: getCell(row, observed.index, observed.header, sourceRow),
      observedUncertainty: optionalValue("unc_obs_wl"),
      observedMedium: observed.medium,
      ritzWavelength: getCell(row, ritz.index, ritz.header, sourceRow),
      ritzUncertainty: optionalValue("unc_ritz_wl"),
      ritzMedium: ritz.medium,
      relativeIntensity: value("intens"),
      transitionProbability: optionalValue("Aki(s^-1)"),
      transitionProbabilityAccuracy: optionalValue("Acc"),
      lowerEnergy: optionalValue("Ei(eV)"),
      upperEnergy: optionalValue("Ek(eV)"),
      lowerConfiguration: optionalValue("conf_i"),
      upperConfiguration: optionalValue("conf_k"),
      lowerTerm: optionalValue("term_i"),
      upperTerm: optionalValue("term_k"),
      lowerJ: optionalValue("J_i"),
      upperJ: optionalValue("J_k"),
      lowerStatisticalWeight: optionalValue("g_i"),
      upperStatisticalWeight: optionalValue("g_k"),
      transitionType: optionalValue("Type"),
      transitionProbabilityReference: optionalValue("tp_ref"),
      lineReference: optionalValue("line_ref"),
      sourceRow,
    }];
  });
}

function parseTabDelimited(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "\t" && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("Выгрузка NIST ASD обрывается внутри текстового значения.");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function findWavelengthColumn(
  headers: readonly string[],
  prefix: "obs_wl" | "ritz_wl",
): { readonly header: string; readonly index: number; readonly medium: WavelengthMedium } {
  const match = headers
    .map((header, index) => ({ header, index, match: header.match(new RegExp(`^${prefix}_(air|vac)\\(nm\\)$`)) }))
    .find((candidate) => candidate.match);
  if (!match?.match) throw new Error(`Выгрузка NIST ASD не содержит столбец ${prefix} в нанометрах с указанной средой.`);
  return { header: match.header, index: match.index, medium: match.match[1] === "air" ? "air" : "vacuum" };
}

function requireColumns(index: ReadonlyMap<string, number>, columns: readonly string[]): void {
  const missing = columns.filter((column) => !index.has(column));
  if (missing.length) throw new Error(`В выгрузке NIST ASD отсутствуют столбцы: ${missing.join(", ")}.`);
}

function getCell(row: readonly string[], index: number | undefined, header: string, sourceRow: number): string {
  if (index === undefined) throw new Error(`В выгрузке NIST ASD отсутствует столбец ${header}.`);
  if (index >= row.length) throw new Error(`Строка ${sourceRow} выгрузки NIST ASD не содержит столбец ${header}.`);
  return row[index].trim();
}
