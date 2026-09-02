import { loadAirPlasmaRegressionAnalyses } from "@/fixtures/regression/load-air-plasma-regression";
import { runSyntheticIdentificationCases } from "@/fixtures/regression/synthetic-identification-cases";
import { loadOpenExperimentalAirPlasmaAnalysis } from "@/fixtures/regression/load-open-experimental-spectrum";
import { IDENTIFICATION_QUALITY_PROFILE } from "@/domain/spectrum/quality-profile";

const real = await loadAirPlasmaRegressionAnalyses();
const synthetic = runSyntheticIdentificationCases();
const openExperimental = await loadOpenExperimentalAirPlasmaAnalysis();
const realExpected: ReadonlyMap<string, {
  readonly atomic: readonly string[];
  readonly molecular: readonly string[];
}> = new Map([
  ["air-plasma-regression-a", { atomic: ["N", "O"], molecular: [] }],
  ["air-plasma-regression-b", { atomic: [], molecular: ["N₂"] }],
]);

const realRows = real.map((analysis) => {
  const expected = realExpected.get(analysis.id) ?? { atomic: [], molecular: [] };
  const main: readonly string[] = analysis.hypotheses.map((item) => item.symbol);
  const molecular: readonly string[] = analysis.molecularHypotheses.map((item) => item.formula);
  return {
    id: analysis.id,
    suitability: analysis.suitability.status,
    main,
    molecular,
    missingMain: expected.atomic.filter((symbol) => !main.includes(symbol)),
    missingMolecular: expected.molecular.filter((formula) => !molecular.includes(formula)),
    falseMain: main.filter((symbol) => !expected.atomic.includes(symbol)),
    falseMolecular: molecular.filter((formula) => !expected.molecular.includes(formula)),
    calibration: analysis.channels.map((channel) => ({ status: channel.wavelengthCalibration.status, shiftNm: channel.wavelengthCalibration.shiftNm })),
  };
});

const syntheticRows = synthetic.map(({ definition, analysis }) => {
  const main = analysis.hypotheses.map((item) => item.symbol);
  const molecular = analysis.molecularHypotheses.map((item) => item.formula);
  return {
    id: definition.id,
    main,
    molecular,
    falseMain: main.filter((symbol) => !definition.expectedAtomicSymbols.includes(symbol)),
    falseMolecular: molecular.filter((formula) => !definition.expectedMolecularFormulae.includes(formula)),
    refused: main.length === 0 && molecular.length === 0,
    expectedRefusal: definition.expectedRefusal,
    suitability: analysis.suitability.status,
    calibration: {
      status: analysis.channels[0].wavelengthCalibration.status,
      shiftNm: analysis.channels[0].wavelengthCalibration.shiftNm,
    },
  };
});

const stableCases = syntheticRows.filter((row) => ["clean-mixture", "noisy-mixture", "shifted-scale", "broader-resolution"].includes(row.id));
const report = {
  profile: IDENTIFICATION_QUALITY_PROFILE.id,
  realMeasurements: realRows,
  syntheticCases: syntheticRows,
  openExperimental: {
    id: "zenodo-14843545-fig2-total",
    suitability: openExperimental.suitability.status,
    main: openExperimental.hypotheses.map((item) => item.symbol),
    molecular: openExperimental.molecularHypotheses.map((item) => item.formula),
    falseMain: openExperimental.hypotheses.map((item) => item.symbol),
    falseMolecular: openExperimental.molecularHypotheses.map((item) => item.formula).filter((formula) => formula !== "N₂"),
  },
  checks: {
    noFalseMainHypotheses: [...realRows, ...syntheticRows].every((row) => row.falseMain.length === 0) && openExperimental.hypotheses.length === 0,
    noFalseMolecularHypotheses: realRows.every((row) => row.falseMolecular.length === 0) && syntheticRows.every((row) => row.falseMolecular.length === 0) && openExperimental.molecularHypotheses.every((item) => item.formula === "N₂"),
    correctRefusals: syntheticRows.filter((row) => row.expectedRefusal).every((row) => row.refused),
    stableToNoiseShiftAndResolution: stableCases.every((row) => row.main.includes("Sx") && row.molecular.includes("N₂")),
    priorExamplesNotDegraded: realRows.every((row) => row.missingMain.length === 0 && row.missingMolecular.length === 0 && !row.main.includes("Al")),
    openExperimentalAirPlasmaRecognized: openExperimental.hypotheses.length === 0 && openExperimental.molecularHypotheses.some((item) => item.formula === "N₂"),
  },
};

if (Object.values(report.checks).some((value) => !value)) {
  throw new Error(`Контур идентификации выявил регрессию:\n${JSON.stringify(report, null, 2)}`);
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
