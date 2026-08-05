/**
 * Step → distance → calorie conversions.
 *
 * Distance uses the user's stride length (default 0.762 m, the standard adult
 * average) rather than guessing from height, because the user can measure and
 * correct it in Settings.
 *
 * Calories use a MET-based estimate: walking sits between 2.0 MET (slow) and
 * 5.0 MET (brisk) depending on cadence, and kcal/min = MET * 3.5 * kg / 200.
 */

export const DEFAULT_STRIDE_M = 0.762;
export const DEFAULT_WEIGHT_KG = 70;

export function distanceFromSteps(steps: number, strideM = DEFAULT_STRIDE_M): number {
  return steps * strideM;
}

/** Cadence → MET, linearly interpolated across the ordinary walking range. */
export function metForCadence(stepsPerMinute: number): number {
  if (stepsPerMinute <= 0) return 1;
  if (stepsPerMinute < 60) return 2.0;
  if (stepsPerMinute > 140) return 6.5;
  return 2.0 + ((stepsPerMinute - 60) / 80) * 4.5;
}

export function caloriesBurned(
  steps: number,
  activeMs: number,
  weightKg = DEFAULT_WEIGHT_KG,
): number {
  const minutes = activeMs / 60_000;
  if (minutes <= 0 || steps <= 0) return 0;
  const met = metForCadence(steps / minutes);
  return (met * 3.5 * weightKg * minutes) / 200;
}

/**
 * Calories for a whole day, where we know the step count but not how long the
 * user spent moving. Assume a typical 110 steps/min cadence.
 */
export function caloriesFromDailySteps(steps: number, weightKg = DEFAULT_WEIGHT_KG): number {
  const assumedMinutes = steps / 110;
  return caloriesBurned(steps, assumedMinutes * 60_000, weightKg);
}

export function paceStepsPerMinute(steps: number, activeMs: number): number {
  const minutes = activeMs / 60_000;
  return minutes > 0 ? steps / minutes : 0;
}
