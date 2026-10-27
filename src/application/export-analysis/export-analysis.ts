import type { WorkingAnalysis } from "@/application/analysis/working-analysis";
import type { ChannelPreparationResult } from "@/domain/spectrum";

// CSV numbers keep their full stored precision. Infinity is explicit in both formats.
export function createPeaksCsv(channel: ChannelPreparationResult): string {
  return [
    "peak_id,wavelength_nm,sampled_wavelength_nm,position_uncertainty_nm,raw_intensity,prepared_intensity,width_half_prominence_nm,snr,prominence",
    ...channel.peaks.map((peak) => [peak.id, peak.wavelength, peak.sampledWavelength, peak.positionUncertaintyNm, peak.rawIntensity, peak.intensity, peak.widthNm, peak.snr, peak.prominence].join(",")),
  ].join("\r\n");
}

export function createSpectrumCsv(channel: ChannelPreparationResult): string {
  return ["wavelength_nm,prepared_intensity", ...channel.preparedDataset.wavelengths.map((wavelength, index) => `${wavelength},${channel.preparedDataset.intensities[index]}`)].join("\r\n");
}

export function createAnalysisExport(analysis: WorkingAnalysis): string {
  return JSON.stringify({ exportVersion: 1, widthDefinition: "full width at half prominence", nonFiniteNumbers: "Infinity, -Infinity and NaN are encoded as strings", analysis }, (_key, value: unknown) => typeof value === "number" && !Number.isFinite(value) ? String(value) : value, 2);
}
