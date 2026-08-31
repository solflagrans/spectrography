import { loadAirPlasmaRegressionAnalyses } from "@/fixtures/regression/load-air-plasma-regression";

const analyses = await loadAirPlasmaRegressionAnalyses();
const summary = analyses.map((analysis) => {
  const oxygen = analysis.hypotheses.find((item) => item.symbol === "O")
    ?? analysis.rejectedHypotheses.find((item) => item.hypothesis.symbol === "O")?.hypothesis;
  return {
    id: analysis.id,
    format: analysis.source.format,
    channelCount: analysis.channels.length,
    peakCount: analysis.peaks.length,
    leadingHypothesis: analysis.hypotheses[0]
      ? {
          symbol: analysis.hypotheses[0].symbol,
          reliability: analysis.hypotheses[0].reliability,
          strongCharacteristicGroups: analysis.hypotheses[0].strongCharacteristicGroupCount,
          reliableCharacteristicGroups: analysis.hypotheses[0].reliableCharacteristicGroupCount,
        }
      : null,
    oxygen: oxygen ? {
      status: analysis.hypotheses.includes(oxygen) ? "main" : "details",
      strongCharacteristicGroups: oxygen.strongCharacteristicGroupCount,
      reliableKeyGroups: oxygen.reliableKeyCharacteristicGroupCount,
    } : null,
    aluminiumIsMain: analysis.hypotheses.some((item) => item.symbol === "Al"),
    molecular: {
      accepted: analysis.molecularHypotheses.map((item) => ({ formula: item.formula, supportedRegions: item.supportedRegionIds.length })),
      rejected: analysis.rejectedMolecularHypotheses.map((item) => item.formula),
    },
    conclusion: analysis.conclusion,
  };
});

for (const item of summary) {
  if (item.channelCount !== 1) throw new Error(`${item.id}: измерение должно оставаться одноканальной независимой сессией.`);
  if (item.leadingHypothesis?.symbol !== "N") throw new Error(`${item.id}: основной гипотезой должен оставаться азот.`);
  if (!item.oxygen || item.oxygen.strongCharacteristicGroups < 1) throw new Error(`${item.id}: потерян сильный характерный признак кислорода.`);
  if (item.aluminiumIsMain) throw new Error(`${item.id}: алюминий не должен попадать в основной список по плотности линий.`);
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
