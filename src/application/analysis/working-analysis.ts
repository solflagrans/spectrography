import type {
  Raw8AuxiliaryData,
  Raw8InstrumentMetadata,
} from "@/application/import-spectrum/parse-avasoft-raw8";
import type {
  InteractiveAnalysisParameters,
  InteractiveSpectrumAnalysis,
  NewAnalysisSpectrumType,
  SpectrumChannelInput,
  SpectrumDataset,
  SpectrumStats,
  SpectrumType,
} from "@/domain/spectrum";
import nasaIronRichSpectrum from "../../../reference-spectra/app-ready/nasa-pds-h92649-iron-rich.json";

export type AnalysisFileFormat = "CSV" | "JSON" | "XLSX" | "RAW8";

export interface AnalysisSource {
  readonly kind: "NASA PDS" | "Пользовательский файл";
  readonly fileName: string;
  readonly format: AnalysisFileFormat;
  readonly units: "нм / отн. ед." | "нм / отсчёты прибора";
}

export interface AnalysisTransformation {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly description: string;
}

export interface WorkingAnalysis extends InteractiveSpectrumAnalysis {
  readonly id: string;
  readonly title: string;
  readonly source: AnalysisSource;
  readonly libraryVersion: string;
  readonly libraryLabel: string;
  readonly molecularLibraryVersion: string;
  readonly rawDataset: SpectrumDataset;
  readonly spectrumType: NewAnalysisSpectrumType;
  readonly rawStats: SpectrumStats;
  readonly wavelengthRange: {
    readonly minimum: number;
    readonly maximum: number;
  };
  readonly wavelengthStep: number;
  readonly parameters: InteractiveAnalysisParameters;
  readonly transformations: readonly AnalysisTransformation[];
  readonly conclusion: string;
  readonly auxiliaryData?: Raw8AuxiliaryData;
  readonly instrumentMetadata?: Raw8InstrumentMetadata;
}

export interface CreateWorkingAnalysisInput {
  readonly id: string;
  readonly title: string;
  readonly source: AnalysisSource;
  readonly rawDataset: SpectrumDataset;
  readonly spectrumType?: SpectrumType;
  /** Optional unified multi-channel input; rawDataset remains the primary-channel compatibility alias. */
  readonly channels?: readonly SpectrumChannelInput[];
  readonly auxiliaryData?: Raw8AuxiliaryData;
  readonly instrumentMetadata?: Raw8InstrumentMetadata;
}

export const DEMO_ANALYSIS_INPUT: CreateWorkingAnalysisInput = {
  id: "nasa-pds-h92649-iron-rich",
  title: "NASA PDS · образец H92649",
  source: {
    kind: "NASA PDS",
    fileName: "nasa-pds-h92649-iron-rich.json",
    format: "JSON",
    units: "нм / отн. ед.",
  },
  rawDataset: nasaIronRichSpectrum,
};
