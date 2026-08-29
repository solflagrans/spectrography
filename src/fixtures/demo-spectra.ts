import { round } from "@/domain/spectrum/math";
import type { SpectrumDataset } from "@/domain/spectrum/types";

interface SpectrumFixtureOptions {
  readonly start: number;
  readonly end: number;
  readonly points: number;
  readonly baseline: number;
  readonly noise: number;
  readonly peaks: readonly (readonly [center: number, amplitude: number, width: number])[];
}

export function makeSpectrumFixture(options: SpectrumFixtureOptions): SpectrumDataset {
  const wavelengths: number[] = [];
  const intensities: number[] = [];

  for (let index = 0; index < options.points; index += 1) {
    const wavelength = options.start + ((options.end - options.start) * index) / (options.points - 1);
    let intensity = options.baseline + 2.5 * Math.sin(index / 57) + deterministicNoise(index) * options.noise;

    for (const [center, amplitude, width] of options.peaks) {
      const distance = (wavelength - center) / width;
      intensity += amplitude * Math.exp(-0.5 * distance * distance);
    }

    wavelengths.push(round(wavelength, 3));
    intensities.push(round(Math.max(0, intensity), 3));
  }

  return { wavelengths, intensities };
}

export const demoSpectra = {
  fe12: makeSpectrumFixture({
    start: 380,
    end: 780,
    points: 1_024,
    baseline: 8,
    noise: 0.45,
    peaks: [
      [393.37, 74, 0.48],
      [396.85, 68, 0.48],
      [404.58, 88, 0.52],
      [438.35, 73, 0.55],
      [520.84, 42, 0.58],
      [527.04, 64, 0.55],
      [532.8, 58, 0.58],
      [613.66, 51, 0.62],
      [630.41, 36, 0.64],
      [640, 47, 0.62],
    ],
  }),
  solar: makeSpectrumFixture({
    start: 360,
    end: 720,
    points: 1_800,
    baseline: 20,
    noise: 1.2,
    peaks: [
      [393.37, 72, 0.22],
      [396.85, 68, 0.22],
      [486.13, 62, 0.32],
      [516.73, 44, 0.28],
      [517.27, 42, 0.24],
      [518.36, 47, 0.28],
      [527.04, 34, 0.32],
      [588.99, 92, 0.24],
      [589.59, 84, 0.24],
      [656.28, 76, 0.38],
    ],
  }),
  lamp: makeSpectrumFixture({
    start: 360,
    end: 830,
    points: 2_300,
    baseline: 12,
    noise: 0.9,
    peaks: [
      [404.66, 60, 0.16],
      [435.83, 80, 0.18],
      [546.07, 96, 0.2],
      [576.96, 58, 0.18],
      [579.07, 55, 0.18],
      [585.25, 86, 0.2],
      [640.22, 78, 0.18],
      [696.54, 92, 0.22],
      [706.72, 74, 0.21],
      [763.51, 70, 0.24],
      [811.53, 52, 0.28],
    ],
  }),
  alloy: makeSpectrumFixture({
    start: 315,
    end: 700,
    points: 2_200,
    baseline: 16,
    noise: 1.1,
    peaks: [
      [324.75, 92, 0.18],
      [327.4, 88, 0.2],
      [394.4, 58, 0.18],
      [396.15, 54, 0.18],
      [404.58, 69, 0.22],
      [438.35, 62, 0.24],
      [510.55, 74, 0.23],
      [521.82, 67, 0.22],
      [547.69, 52, 0.25],
      [640, 44, 0.3],
      [676.77, 38, 0.32],
    ],
  }),
} as const;

function deterministicNoise(index: number): number {
  const value = Math.sin(index * 12.9898 + 78.233) * 43_758.5453;
  return (value - Math.floor(value) - 0.5) * 2;
}
