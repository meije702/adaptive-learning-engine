import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import {
  decayAfterPause,
  DEFAULT_RETENTION_CONFIG,
  initialSchedule,
  nextScheduleAfterReview,
  retentionConfigFromSystem,
} from "./spaced_repetition.ts";
import type { RetentionSchedule } from "../db/types.ts";

const NOW = new Date("2026-04-16T12:00:00.000Z");

function sched(overrides: Partial<RetentionSchedule> = {}): RetentionSchedule {
  return {
    domainId: "dom",
    nextDue: "2026-04-15T00:00:00.000Z",
    interval: 4,
    streak: 1,
    lastResult: "correct",
    ...overrides,
  };
}

describe("retentionConfigFromSystem", () => {
  it("returns defaults when undefined", () => {
    assertEquals(
      retentionConfigFromSystem(undefined),
      DEFAULT_RETENTION_CONFIG,
    );
  });

  it("normalises snake_case to camelCase", () => {
    const normalised = retentionConfigFromSystem({
      initial_interval_days: 2,
      multiplier_correct: 3,
      multiplier_partial: 1.5,
      multiplier_incorrect: 0,
      max_interval_days: 90,
    });
    assertEquals(normalised.initialIntervalDays, 2);
    assertEquals(normalised.multiplierCorrect, 3);
    assertEquals(normalised.maxIntervalDays, 90);
  });
});

describe("initialSchedule", () => {
  it("builds a schedule due now with initial interval", () => {
    const s = initialSchedule("dom-x", DEFAULT_RETENTION_CONFIG, NOW);
    assertEquals(s.domainId, "dom-x");
    assertEquals(s.interval, 1);
    assertEquals(s.streak, 0);
    assertEquals(s.lastResult, "incorrect");
    assertEquals(s.nextDue, NOW.toISOString());
  });
});

describe("nextScheduleAfterReview", () => {
  it("correct: multiplies interval, increments streak, respects cap", () => {
    const s = nextScheduleAfterReview(
      sched({ interval: 10, streak: 3 }),
      "correct",
      DEFAULT_RETENTION_CONFIG,
      NOW,
    );
    assertEquals(s.interval, 25); // 10 * 2.5
    assertEquals(s.streak, 4);
    assertEquals(s.lastResult, "correct");
  });

  it("correct: caps at maxIntervalDays", () => {
    const s = nextScheduleAfterReview(
      sched({ interval: 40 }),
      "correct",
      DEFAULT_RETENTION_CONFIG,
      NOW,
    );
    assertEquals(s.interval, 60); // 40 * 2.5 = 100, capped to 60
  });

  it("partial: lower multiplier, resets streak", () => {
    const s = nextScheduleAfterReview(
      sched({ interval: 10, streak: 5 }),
      "partial",
      DEFAULT_RETENTION_CONFIG,
      NOW,
    );
    assertEquals(s.interval, 12); // 10 * 1.2
    assertEquals(s.streak, 0);
  });

  it("incorrect: resets interval and streak", () => {
    const s = nextScheduleAfterReview(
      sched({ interval: 30, streak: 10 }),
      "incorrect",
      DEFAULT_RETENTION_CONFIG,
      NOW,
    );
    assertEquals(s.interval, 1);
    assertEquals(s.streak, 0);
    assertEquals(s.lastResult, "incorrect");
  });

  it("advances nextDue by the new interval", () => {
    const s = nextScheduleAfterReview(
      sched({ interval: 4 }),
      "correct",
      DEFAULT_RETENTION_CONFIG,
      NOW,
    );
    // 4 * 2.5 = 10 days after NOW
    const expected = new Date(NOW);
    expected.setDate(expected.getDate() + 10);
    assertEquals(s.nextDue, expected.toISOString());
  });
});

describe("decayAfterPause", () => {
  it("resets when pauseDays >= interval", () => {
    const s = decayAfterPause(
      sched({ interval: 10, streak: 5 }),
      10,
      DEFAULT_RETENTION_CONFIG,
      NOW,
    );
    assertEquals(s.interval, 1);
    assertEquals(s.streak, 0);
    assertEquals(s.nextDue, NOW.toISOString());
  });

  it("decays proportionally when pauseDays < interval", () => {
    const s = decayAfterPause(
      sched({ interval: 20, streak: 3 }),
      5,
      DEFAULT_RETENTION_CONFIG,
      NOW,
    );
    // 20 / (1 + 5/20) = 20 / 1.25 = 16
    assertEquals(s.interval, 16);
    assertEquals(s.streak, 3); // preserved
    assertEquals(s.nextDue, NOW.toISOString());
  });

  it("never decays below initial interval", () => {
    const s = decayAfterPause(
      sched({ interval: 2 }),
      1,
      DEFAULT_RETENTION_CONFIG,
      NOW,
    );
    // 2 / (1 + 1/2) = 2 / 1.5 ≈ 1.33 → rounded to 1 (== initial)
    assertEquals(s.interval >= 1, true);
  });
});
