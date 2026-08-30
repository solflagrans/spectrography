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
      if (error instanceof TypeError) {
        throw new Error("Не удалось прочитать JSON-файл. Сохраните его в кодировке UTF-8 и попробуйте снова.");
      }
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
    throw new Error("Этот RAW8x-файл содержит несколько каналов. Сейчас можно открыть только одноканальный файл RAW8.");
  }
  if (["rwd8", "abs8", "trm8", "rfl8", "irr8", "rir8", "str8"].includes(extension ?? "")) {
    throw new Error(`Файлы ${extension?.toUpperCase()} пока нельзя открыть. Экспортируйте измерение Scope в формате RAW8.`);
  }
  const displayedExtension = extension ? `.${extension.toUpperCase()}` : "без расширения";
  throw new Error(`Файл ${displayedExtension} открыть нельзя. Выберите файл JSON, XLSX или RAW8.`);
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
    throw new Error("В JSON не найдены данные спектра. Используйте поля «wavelengths» и «intensities» или два массива: сначала длины волн, затем интенсивности.");
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
    throw new Error("Не удалось открыть XLSX-файл. Проверьте, что он не повреждён и сохранён в формате .xlsx.");
  }

  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
  if (!firstSheet) throw new Error("В XLSX-файле нет листа с данными. Добавьте лист со спектром и попробуйте снова.");

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
    throw new Error("Не удалось найти начало данных на первом листе. В одной из первых семи строк укажите длину волны в колонке A и интенсивность в колонке B.");
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
    const message = error instanceof Error
      ? error.message
      : "Проверьте содержимое файла и попробуйте снова.";
    throw new Error(`Не удалось использовать данные из ${format}. ${message}`);
  }
}

function readNumericCell(value: unknown, row: number, column: "A" | "B", label: string): number {
  if (!isFiniteNumber(value)) {
    if (isBlankCell(value)) {
      throw new Error(`В строке ${row} ячейка ${column} (${label}) пуста. Заполните пропуск числом или удалите строку, если она находится после данных.`);
    }
    throw new Error(`В строке ${row} ячейка ${column} (${label}) содержит «${String(value)}». Замените значение конечным числом.`);
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
    typeof part === "number"
      ? `${result}, значение ${part + 1}`
      : result
        ? `${result}.${String(part)}`
        : part === "wavelengths"
          ? "длины волн"
          : part === "intensities"
            ? "интенсивности"
            : String(part)
  ), "");
}

function throwJsonValidationError(error: z.ZodError): never {
  const issue = error.issues[0];
  const location = issue.path.length ? ` в поле «${formatZodPath(issue.path)}»` : "";
  throw new Error(`В JSON обнаружено некорректное значение${location}: ${formatJsonIssue(issue)}.`);
}

function formatJsonIssue(issue: z.core.$ZodIssue): string {
  if (issue.code === "invalid_type") {
    return typeof issue.path.at(-1) === "number"
      ? "укажите конечное число"
      : "укажите массив чисел";
  }
  if (issue.code === "unrecognized_keys") return "удалите неподдерживаемые дополнительные поля";
  if (issue.code === "custom") return issue.message;
  return "структура не соответствует поддерживаемому формату";
}

function enrichJsonSyntaxError(text: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  const positionMatch = message.match(/position (\d+)/i);
  if (!positionMatch) {
    return new Error("В JSON есть синтаксическая ошибка. Проверьте запятые, кавычки и скобки.");
  }

  const position = Number(positionMatch[1]);
  const before = text.slice(0, position);
  const line = before.split("\n").length;
  const column = before.length - before.lastIndexOf("\n");
  return new Error(`В JSON есть синтаксическая ошибка: строка ${line}, колонка ${column}. Проверьте запятые, кавычки и скобки.`);
}
