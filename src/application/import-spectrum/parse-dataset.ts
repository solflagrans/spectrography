import { normalizeDataset, parseFiniteNumber } from "@/domain/spectrum";
import type { SpectrumDataset } from "@/domain/spectrum";

export function parseManualColumns(wavelengthText: string, intensityText: string): SpectrumDataset {
  const wavelengthLines = splitManualColumn(wavelengthText);
  const intensityLines = splitManualColumn(intensityText);
  const maximumRows = Math.max(wavelengthLines.length, intensityLines.length);
  const wavelengths: number[] = [];
  const intensities: number[] = [];

  for (let index = 0; index < maximumRows; index += 1) {
    const row = index + 1;
    if (wavelengthLines[index] === undefined) {
      throw new Error(`Массивы: строка ${row}, колонка 1 (длина волны) отсутствует.`);
    }
    if (intensityLines[index] === undefined) {
      throw new Error(`Массивы: строка ${row}, колонка 2 (интенсивность) отсутствует.`);
    }

    wavelengths.push(
      parseFiniteNumber(
        wavelengthLines[index],
        `Массивы: строка ${row}, колонка 1 (длина волны)`,
      ),
    );
    intensities.push(
      parseFiniteNumber(
        intensityLines[index],
        `Массивы: строка ${row}, колонка 2 (интенсивность)`,
      ),
    );
  }

  return normalizeDataset({ wavelengths, intensities });
}

export function parseJsonPayload(text: string): SpectrumDataset {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw enrichJsonSyntaxError(text, error);
  }

  if (isTuplePayload(parsed)) {
    return normalizeDataset({
      wavelengths: parsed[0].map((value, index) => parseFiniteNumber(value, `JSON: wavelengths[${index}]`)),
      intensities: parsed[1].map((value, index) => parseFiniteNumber(value, `JSON: intensities[${index}]`)),
    });
  }

  if (isObjectPayload(parsed)) {
    return normalizeDataset({
      wavelengths: parsed.wavelengths.map((value, index) =>
        parseFiniteNumber(value, `JSON: wavelengths[${index}]`),
      ),
      intensities: parsed.intensities.map((value, index) =>
        parseFiniteNumber(value, `JSON: intensities[${index}]`),
      ),
    });
  }

  throw new Error("JSON должен быть объектом { wavelengths, intensities } или массивом [[], []].");
}

function splitManualColumn(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isTuplePayload(value: unknown): value is [unknown[], unknown[]] {
  return Array.isArray(value) && Array.isArray(value[0]) && Array.isArray(value[1]);
}

function isObjectPayload(
  value: unknown,
): value is { wavelengths: unknown[]; intensities: unknown[] } {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return Array.isArray(payload.wavelengths) && Array.isArray(payload.intensities);
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
