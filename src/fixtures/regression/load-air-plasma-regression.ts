import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { createWorkingAnalysis, type WorkingAnalysis } from "@/application/analysis/create-working-analysis";
import { parseSpectrumFile } from "@/application/import-spectrum/parse-dataset";

interface RegressionMeasurement {
  readonly id: string;
  readonly fileName: string;
  readonly fixtureUrl: URL;
  readonly sha256: string;
}

const measurements: readonly RegressionMeasurement[] = [
  {
    id: "air-plasma-regression-a",
    fileName: "measurement-a.xlsx",
    fixtureUrl: new URL("./air-plasma-lab.xlsx.base64", import.meta.url),
    sha256: "1457e8310d36803c55bc7e5e53b72155d40d2f7cbdf6def9192bade698256979",
  },
  {
    id: "air-plasma-regression-b",
    fileName: "measurement-b.raw8",
    fixtureUrl: new URL("./air-plasma.raw8.base64", import.meta.url),
    sha256: "63036ea1949fb9336b9186f2aa4f0fca6647e40099e17944c0b3d27e1657fe26",
  },
];

/** Loads and analyzes the two measurements independently; no data or evidence is shared between calls. */
export async function loadAirPlasmaRegressionAnalyses(): Promise<readonly WorkingAnalysis[]> {
  return Promise.all(measurements.map(async (measurement, index) => {
    const encoded = await readFile(measurement.fixtureUrl, "utf8");
    const bytes = Buffer.from(encoded.replaceAll(/\s/gu, ""), "base64");
    const checksum = createHash("sha256").update(bytes).digest("hex");
    if (checksum !== measurement.sha256) throw new Error(`Контрольная сумма регрессионного измерения ${index + 1} не совпала.`);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const parsed = await parseSpectrumFile({ fileName: measurement.fileName, data });
    return createWorkingAnalysis({
      id: measurement.id,
      title: `Регрессионное измерение ${index + 1}`,
      source: {
        kind: "Пользовательский файл",
        fileName: measurement.fileName,
        format: parsed.format,
        units: parsed.format === "RAW8" ? "нм / отсчёты прибора" : "нм / отн. ед.",
      },
      rawDataset: parsed.dataset,
      spectrumType: "plasma-emission",
      auxiliaryData: parsed.auxiliaryData,
      instrumentMetadata: parsed.instrumentMetadata,
    });
  }));
}
