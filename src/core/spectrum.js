import { round } from "./math.js";

export function makeSpectrum({ start, end, points, baseline, noise, peaks }) {
  const wavelengths = [];
  const intensities = [];
  for (let i = 0; i < points; i += 1) {
    const x = start + ((end - start) * i) / (points - 1);
    let y = baseline + 2.5 * Math.sin(i / 57) + deterministicNoise(i) * noise;
    peaks.forEach(([center, amplitude, width]) => {
      const d = (x - center) / width;
      y += amplitude * Math.exp(-0.5 * d * d);
    });
    wavelengths.push(round(x, 3));
    intensities.push(round(Math.max(0, y), 3));
  }
  return { wavelengths, intensities };
}

export function smoothValues(values, windowSize) {
  const size = Math.max(1, Math.round(windowSize));
  if (size <= 1) return values;
  const radius = Math.floor(size / 2);
  return values.map((_, index) => {
    const from = Math.max(0, index - radius);
    const to = Math.min(values.length - 1, index + radius);
    let sum = 0;
    for (let i = from; i <= to; i += 1) sum += values[i];
    return sum / (to - from + 1);
  });
}

function deterministicNoise(index) {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return (value - Math.floor(value) - 0.5) * 2;
}
