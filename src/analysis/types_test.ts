import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import {
  type GapAnalysis,
  toGapAnalysisSnapshot,
  unwrapGapAnalysisSnapshot,
} from "./types.ts";

const SAMPLE: GapAnalysis = {
  overallFeasible: true,
  estimatedWeeks: 8,
  phaseGaps: [],
  riskFactors: [],
  accelerators: [],
};

describe("toGapAnalysisSnapshot", () => {
  it("wraps with schemaVersion 1 and a computedAt timestamp", () => {
    const now = new Date("2026-04-16T09:00:00.000Z");
    const snap = toGapAnalysisSnapshot(SAMPLE, { now });
    assertEquals(snap.schemaVersion, 1);
    assertEquals(snap.computedAt, "2026-04-16T09:00:00.000Z");
    assertEquals(snap.result, SAMPLE);
  });

  it("passes inputsHash through when provided", () => {
    const snap = toGapAnalysisSnapshot(SAMPLE, { inputsHash: "abc" });
    assertEquals(snap.inputsHash, "abc");
  });
});

describe("unwrapGapAnalysisSnapshot", () => {
  it("returns undefined for undefined input", () => {
    assertEquals(unwrapGapAnalysisSnapshot(undefined), undefined);
  });

  it("unwraps a new-format snapshot", () => {
    const snap = toGapAnalysisSnapshot(SAMPLE);
    assertEquals(unwrapGapAnalysisSnapshot(snap), SAMPLE);
  });

  it("passes old-format raw GapAnalysis through unchanged", () => {
    assertEquals(unwrapGapAnalysisSnapshot(SAMPLE), SAMPLE);
  });
});
