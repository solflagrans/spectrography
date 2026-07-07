import { parseFiniteNumber } from "../core/validation.js";

export function parseManualColumns(wavelengthText, intensityText) {
  const wavelengthLines = splitManualColumn(wavelengthText);
  const intensityLines = splitManualColumn(intensityText);

  if (!wavelengthLines.length || !intensityLines.length) {
    return { wavelengths: [], intensities: [] };
  }

  const maxRows = Math.max(wavelengthLines.length, intensityLines.length);
  const wavelengths = [];
  const intensities = [];

  for (let index = 0; index < maxRows; index += 1) {
    const row = index + 1;
    if (wavelengthLines[index] === undefined) {
      throw new Error(`Массивы: строка ${row}, колонка 1 (длина волны) отсутствует.`);
    }
    if (intensityLines[index] === undefined) {
      throw new Error(`Массивы: строка ${row}, колонка 2 (интенсивность) отсутствует.`);
    }
    wavelengths.push(parseFiniteNumber(wavelengthLines[index], `Массивы: строка ${row}, колонка 1 (длина волны)`));
    intensities.push(parseFiniteNumber(intensityLines[index], `Массивы: строка ${row}, колонка 2 (интенсивность)`));
  }

  return { wavelengths, intensities };
}

export function parseJsonPayload(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw enrichJsonSyntaxError(text, error);
  }
  if (Array.isArray(parsed) && Array.isArray(parsed[0]) && Array.isArray(parsed[1])) {
    return {
      wavelengths: parsed[0].map((value, index) => parseFiniteNumber(value, `JSON: wavelengths[${index}]`)),
      intensities: parsed[1].map((value, index) => parseFiniteNumber(value, `JSON: intensities[${index}]`)),
    };
  }
  if (Array.isArray(parsed?.wavelengths) && Array.isArray(parsed?.intensities)) {
    return {
      wavelengths: parsed.wavelengths.map((value, index) => parseFiniteNumber(value, `JSON: wavelengths[${index}]`)),
      intensities: parsed.intensities.map((value, index) => parseFiniteNumber(value, `JSON: intensities[${index}]`)),
    };
  }
  throw new Error("JSON должен быть объектом { wavelengths, intensities } или массивом [[], []].");
}

function splitManualColumn(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function enrichJsonSyntaxError(text, error = null) {
  const message = error?.message || "некорректный JSON";
  const positionMatch = message.match(/position (\d+)/i);
  if (!positionMatch) return new Error(`JSON: ${message}`);
  const position = Number(positionMatch[1]);
  const before = text.slice(0, position);
  const line = before.split("\n").length;
  const column = before.length - before.lastIndexOf("\n");
  return new Error(`JSON: синтаксическая ошибка, строка ${line}, колонка ${column}.`);
}
