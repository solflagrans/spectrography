import { describe, expect, it } from "vitest";
import { createAnalysisExport, createPeaksCsv, createSpectrumCsv } from "./export-analysis";
import { createWorkingAnalysis } from "@/application/analysis/create-working-analysis";
import { DEMO_ANALYSIS_INPUT } from "@/application/analysis/working-analysis";

 describe("analysis export", () => {
  it("exports prepared points, full peak precision, parameters and calibration", () => {
    const analysis = createWorkingAnalysis(DEMO_ANALYSIS_INPUT);
    const channel = analysis.channels[0];
    const csv = createPeaksCsv(channel);
    expect(csv).toContain("width_half_prominence_nm");
    expect(csv.split("\r\n")).toHaveLength(channel.peaks.length + 1);
    expect(csv).toContain(String(channel.peaks[0].wavelength));
    expect(createSpectrumCsv(channel).split("\r\n")).toHaveLength(channel.preparedDataset.wavelengths.length + 1);
    const exported = JSON.parse(createAnalysisExport(analysis));
    expect(exported.analysis.parameters).toEqual(analysis.parameters);
    expect(exported.analysis.channels[0].wavelengthCalibration).toEqual(channel.wavelengthCalibration);
    expect(exported.analysis.rawDataset).toEqual(analysis.rawDataset);
    expect(exported.analysis.libraryVersion).toBe(analysis.libraryVersion);
  });
});
