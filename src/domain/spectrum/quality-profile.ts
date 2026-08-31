/**
 * One versioned profile for measurement quality and wavelength uncertainty.
 * Values are dimensionless multipliers or physically interpretable limits;
 * none of them is fitted to a file name, element, or expected composition.
 */
export const IDENTIFICATION_QUALITY_PROFILE = {
  id: "emission-quality-v1",
  peakRefinement: {
    minimumSnrFactor: 1.5,
    minimumProminenceFactor: 1.5,
    halfWindowPoints: 2,
    maximumOffsetInGridSteps: 0.75,
  },
  adaptiveTolerance: {
    coverageFactor: 2.5,
    maximumToleranceNm: 1.2,
    minimumGridSteps: 1.25,
    resolvingPowerDivisor: 2.355,
    uncalibratedResolutionFraction: 0.2,
  },
  calibration: {
    minimumAnchorCount: 4,
    minimumAnchorsPerPartition: 2,
    minimumRangeSpanFraction: 0.35,
    minimumAnchorSnr: 10,
    minimumAnchorProminenceFactor: 2,
    maximumNormalizedAnchorDelta: 0.8,
    maximumShiftResolutionFraction: 0.75,
    maximumAbsoluteShiftNm: 0.8,
    requiredValidationImprovementFraction: 0.2,
    maximumValidationNormalizedResidual: 0.8,
  },
  suitability: {
    minimumPointCount: 25,
    minimumResolutionElements: 12,
    limitedResolutionElements: 30,
    impossibleDynamicRangeSnr: 3,
    limitedDynamicRangeSnr: 8,
    baselineDriftRatio: 0.5,
    outlierSigma: 8,
    limitedOutlierFraction: 0.01,
    impossibleOutlierFraction: 0.08,
    repeatedExtremeFraction: 0.01,
    repeatedExtremeRun: 3,
    minimumFeatureCount: 2,
    minimumStrongFeatureCount: 2,
    minimumResolutionPeakCount: 3,
    maximumResolutionRelativeMad: 0.45,
  },
  weakEvidence: {
    minimumCount: 6,
    countPerReliableGroup: 3,
    minimumFraction: 0.7,
  },
  molecular: {
    minimumRelativeContrast: 0.025,
  },
} as const;

export type IdentificationQualityProfile = typeof IDENTIFICATION_QUALITY_PROFILE;
