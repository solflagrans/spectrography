import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const pdsSpectra = [
  {
    source: "nasa-pds-h92649-iron-rich.csv",
    output: "nasa-pds-h92649-iron-rich.json",
  },
  {
    source: "nasa-pds-dh4911-magnesium-rich.csv",
    output: "nasa-pds-dh4911-magnesium-rich.json",
  },
  {
    source: "nasa-pds-muscoc17-aluminium-rich.csv",
    output: "nasa-pds-muscoc17-aluminium-rich.json",
  },
  {
    source: "nasa-pds-gbw07216a-calcium-rich.csv",
    output: "nasa-pds-gbw07216a-calcium-rich.json",
  },
];

for (const item of pdsSpectra) {
  const source = await readFile(resolve(root, "originals", item.source), "utf8");
  const rows = source.trim().split(/\r?\n/u);
  const headerIndex = rows.findIndex((row) => row.startsWith("wave,"));
  if (headerIndex === -1) throw new Error(`${item.source}: заголовок wave не найден`);

  const columns = rows[headerIndex].split(",");
  const intensityIndexes = columns
    .map((column, index) => column.startsWith("i") ? index : -1)
    .filter((index) => index >= 0);
  if (intensityIndexes.length === 0) throw new Error(`${item.source}: колонки интенсивности не найдены`);

  const wavelengths = [];
  const intensities = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const values = row.split(",").map(Number);
    if (!values.every(Number.isFinite)) throw new Error(`${item.source}: обнаружено некорректное число`);
    wavelengths.push(values[0]);
    intensities.push(intensityIndexes.reduce((sum, index) => sum + values[index], 0) / intensityIndexes.length);
  }

  await writeSpectrum(item.output, wavelengths, intensities);
}

const airSource = await readFile(
  resolve(root, "originals", "zenodo-14843545-air-plasma-Fig_2_total.dat"),
  "utf8",
);
const selectedAirRows = airSource
  .trim()
  .split(/\r?\n/u)
  .map((row) => row.trim().split(/\s+/u).map(Number))
  .filter(([wavelength, intensity]) => (
    Number.isFinite(wavelength)
    && Number.isFinite(intensity)
    && wavelength >= 300
    && wavelength <= 400
  ))
  .filter((_, index) => index % 2 === 0);

await writeSpectrum(
  "zenodo-14843545-air-plasma-300-400nm.json",
  selectedAirRows.map(([wavelength]) => wavelength),
  selectedAirRows.map(([, intensity]) => intensity),
);

async function writeSpectrum(fileName, wavelengths, intensities) {
  if (wavelengths.length !== intensities.length || wavelengths.length === 0) {
    throw new Error(`${fileName}: длины массивов не совпадают или массивы пусты`);
  }
  if (wavelengths.length > 10_000) throw new Error(`${fileName}: превышен предел приложения в 10 000 точек`);

  const output = `${JSON.stringify({ wavelengths, intensities })}\n`;
  await writeFile(resolve(root, "app-ready", fileName), output, "utf8");
  process.stdout.write(`${fileName}: ${wavelengths.length} точек\n`);
}
