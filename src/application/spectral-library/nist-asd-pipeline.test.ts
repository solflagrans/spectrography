import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { NIST_ASD_SELECTED_ELEMENTS } from "@/domain/spectral-library/selection";

import { normalizeNistAsdLines, parseRelativeIntensity } from "./normalize-nist-asd";
import { parseNistAsdExport } from "./parse-nist-asd-export";

const fixture = readFileSync(
  fileURLToPath(new URL("../../fixtures/nist-asd-lines-sample.tsv", import.meta.url)),
  "utf8",
);

describe("NIST ASD export pipeline", () => {
  it("parses the official tab-delimited column layout and retains optional source fields", () => {
    const rows = parseNistAsdExport(fixture);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      elementSymbol: "H",
      ionizationStage: "1",
      observedWavelength: "656.279",
      ritzWavelength: "656.281",
      observedMedium: "air",
      transitionProbabilityReference: "T1;T2",
    });
    expect(rows[1]).toMatchObject({ observedWavelength: "", ritzWavelength: "501.194+" });
  });

  it("keeps missing values absent and selects observed wavelength before Ritz", () => {
    const lines = normalize();
    const hydrogen = lines.find((line) => line.element.symbol === "H");
    const iron = lines.find((line) => line.element.symbol === "Fe");

    expect(hydrogen).toMatchObject({
      ionizationStage: 1,
      ionizationLabel: "I",
      preferredWavelength: { valueNm: 656.279, origin: "observed", medium: "air", uncertaintyNm: 0.003 },
      observedWavelength: { rawValue: "656.279" },
      ritzWavelength: { rawValue: "656.281" },
      bibliography: {
        transitionProbabilityReferences: ["T1", "T2"],
        lineReferences: ["L1"],
      },
    });
    expect(iron).toMatchObject({
      ionizationStage: 2,
      ionizationLabel: "II",
      preferredWavelength: { valueNm: 501.194, origin: "ritz", medium: "air", uncertaintyNm: 0.004 },
      ritzWavelength: { notation: "+" },
      bibliography: { lineReferences: ["L2", "L3"] },
    });
    expect(iron?.observedWavelength).toBeUndefined();
    expect(iron?.transition?.upperLevel).toBeUndefined();
    expect(iron?.transition?.lowerLevel?.energyEv).toEqual({ rawValue: "[2.891]", numericValue: 2.891 });
  });

  it("retains intensity text, numeric part and source notations", () => {
    expect(parseRelativeIntensity("120bl(Fe II)*")).toEqual({
      rawValue: "120bl(Fe II)*",
      numericValue: 120,
      notations: ["bl", "(Fe II)", "*"],
    });
    expect(parseRelativeIntensity(":")) .toEqual({ rawValue: ":", notations: [":"] });
    expect(parseRelativeIntensity("")).toBeUndefined();
  });

  it("produces stable unique identifiers and deterministic ordering", () => {
    const first = normalize();
    const second = normalizeNistAsdLines([...parseNistAsdExport(fixture)].reverse(), options);

    expect(first.map((line) => line.id)).toEqual(second.map((line) => line.id));
    expect(new Set(first.map((line) => line.id)).size).toBe(first.length);
    expect(first.map((line) => line.preferredWavelength.valueNm)).toEqual([501.194, 656.279]);
  });

  it("rejects exports that hide the wavelength medium", () => {
    expect(() => parseNistAsdExport(
      "element\tsp_num\tobs_wl(nm)\tritz_wl(nm)\tintens\nH\t1\t500\t500\t1\n",
    )).toThrow("с указанной средой");
  });

  it("supports explicitly labelled vacuum wavelength columns", () => {
    const rows = parseNistAsdExport(
      "element\tsp_num\tobs_wl_vac(nm)\tritz_wl_vac(nm)\tintens\nH\t1\t199.9\t199.91\t1\n",
    );
    expect(rows[0]).toMatchObject({ observedMedium: "vacuum", ritzMedium: "vacuum" });
  });
});

const options = {
  datasetVersion: "5.12",
  retrievedAt: "2026-08-30",
  elements: NIST_ASD_SELECTED_ELEMENTS,
} as const;

function normalize() {
  return normalizeNistAsdLines(parseNistAsdExport(fixture), options);
}
