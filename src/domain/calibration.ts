/**
 * Calibration domain logic — pure functions.
 *
 * Calibration measures the gap between a learner's predicted score and the
 * actual score from feedback. Delta: -1 = overestimated, 0 = calibrated,
 * 1 = underestimated.
 */

export type ScoreOutcome = "correct" | "partial" | "incorrect";

const SCORE_ORDER: Record<ScoreOutcome, number> = {
  incorrect: 0,
  partial: 1,
  correct: 2,
};

/**
 * Compute calibration delta between predicted and actual score.
 * Returns -1 (overestimated), 0 (calibrated), or 1 (underestimated).
 */
export function computeCalibrationDelta(
  predicted: ScoreOutcome,
  actual: ScoreOutcome,
): -1 | 0 | 1 {
  const p = SCORE_ORDER[predicted];
  const a = SCORE_ORDER[actual];
  if (p > a) return -1;
  if (p < a) return 1;
  return 0;
}
