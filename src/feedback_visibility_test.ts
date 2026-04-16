import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { isFeedbackVisible } from "./feedback_visibility.ts";
import { createTestConfig } from "./test_helpers.ts";

describe("isFeedbackVisible", () => {
  it("returns false for assessments before the release time", () => {
    const schedule = createTestConfig().learner.schedule;
    const now = new Date("2026-04-17T20:00:00");

    assertEquals(isFeedbackVisible(schedule, "assessment", now), false);
  });

  it("returns true for assessments after the release time", () => {
    const schedule = createTestConfig().learner.schedule;
    const now = new Date("2026-04-18T23:00:00");

    assertEquals(isFeedbackVisible(schedule, "assessment", now), true);
  });

  it("returns true for non-assessment content", () => {
    const schedule = createTestConfig().learner.schedule;
    const now = new Date("2026-04-17T20:00:00");

    assertEquals(isFeedbackVisible(schedule, "theory", now), true);
  });
});
