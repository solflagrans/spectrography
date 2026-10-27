import { describe, expect, it } from "vitest";
import { restrictAnalysisRange } from "./analysis-range";
import { DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS, runInteractiveSpectrumAnalysis } from "./interactive-analysis";

const dataset = { wavelengths: [506, 505, 504, 503, 502, 501, 500], intensities: [0, 0, 1, 4, 1, 0, 0] };
const parameters = { ...DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS, processing: { ...DEFAULT_INTERACTIVE_ANALYSIS_PARAMETERS.processing, analysisRange: { minimum: 501, maximum: 505 } } };

describe("analysis range", () => {
  it("keeps raw input intact and preserves source indices on an unsorted grid", () => {
    const result = restrictAnalysisRange({ id: "c", name: "C", dataset }, parameters.processing)[0];
    expect(result.dataset.wavelengths).toEqual([505, 504, 503, 502, 501]);
    expect(result.automaticSegment?.sourcePointIndices).toEqual([1, 2, 3, 4, 5]);
    expect(dataset.wavelengths).toHaveLength(7);
  });
  it("composes source indices with detector segmentation", () => {
    const result = restrictAnalysisRange({ id: "c", name: "C", dataset, automaticSegment: { parentChannelId: "p", index: 0, count: 1, excludedPointCount: 2, sourcePointIndices: [10, 11, 12, 13, 14, 15, 16], wavelengthRange: { minimum: 500, maximum: 506 } } }, parameters.processing)[0];
    expect(result.automaticSegment?.sourcePointIndices).toEqual([11, 12, 13, 14, 15]);
  });
  it("restricts preparation and coverage and rejects an empty or inverted range", () => {
    const result = runInteractiveSpectrumAnalysis(dataset, [], parameters);
    expect(result.channels[0].wavelengthRange).toEqual({ minimum: 501, maximum: 505 });
    expect(result.channels[0].preparedDataset.wavelengths.every((w) => w >= 501 && w <= 505)).toBe(true);
    expect(() => runInteractiveSpectrumAnalysis(dataset, [], { ...parameters, processing: { ...parameters.processing, analysisRange: { minimum: 510, maximum: 520 } } })).toThrow();
    expect(() => runInteractiveSpectrumAnalysis(dataset, [], { ...parameters, processing: { ...parameters.processing, analysisRange: { minimum: 505, maximum: 501 } } })).toThrow();
  });
});
