/**
 * Gap-analysis domain types.
 *
 * These used to live in src/db/types.ts but they are computation outputs,
 * not persistent entities. Keeping them here separates "data at rest" from
 * "derived view" and lets the persistence layer wrap them in an explicit
 * snapshot shape with a schemaVersion.
 *
 * NOTE: `GapAnalysisResult` (defined in ./gap.ts) is the *richer* output of
 * `computeGapAnalysis()`. `GapAnalysis` defined here is the *persisted*
 * summary shape used during intake — they are intentionally different and
 * should stay different.
 */

export interface GapAnalysis {
  overallFeasible: boolean;
  estimatedWeeks: number;
  phaseGaps: PhaseGap[];
  riskFactors: string[];
  accelerators: string[];
  recommendation?: string;
}

export interface PhaseGap {
  phaseId: number;
  phaseName: string;
  gapSize: "small" | "moderate" | "large" | "very_large";
  estimatedWeeks: number;
  strategy:
    | "analogy"
    | "first_principles"
    | "contrast"
    | "scaffolded"
    | "accelerated";
}

/**
 * A gap analysis persisted on an IntakeSession. Wraps the raw result with
 * metadata so we can evolve the inner shape without breaking reads.
 */
export interface GapAnalysisSnapshot {
  schemaVersion: 1;
  computedAt: string;
  /** Opaque hash of the inputs used to compute the result (for cache/drift detection). */
  inputsHash?: string;
  result: GapAnalysis;
}

/**
 * Normalise a stored value into the current `GapAnalysis` shape.
 *
 * Old records stored the raw `GapAnalysis` directly (no wrapper). New records
 * store a `GapAnalysisSnapshot`. This helper accepts either and returns the
 * inner `GapAnalysis`, so callers don't need to branch.
 */
export function unwrapGapAnalysisSnapshot(
  stored: GapAnalysisSnapshot | GapAnalysis | undefined,
): GapAnalysis | undefined {
  if (!stored) return undefined;
  if (
    typeof (stored as GapAnalysisSnapshot).schemaVersion === "number" &&
    (stored as GapAnalysisSnapshot).result
  ) {
    return (stored as GapAnalysisSnapshot).result;
  }
  return stored as GapAnalysis;
}

/**
 * Wrap a freshly-computed GapAnalysis in a snapshot ready to persist.
 */
export function toGapAnalysisSnapshot(
  result: GapAnalysis,
  opts: { inputsHash?: string; now?: Date } = {},
): GapAnalysisSnapshot {
  return {
    schemaVersion: 1,
    computedAt: (opts.now ?? new Date()).toISOString(),
    inputsHash: opts.inputsHash,
    result,
  };
}
