import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createWorkingAnalysis } from "@/application/analysis/create-working-analysis";
import { parseSpectrumFile } from "@/application/import-spectrum/parse-dataset";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fileNames = [
  "nasa-pds-h92649-iron-rich.json",
  "nasa-pds-dh4911-magnesium-rich.json",
  "nasa-pds-muscoc17-aluminium-rich.json",
  "nasa-pds-gbw07216a-calcium-rich.json",
  "zenodo-14843545-air-plasma-300-400nm.json",
];
const expectations = JSON.parse(await readFile(resolve(root, "expectations.json"), "utf8")) as {
  spectra: Record<string, { present: string[]; primaryChecks: string[]; molecularPresent?: string[] }>;
};

const report = [];
for (const fileName of fileNames) {
  const bytes = await readFile(resolve(root, "app-ready", fileName));
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const parsed = await parseSpectrumFile({ fileName, data });
  const analysis = createWorkingAnalysis({
    id: fileName.replace(/\.json$/u, ""),
    title: basename(fileName, ".json"),
    source: {
      kind: "Пользовательский файл",
      fileName,
      format: "JSON",
      units: "нм / отн. ед.",
    },
    rawDataset: parsed.dataset,
    spectrumType: "plasma-emission",
  });
  const acceptedSymbols = analysis.hypotheses.map((item) => item.symbol);
  const expectation = expectations.spectra[fileName];

  report.push({
    fileName,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    imported: true,
    pointCount: parsed.dataset.wavelengths.length,
    wavelengthRangeNm: analysis.wavelengthRange,
    suitability: analysis.suitability.status,
    analysisChannels: analysis.channels.map((channel) => ({
      id: channel.id,
      wavelengthRangeNm: channel.wavelengthRange,
      spectralResolutionNm: channel.spectralResolutionNm,
      suitability: channel.suitability.status,
    })),
    peakCount: analysis.peaks.length,
    expectedPresentAtomicElements: expectation.present,
    acceptedExpectedAtomicElements: acceptedSymbols.filter((symbol) => expectation.present.includes(symbol)),
    missedPrimaryChecks: expectation.primaryChecks.filter((symbol) => !acceptedSymbols.includes(symbol)),
    acceptedUnlabelledAtomicElements: acceptedSymbols.filter((symbol) => !expectation.present.includes(symbol)),
    acceptedAtomicHypotheses: analysis.hypotheses.map((item) => ({
      symbol: item.symbol,
      reliability: item.reliability,
      strongCharacteristicGroups: item.strongCharacteristicGroupCount,
      reliableCharacteristicGroups: item.reliableCharacteristicGroupCount,
      randomControl: item.randomAgreement,
    })),
    leadingRejectedAtomicHypotheses: analysis.rejectedHypotheses.slice(0, 5).map((item) => ({
      symbol: item.hypothesis.symbol,
      reliability: item.hypothesis.reliability,
      reasons: item.reasons,
      strongCharacteristicGroups: item.hypothesis.strongCharacteristicGroupCount,
      reliableCharacteristicGroups: item.hypothesis.reliableCharacteristicGroupCount,
      highSpecificityCharacteristicGroups: item.hypothesis.highSpecificityCharacteristicGroupCount,
      randomControl: item.hypothesis.randomAgreement,
    })),
    acceptedMolecularHypotheses: analysis.molecularHypotheses.map((item) => ({
      formula: item.formula,
      supportedRegions: item.supportedRegionIds.length,
    })),
    missedMolecularChecks: (expectation.molecularPresent ?? []).filter((formula) => (
      !analysis.molecularHypotheses.some((item) => item.formula === formula)
    )),
    conclusion: analysis.conclusion,
});
}

const output = `${JSON.stringify(report, null, 2)}\n`;
if (process.argv.includes("--write")) {
  await writeFile(resolve(root, "verification-report.json"), output);
  process.stdout.write(`Обновлён ${resolve(root, "verification-report.json")}\n`);
} else {
  process.stdout.write(output);
}
