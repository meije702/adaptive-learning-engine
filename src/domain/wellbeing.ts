/**
 * Wellbeing transition logic — pure function.
 *
 * Computes the new wellbeing state object from the current state and the
 * requested next status. Sets pausedAt / returnedAt timestamps consistently.
 */

import type { LearnerState } from "../db/types.ts";

export type WellbeingStatus = "active" | "paused" | "returning";

/**
 * Apply a wellbeing status transition. Returns the new wellbeing object.
 *
 * - "paused": stamp pausedAt = now, keep prior returnedAt
 * - "returning" / "active": stamp returnedAt = now, keep prior pausedAt
 */
export function applyWellbeingTransition(
  current: LearnerState["wellbeing"] | undefined,
  next: WellbeingStatus,
  now: string = new Date().toISOString(),
): LearnerState["wellbeing"] {
  return {
    status: next,
    pausedAt: next === "paused" ? now : current?.pausedAt,
    returnedAt: next === "returning" || next === "active"
      ? now
      : current?.returnedAt,
  };
}
