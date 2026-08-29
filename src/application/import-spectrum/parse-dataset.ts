import { z } from "zod";

import { validateDataset } from "@/domain/spectrum";
import type { SpectrumDataset } from "@/domain/spectrum";

import { parseAvaSoftRaw8 } from "./parse-avasoft-raw8";
import type { Raw8AuxiliaryData, Raw8InstrumentMetadata } from "./parse-avasoft-raw8";

export type ImportedSpectrumFormat = "JSON" | "XLSX" | "RAW8";

export interface SpectrumFilePayload {
  readonly fileName: string;
  readonly data: ArrayBuffer;
}

export interface ParsedSpectrumFile {
  readonly dataset: SpectrumDataset;
  readonly fileName: string;
  readonly format: ImportedSpectrumFormat;
  readonly auxiliaryData?: Raw8AuxiliaryData;
  readonly instrumentMetadata?: Raw8InstrumentMetadata;
}

const finiteNumberSchema = z.number().refine(Number.isFinite, "требуется конечное число");
const valueArraySchema = z.array(finiteNumberSchema);
const objectPayloadSchema = z.strictObject({
  wavelengths: valueArraySchema,
  intensities: valueArraySchema,
});
const tuplePayloadSchema = z.tuple([valueArraySchema, valueArraySchema]);

export async function parseSpectrumFile(
  payload: SpectrumFilePayload,
): Promise<ParsedSpectrumFile> {
  const format = getSpectrumFileFormat(payload.fileName);
  let dataset: SpectrumDataset;

  if (format === "JSON") {
    try {
      dataset = parseJsonSpectrum(new TextDecoder("utf-8", { fatal: true }).decode(payload.data));
    } catch (error) {
      if (error instanceof TypeError) throw new Error("JSON: файл должен быть сохранён в кодировке UTF-8.");
      throw error;
    }
  } else if (format === "XLSX") {
    dataset = await parseXlsxSpectrum(payload.data);
  } else {
    const parsed = parseAvaSoftRaw8(payload.data);
    return {
      dataset: parsed.dataset,
      fileName: payload.fileName,
      format,
      auxiliaryData: parsed.auxiliaryData,
      instrumentMetadata: parsed.metadata,
    };
  }

  return { dataset, fileName: payload.fileName, format };
}

export function getSpectrumFileFormat(fileName: string): ImportedSpectrumFormat {
  const extension = fileName.trim().split(".").at(-1)?.toLowerCase();
  if (extension === "json") return "JSON";
  if (extension === "xlsx") return "XLSX";
  if (extension === "raw8") return "RAW8";
  if (extension === "raw8x") {
    throw new Error("RAW8x с несколькими каналами пока не поддерживается. Выберите одноканальный RAW8.");
  }
  if (["rwd8", "abs8", "trm8", "rfl8", "irr8", "rir8", "str8"].includes(extension ?? "")) {
    throw new Error(`Формат ${extension?.toUpperCase()} пока не поддерживается. Выберите Scope-файл RAW8.`);
  }
  throw new Error("Поддерживаются только файлы JSON, XLSX и RAW8.");
}

export function parseJsonSpectrum(text: string): SpectrumDataset {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw enrichJsonSyntaxError(text, error);
  }

  let dataset: SpectrumDataset;
  if (Array.isArray(parsed)) {
    const result = tuplePayloadSchema.safeParse(parsed);
    if (!result.success) throwJsonValidationError(result.error);
    dataset = { wavelengths: result.data[0], intensities: result.data[1] };
  } else if (parsed && typeof parsed === "object") {
    const result = objectPayloadSchema.safeParse(parsed);
    if (!result.success) throwJsonValidationError(result.error);
    dataset = result.data;
  } else {
    throw new Error("JSON должен быть объектом { wavelengths, intensities } или массивом [[], []].");
  }

  validateImportedDataset(dataset, "JSON");
  return copyDataset(dataset);
}

export async function parseXlsxSpectrum(data: ArrayBuffer): Promise<SpectrumDataset> {
  const { read, utils } = await import("xlsx");
  let workbook: ReturnType<typeof read>;

  try {
    workbook = read(data, { type: "array", dense: true });
  } catch {
    throw new Error("Не удалось прочитать XLSX-файл. Проверьте, что файл не повреждён.");
  }

  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
  if (!firstSheet) throw new Error("XLSX: в книге нет доступных листов.");

  const rows = utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
    range: 0,
  });
  const firstDataRow = rows.slice(0, 7).findIndex((row) => (
    isFiniteNumber(row[0]) && isFiniteNumber(row[1])
  ));

  if (firstDataRow === -1) {
    throw new Error("XLSX: в первых семи строках не найдена строка с числами в колонках A и B.");
  }

  let lastContentRow = rows.length - 1;
  while (lastContentRow >= firstDataRow && isBlankRow(rows[lastContentRow])) {
    lastContentRow -= 1;
  }

  const wavelengths: number[] = [];
  const intensities: number[] = [];

  for (let index = firstDataRow; index <= lastContentRow; index += 1) {
    const row = rows[index];
    wavelengths.push(readNumericCell(row[0], index + 1, "A", "длина волны"));
    intensities.push(readNumericCell(row[1], index + 1, "B", "интенсивность"));
  }

  const dataset = { wavelengths, intensities };
  validateImportedDataset(dataset, "XLSX");
  return dataset;
}

function validateImportedDataset(dataset: SpectrumDataset, format: ImportedSpectrumFormat): void {
  try {
    validateDataset(dataset);
  } catch (error) {
    const message = error instanceof Error ? error.message : "набор данных не прошёл проверку";
    throw new Error(`${format}: ${message}`);
  }
}

function readNumericCell(value: unknown, row: number, column: "A" | "B", label: string): number {
  if (!isFiniteNumber(value)) {
    const displayed = isBlankCell(value) ? "пустая ячейка" : `значение «${String(value)}»`;
    throw new Error(`XLSX: строка ${row}, колонка ${column} (${label}): ${displayed} не является конечным числом.`);
  }
  return value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBlankCell(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && !value.trim());
}

function isBlankRow(row: readonly unknown[]): boolean {
  return row.every(isBlankCell);
}

function copyDataset(dataset: SpectrumDataset): SpectrumDataset {
  return {
    wavelengths: [...dataset.wavelengths],
    intensities: [...dataset.intensities],
  };
}

function formatZodPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((result, part) => (
    typeof part === "number" ? `${result}[${part}]` : result ? `${result}.${String(part)}` : String(part)
  ), "");
}

function throwJsonValidationError(error: z.ZodError): never {
  const issue = error.issues[0];
  const location = issue.path.length ? `, поле ${formatZodPath(issue.path)}` : "";
  throw new Error(`JSON: некорректные данные${location}: ${formatJsonIssue(issue)}.`);
}

function formatJsonIssue(issue: z.core.$ZodIssue): string {
  if (issue.code === "invalid_type") {
    return typeof issue.path.at(-1) === "number"
      ? "ожидается конечное число"
      : "ожидается массив конечных чисел";
  }
  if (issue.code === "unrecognized_keys") return "дополнительные поля не поддерживаются";
  if (issue.code === "custom") return issue.message;
  return "структура не соответствует поддерживаемому формату";
}

function enrichJsonSyntaxError(text: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : "некорректный JSON";
  const positionMatch = message.match(/position (\d+)/i);
  if (!positionMatch) return new Error(`JSON: ${message}`);

  const position = Number(positionMatch[1]);
  const before = text.slice(0, position);
  const line = before.split("\n").length;
  const column = before.length - before.lastIndexOf("\n");
  return new Error(`JSON: синтаксическая ошибка, строка ${line}, колонка ${column}.`);
}
