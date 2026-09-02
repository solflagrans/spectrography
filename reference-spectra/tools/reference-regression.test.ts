import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createWorkingAnalysis } from "@/application/analysis/create-working-analysis";
import { parseSpectrumFile } from "@/application/import-spectrum/parse-dataset";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("external reference spectra", () => {
  it("recovers iron without promoting the former Si alternative", async () => {
    const analysis = await analyze("nasa-pds-h92649-iron-rich.json");
    expect(analysis.hypotheses.map((item) => item.symbol)).toEqual(["Fe"]);
  }, 15_000);

  it("recovers Mg and Fe and does not promote Hg in the magnesium-rich sample", async () => {
    const symbols = (await analyze("nasa-pds-dh4911-magnesium-rich.json")).hypotheses.map((item) => item.symbol);
    expect(symbols).toEqual(expect.arrayContaining(["Mg", "Fe"]));
    expect(symbols).not.toContain("Hg");
  }, 15_000);

  it("recovers Al and Si and rejects the former He false positive", async () => {
    const symbols = (await analyze("nasa-pds-muscoc17-aluminium-rich.json")).hypotheses.map((item) => item.symbol);
    expect(symbols).toEqual(expect.arrayContaining(["Al", "Si"]));
    expect(symbols).not.toContain("He");
    expect(symbols).not.toContain("Hg");
  }, 15_000);

  it("keeps Ca as the leading supported element in the calcium-rich sample", async () => {
    const analysis = await analyze("nasa-pds-gbw07216a-calcium-rich.json");
    expect(analysis.hypotheses[0]?.symbol).toBe("Ca");
    expect(analysis.hypotheses.map((item) => item.symbol)).not.toContain("Ar");
  }, 15_000);

  it("keeps the air-plasma atomic result negative and independently accepts N2", async () => {
    const analysis = await analyze("zenodo-14843545-air-plasma-300-400nm.json");
    expect(analysis.hypotheses).toHaveLength(0);
    expect(analysis.molecularHypotheses.map((item) => item.formula)).toContain("N₂");
  }, 15_000);
});

async function analyze(fileName: string) {
  const bytes = await readFile(resolve(root, "app-ready", fileName));
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const parsed = await parseSpectrumFile({ fileName, data });
  return createWorkingAnalysis({
    id: fileName,
    title: fileName,
    source: { kind: "Пользовательский файл", fileName, format: "JSON", units: "нм / отн. ед." },
    rawDataset: parsed.dataset,
    spectrumType: "plasma-emission",
  });
}
