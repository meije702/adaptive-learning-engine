/**
 * Spaced-repetition algorithm — pure functions.
 *
 * Previously lived inside KvRetentionRepository. Extracted so the math can
 * be unit-tested without booting KV and so the same algorithm is usable
 * from future backends.
 *
 * The algorithm is a simplified SM-2 variant:
 *  - correct  → interval * multiplierCorrect, capped at maxIntervalDays; streak++
 *  - partial  → interval * multiplierPartial; streak = 0
 *  - incorrect → reset to initialIntervalDays; streak = 0
 *
 * Pause decay: if pauseDays >= interval, the learner has "forgotten" and the
 * schedule resets. Otherwise the interval decays by interval / (1 + pauseDays/interval).
 */

import type { RetentionSchedule } from "../db/types.ts";

export interface RetentionConfig {
  initialIntervalDays: number;
  multiplierCorrect: number;
  multiplierPartial: number;
  multiplierIncorrect: number;
  maxIntervalDays: number;
}

export const DEFAULT_RETENTION_CONFIG: RetentionConfig = {
  initialIntervalDays: 1,
  multiplierCorrect: 2.5,
  multiplierPartial: 1.2,
  multiplierIncorrect: 0,
  maxIntervalDays: 60,
};

/**
 * Normalise a snake_case config (as found in system.config.yaml) to the
 * camelCase shape consumed by the domain functions.
 */
export function retentionConfigFromSystem(
  snake?: {
    initial_interval_days: number;
    multiplier_correct: number;
    multiplier_partial: number;
    multiplier_incorrect: number;
    max_interval_days: number;
  },
): RetentionConfig {
  if (!snake) return DEFAULT_RETENTION_CONFIG;
  return {
    initialIntervalDays: snake.initial_interval_days,
    multiplierCorrect: snake.multiplier_correct,
    multiplierPartial: snake.multiplier_partial,
    multiplierIncorrect: snake.multiplier_incorrect,
    maxIntervalDays: snake.max_interval_days,
  };
}

/**
 * Build a fresh schedule for a domain that has never been reviewed.
 */
export function initialSchedule(
  domainId: string,
  config: RetentionConfig,
  now: Date = new Date(),
): RetentionSchedule {
  return {
    domainId,
    nextDue: now.toISOString(),
    interval: config.initialIntervalDays,
    streak: 0,
    lastResult: "incorrect",
  };
}

/**
 * Apply a review result and compute the new schedule. Pure.
 */
export function nextScheduleAfterReview(
  prev: RetentionSchedule,
  result: "correct" | "partial" | "incorrect",
  config: RetentionConfig,
  now: Date = new Date(),
): RetentionSchedule {
  let newInterval: number;
  let newStreak: number;

  switch (result) {
    case "correct":
      newInterval = Math.min(
        Math.round(prev.interval * config.multiplierCorrect),
        config.maxIntervalDays,
      );
      newStreak = prev.streak + 1;
      break;
    case "partial":
      newInterval = Math.round(prev.interval * config.multiplierPartial);
      newStreak = 0;
      break;
    case "incorrect":
      newInterval = config.initialIntervalDays;
      newStreak = 0;
      break;
  }

  const nextDue = new Date(now);
  nextDue.setDate(nextDue.getDate() + newInterval);

  return {
    domainId: prev.domainId,
    nextDue: nextDue.toISOString(),
    interval: newInterval,
    streak: newStreak,
    lastResult: result,
  };
}

/**
 * Decay a schedule after a learner pause. Pure.
 *
 * If pauseDays >= interval, the schedule resets to initial (streak cleared).
 * Otherwise the interval decays proportionally and streak is preserved.
 * nextDue is moved to `now` so decayed items become immediately due.
 */
export function decayAfterPause(
  prev: RetentionSchedule,
  pauseDays: number,
  config: RetentionConfig,
  now: Date = new Date(),
): RetentionSchedule {
  const reset = pauseDays >= prev.interval;
  const newInterval = reset ? config.initialIntervalDays : Math.max(
    config.initialIntervalDays,
    Math.round(prev.interval / (1 + pauseDays / prev.interval)),
  );

  return {
    ...prev,
    interval: newInterval,
    nextDue: now.toISOString(),
    streak: reset ? 0 : prev.streak,
  };
}
