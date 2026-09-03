import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { builtinSpectralLibraryIndex } from "@/domain/spectral-library/builtin-library";
import { builtinMolecularSystems } from "@/domain/molecular-spectrum";
import { runInteractiveSpectrumAnalysis } from "@/domain/spectrum";

const fixtureUrl = new URL("../../../data/experimental-spectra/zenodo-14843545-fig2-total-300-400nm.tsv", import.meta.url);
const expectedSha256 = "cb5b2c5af4fc2a1b1d974202a1f380daca47c4d03df245e61e24d7a5f030f767";

export async function loadOpenExperimentalAirPlasmaAnalysis() {
  const text = await readFile(fixtureUrl, "utf8");
  const checksum = createHash("sha256").update(text).digest("hex");
  if (checksum !== expectedSha256) throw new Error("Контрольная сумма открытого экспериментального спектра не совпала.");
  const rows = text.trim().split(/\r?\n/u).slice(1).map((row) => row.split("\t").map(Number));
  return runInteractiveSpectrumAnalysis({
    wavelengths: rows.map(([wavelength]) => wavelength),
    intensities: rows.map(([, intensity]) => intensity),
  }, builtinSpectralLibraryIndex, undefined, "plasma-emission", builtinMolecularSystems);
}
