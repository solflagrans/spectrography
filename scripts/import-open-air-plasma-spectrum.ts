import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://zenodo.org/records/14843545/files/Fig_2_total.dat?download=1";
const SOURCE_SHA256 = "3f828cbeccc2069778f4d43717fe4aa0add7f62d946438464a1a7242b1b1ecf3";
const OUTPUT_SHA256 = "cb5b2c5af4fc2a1b1d974202a1f380daca47c4d03df245e61e24d7a5f030f767";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(repositoryRoot, "data/experimental-spectra/zenodo-14843545-fig2-total-300-400nm.tsv");
const check = process.argv.includes("--check");
const localPath = process.argv.find((argument) => !argument.startsWith("--") && argument !== process.argv[0] && argument !== process.argv[1]);

if (check && !localPath) {
  const current = await readFile(outputPath);
  const currentChecksum = createHash("sha256").update(current).digest("hex");
  if (currentChecksum !== OUTPUT_SHA256) throw new Error("Контрольная сумма локальной экспериментальной выборки не совпала.");
  process.stdout.write(`${JSON.stringify({ rows: current.toString("utf8").trim().split(/\r?\n/u).length - 1, outputSha256: currentChecksum })}\n`);
  process.exit(0);
}

const source = localPath
  ? await readFile(resolve(localPath))
  : Buffer.from(await (await fetch(SOURCE_URL)).arrayBuffer());
const checksum = createHash("sha256").update(source).digest("hex");
if (checksum !== SOURCE_SHA256) throw new Error("Контрольная сумма исходного экспериментального спектра Zenodo не совпала.");

const rows = source.toString("utf8").trim().split(/\r?\n/u).map((line) => line.trim().split(/\s+/u));
const selected = rows.filter(([wavelength]) => Number(wavelength) >= 300 && Number(wavelength) <= 400)
  .filter((_, index) => index % 2 === 0);
const output = `wavelength_nm\tintensity_arb\n${selected.map(([wavelength, intensity]) => `${wavelength}\t${intensity}`).join("\n")}\n`;

if (check) {
  const current = await readFile(outputPath, "utf8");
  if (current !== output) throw new Error("Локальная экспериментальная выборка отличается от воспроизводимого результата.");
} else {
  await writeFile(outputPath, output);
}

process.stdout.write(`${JSON.stringify({ sourceSha256: checksum, rows: selected.length, outputSha256: createHash("sha256").update(output).digest("hex") })}\n`);
