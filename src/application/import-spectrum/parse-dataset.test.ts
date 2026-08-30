import { utils, write } from "xlsx";
import { describe, expect, it } from "vitest";

import { MAX_POINTS } from "@/domain/spectrum";

import {
  getSpectrumFileFormat,
  parseJsonSpectrum,
  parseXlsxSpectrum,
} from "./parse-dataset";

describe("JSON spectrum import", () => {
  it("parses the object format without changing point order", () => {
    expect(parseJsonSpectrum('{"wavelengths":[530.92,420.52,480.21],"intensities":[0.624,0.882,0.941]}')).toEqual({
      wavelengths: [530.92, 420.52, 480.21],
      intensities: [0.624, 0.882, 0.941],
    });
  });

  it("parses the tuple format", () => {
    expect(parseJsonSpectrum('[[420.52,480.21,530.92],[0.882,0.941,0.624]]')).toEqual({
      wavelengths: [420.52, 480.21, 530.92],
      intensities: [0.882, 0.941, 0.624],
    });
  });

  it("reports malformed JSON and invalid external values", () => {
    expect(() => parseJsonSpectrum('{"wavelengths": [420,')).toThrow(/В JSON есть синтаксическая ошибка/);
    expect(() => parseJsonSpectrum('{"wavelengths":[420,480,530],"intensities":[1,"bad",3]}')).toThrow(
      /интенсивности, значение 2/,
    );
  });

  it("rejects mismatched arrays, duplicate wavelengths, too few and too many points", () => {
    expect(() => parseJsonSpectrum('[[420,480,530],[1,2]]')).toThrow(/одинаковой длины/);
    expect(() => parseJsonSpectrum('[[420,420,530],[1,2,3]]')).toThrow(/повторяется/);
    expect(() => parseJsonSpectrum('[[420,480],[1,2]]')).toThrow(/минимум 3/);

    const values = Array.from({ length: MAX_POINTS + 1 }, (_, index) => index);
    expect(() => parseJsonSpectrum(JSON.stringify([values, values]))).toThrow(/Максимум/);
  });

  it("rejects unsupported file extensions", () => {
    expect(getSpectrumFileFormat("spectrum.Raw8")).toBe("RAW8");
    expect(() => getSpectrumFileFormat("spectrum.csv")).toThrow(/Выберите файл JSON, XLSX или RAW8/);
    expect(() => getSpectrumFileFormat("spectrum.RAW8x")).toThrow(/несколько каналов/);
    expect(() => getSpectrumFileFormat("spectrum.RWD8")).toThrow(/пока нельзя открыть/);
  });
});

describe("XLSX spectrum import", () => {
  it("uses the first sheet, finds data in the first seven rows and ignores trailing empty rows", async () => {
    const data = createWorkbook([
      ["Отчёт", "Спектр"],
      ["Длина волны", "Интенсивность", "Примечание"],
      [420.52, 0.882, "ignored"],
      [480.21, 0.941, "ignored"],
      [530.92, 0.624, "ignored"],
      [],
      [],
    ], [[1, 2], [3, 4]]);

    await expect(parseXlsxSpectrum(data)).resolves.toEqual({
      wavelengths: [420.52, 480.21, 530.92],
      intensities: [0.882, 0.941, 0.624],
    });
  });

  it("fails when the first numeric row is not within the first seven rows", async () => {
    const data = createWorkbook([
      ["1"], ["2"], ["3"], ["4"], ["5"], ["6"], ["7"], [420, 1], [480, 2], [530, 3],
    ]);

    await expect(parseXlsxSpectrum(data)).rejects.toThrow(/первых семи строк/);
  });

  it("reports an empty row inside the dataset with its row and column", async () => {
    const data = createWorkbook([[420, 1], [], [530, 3]]);
    await expect(parseXlsxSpectrum(data)).rejects.toThrow(/строке 2 ячейка A/);
  });

  it("reports an invalid cell after data starts with its row and column", async () => {
    const data = createWorkbook([[420, 1], [480, "bad"], [530, 3]]);
    await expect(parseXlsxSpectrum(data)).rejects.toThrow(/строке 2 ячейка B/);
  });

  it("rejects duplicate wavelengths", async () => {
    const data = createWorkbook([[420, 1], [420, 2], [530, 3]]);
    await expect(parseXlsxSpectrum(data)).rejects.toThrow(/повторяется/);
  });
});

function createWorkbook(firstSheetRows: unknown[][], secondSheetRows?: unknown[][]): ArrayBuffer {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet(firstSheetRows), "Спектр");
  if (secondSheetRows) {
    utils.book_append_sheet(workbook, utils.aoa_to_sheet(secondSheetRows), "Игнорировать");
  }
  return write(workbook, { type: "array", bookType: "xlsx" });
}
