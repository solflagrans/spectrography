/** Parameters of the deterministic asymmetric least-squares (AsLS) baseline. */
export interface RobustBaselineParameters {
  readonly smoothness: number;
  readonly asymmetry: number;
  readonly iterations: number;
}

/**
 * Estimates a smooth baseline with asymmetric least squares.
 *
 * Positive residuals receive the smaller weight, so narrow emission peaks do
 * not pull the baseline upwards. The second-derivative penalty is evaluated on
 * the actual wavelength grid and therefore supports uneven sampling.
 */
export function estimateRobustBaseline(
  wavelengths: readonly number[],
  intensities: readonly number[],
  parameters: RobustBaselineParameters,
): readonly number[] {
  validateInputs(wavelengths, intensities, parameters);
  const length = intensities.length;
  if (length === 0) return [];
  if (length === 1) return [intensities[0]];
  if (length === 2) return [...intensities];

  const rows = createSecondDerivativeRows(wavelengths);
  let baseline = [...intensities];
  let weights = new Array<number>(length).fill(1);

  for (let pass = 0; pass < parameters.iterations; pass += 1) {
    baseline = solvePenalizedSystem(intensities, weights, rows, parameters.smoothness, baseline);
    weights = intensities.map((value, index) => (
      value > baseline[index] ? parameters.asymmetry : 1 - parameters.asymmetry
    ));
  }

  return baseline;
}

interface DifferenceRow {
  readonly index: number;
  readonly left: number;
  readonly center: number;
  readonly right: number;
}

function createSecondDerivativeRows(wavelengths: readonly number[]): readonly DifferenceRow[] {
  const steps = wavelengths.slice(1).map((value, index) => value - wavelengths[index]);
  const sortedSteps = [...steps].sort((left, right) => left - right);
  const medianStep = sortedSteps[Math.floor(sortedSteps.length / 2)] || 1;

  return Array.from({ length: wavelengths.length - 2 }, (_, rowIndex) => {
    const index = rowIndex + 1;
    const leftStep = (wavelengths[index] - wavelengths[index - 1]) / medianStep;
    const rightStep = (wavelengths[index + 1] - wavelengths[index]) / medianStep;
    const scale = 2 / (leftStep + rightStep);
    return {
      index,
      left: scale / leftStep,
      center: -scale * (1 / leftStep + 1 / rightStep),
      right: scale / rightStep,
    };
  });
}

function solvePenalizedSystem(
  values: readonly number[],
  weights: readonly number[],
  rows: readonly DifferenceRow[],
  smoothness: number,
  initial: readonly number[],
): number[] {
  const length = values.length;
  const rightHandSide = values.map((value, index) => weights[index] * value);
  const diagonal = [...weights];
  for (const row of rows) {
    diagonal[row.index - 1] += smoothness * row.left * row.left;
    diagonal[row.index] += smoothness * row.center * row.center;
    diagonal[row.index + 1] += smoothness * row.right * row.right;
  }

  const multiply = (vector: readonly number[]): number[] => {
    const result = vector.map((value, index) => weights[index] * value);
    for (const row of rows) {
      const curvature = row.left * vector[row.index - 1]
        + row.center * vector[row.index]
        + row.right * vector[row.index + 1];
      result[row.index - 1] += smoothness * row.left * curvature;
      result[row.index] += smoothness * row.center * curvature;
      result[row.index + 1] += smoothness * row.right * curvature;
    }
    return result;
  };

  const solution = [...initial];
  const residual = subtract(rightHandSide, multiply(solution));
  let preconditioned = residual.map((value, index) => value / Math.max(diagonal[index], Number.EPSILON));
  let direction = [...preconditioned];
  let residualProduct = dot(residual, preconditioned);
  const target = 1e-10 * Math.max(1, Math.sqrt(dot(rightHandSide, rightHandSide)));
  const maximumIterations = Math.max(80, Math.min(500, length * 2));

  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    if (Math.sqrt(dot(residual, residual)) <= target) break;
    const multipliedDirection = multiply(direction);
    const denominator = dot(direction, multipliedDirection);
    if (!Number.isFinite(denominator) || Math.abs(denominator) <= Number.EPSILON) break;
    const alpha = residualProduct / denominator;
    for (let index = 0; index < length; index += 1) {
      solution[index] += alpha * direction[index];
      residual[index] -= alpha * multipliedDirection[index];
    }
    preconditioned = residual.map((value, index) => value / Math.max(diagonal[index], Number.EPSILON));
    const nextProduct = dot(residual, preconditioned);
    if (!Number.isFinite(nextProduct) || Math.abs(residualProduct) <= Number.EPSILON) break;
    const beta = nextProduct / residualProduct;
    direction = preconditioned.map((value, index) => value + beta * direction[index]);
    residualProduct = nextProduct;
  }

  return solution;
}

function subtract(left: readonly number[], right: readonly number[]): number[] {
  return left.map((value, index) => value - right[index]);
}

function dot(left: readonly number[], right: readonly number[]): number {
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result += left[index] * right[index];
  return result;
}

function validateInputs(
  wavelengths: readonly number[],
  intensities: readonly number[],
  parameters: RobustBaselineParameters,
): void {
  if (wavelengths.length !== intensities.length) throw new Error("Длины массивов спектра не совпадают.");
  for (let index = 0; index < wavelengths.length; index += 1) {
    if (!Number.isFinite(wavelengths[index]) || !Number.isFinite(intensities[index])) {
      throw new Error("Спектр содержит некорректное числовое значение.");
    }
    if (index > 0 && wavelengths[index] <= wavelengths[index - 1]) {
      throw new Error("Для оценки базовой линии длины волн должны возрастать без повторов.");
    }
  }
  if (!Number.isFinite(parameters.smoothness) || parameters.smoothness <= 0) {
    throw new Error("Гладкость базовой линии должна быть больше нуля.");
  }
  if (!Number.isFinite(parameters.asymmetry) || parameters.asymmetry <= 0 || parameters.asymmetry >= 0.5) {
    throw new Error("Асимметрия базовой линии должна быть больше 0 и меньше 0,5.");
  }
  if (!Number.isInteger(parameters.iterations) || parameters.iterations < 1 || parameters.iterations > 50) {
    throw new Error("Число итераций базовой линии должно быть целым от 1 до 50.");
  }
}
