export type WavelengthMedium = "air" | "vacuum";
export type PreferredWavelengthOrigin = "observed" | "ritz";

export interface SpectralLineElement {
  readonly atomicNumber: number;
  readonly symbol: string;
  readonly name: string;
}

export interface SpectralWavelength {
  readonly valueNm: number;
  readonly medium: WavelengthMedium;
  readonly uncertaintyNm?: number;
  /** Exact value from the source export, before numeric normalization. */
  readonly rawValue: string;
  /** Source notation attached to the wavelength, for example `+` on a Ritz value. */
  readonly notation?: string;
}

export interface PreferredWavelength {
  readonly valueNm: number;
  readonly medium: WavelengthMedium;
  readonly origin: PreferredWavelengthOrigin;
  readonly uncertaintyNm?: number;
}

export interface RelativeIntensity {
  readonly rawValue: string;
  readonly numericValue?: number;
  /** Qualifiers retained in source order; their meaning is defined by NIST ASD. */
  readonly notations: readonly string[];
}

export interface SourceNumericValue {
  readonly rawValue: string;
  readonly numericValue?: number;
}

export interface SpectralEnergyLevel {
  readonly energyEv?: SourceNumericValue;
  readonly configuration?: string;
  readonly term?: string;
  readonly totalAngularMomentum?: string;
  readonly statisticalWeight?: number;
}

export interface SpectralTransition {
  readonly type?: string;
  readonly transitionProbabilityPerSecond?: number;
  readonly transitionProbabilityAccuracy?: string;
  readonly lowerLevel?: SpectralEnergyLevel;
  readonly upperLevel?: SpectralEnergyLevel;
}

export interface SpectralLineBibliography {
  readonly transitionProbabilityReferences?: readonly string[];
  readonly lineReferences?: readonly string[];
}

export interface SpectralLineSource {
  readonly name: "NIST ASD" | "Synthetic verification fixture";
  readonly datasetVersion: string;
  readonly retrievedAt: string;
}

export interface SpectralLine {
  readonly id: string;
  readonly element: SpectralLineElement;
  /** Spectrum number: 1 is neutral, 2 is singly ionized, and so on. */
  readonly ionizationStage: number;
  readonly ionizationLabel: string;
  readonly observedWavelength?: SpectralWavelength;
  readonly ritzWavelength?: SpectralWavelength;
  readonly preferredWavelength: PreferredWavelength;
  readonly relativeIntensity?: RelativeIntensity;
  readonly transition?: SpectralTransition;
  readonly bibliography?: SpectralLineBibliography;
  readonly source: SpectralLineSource;
}

export interface SpectralLibraryManifest {
  readonly schemaVersion: 1;
  readonly name: string;
  readonly version: string;
  readonly source: "NIST Atomic Spectra Database";
  readonly nistAsdVersion: string;
  readonly doi: string;
  readonly retrievedAt: string;
  readonly attribution: string;
  readonly query: {
    readonly elements: readonly string[];
    readonly ionizationStages: readonly number[];
    readonly wavelengthRangeNm: {
      readonly minimum: number;
      readonly maximum: number;
    };
    readonly wavelengthMediumPolicy: string;
    readonly lineSelection: string;
    readonly outputFormat: "tab-delimited";
  };
  readonly lineCount: number;
  readonly checksum: {
    readonly algorithm: "sha256";
    readonly value: string;
  };
}

export interface SpectralLibrary {
  readonly manifest: SpectralLibraryManifest;
  readonly lines: readonly SpectralLine[];
}
