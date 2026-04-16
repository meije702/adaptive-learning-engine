import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import { assertEquals, assert } from "jsr:@std/assert";
import { createTestKv } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

describe("KvRetentionRepository", () => {
  let kv: Deno.Kv;
  let repos: Repositories;

  beforeEach(async () => {
    const t = await createTestKv();
    kv = t.kv;
    repos = t.repos;
  });

  afterEach(() => {
    kv.close();
  });

  describe("SM-2 logic", () => {
    it("should apply the correct multiplier (2.5) on a correct result", async () => {
      // First put creates with initial interval of 1
      const first = await repos.retention.put("domain-a", "correct");
      assertEquals(first.interval, Math.round(1 * 2.5)); // 3 (rounded from 2.5)
      assertEquals(first.lastResult, "correct");
    });

    it("should apply the partial multiplier (1.2) on a partial result", async () => {
      const result = await repos.retention.put("domain-a", "partial");
      assertEquals(result.interval, Math.round(1 * 1.2)); // 1 (rounded from 1.2)
      assertEquals(result.lastResult, "partial");
    });

    it("should reset interval to initial on an incorrect result", async () => {
      // Build up interval first
      await repos.retention.put("domain-a", "correct"); // interval -> 3
      await repos.retention.put("domain-a", "correct"); // interval -> 8

      const reset = await repos.retention.put("domain-a", "incorrect");
      assertEquals(reset.interval, 1); // reset to initial_interval_days
      assertEquals(reset.lastResult, "incorrect");
    });

    it("should cap interval at max_interval_days (60)", async () => {
      // Repeatedly mark correct to grow interval
      let schedule = await repos.retention.put("domain-a", "correct"); // 1 -> 3
      schedule = await repos.retention.put("domain-a", "correct"); // 3 -> 8
      schedule = await repos.retention.put("domain-a", "correct"); // 8 -> 20
      schedule = await repos.retention.put("domain-a", "correct"); // 20 -> 50
      schedule = await repos.retention.put("domain-a", "correct"); // 50 -> 60 (capped)

      assert(schedule.interval <= 60);
      assertEquals(schedule.interval, 60);
    });

    it("should increment streak on correct and reset on incorrect", async () => {
      let s = await repos.retention.put("domain-a", "correct");
      assertEquals(s.streak, 1);
      s = await repos.retention.put("domain-a", "correct");
      assertEquals(s.streak, 2);
      s = await repos.retention.put("domain-a", "correct");
      assertEquals(s.streak, 3);

      // Incorrect resets streak
      s = await repos.retention.put("domain-a", "incorrect");
      assertEquals(s.streak, 0);
    });

    it("should reset streak on partial result", async () => {
      await repos.retention.put("domain-a", "correct"); // streak 1
      const s = await repos.retention.put("domain-a", "partial");
      assertEquals(s.streak, 0);
    });
  });

  describe("getDue", () => {
    it("should return schedules whose nextDue is in the past", async () => {
      // Put a correct result — nextDue will be in the future
      await repos.retention.put("domain-a", "correct");

      // Manually set a schedule with nextDue in the past
      const pastDue = {
        domainId: "domain-b",
        nextDue: new Date(Date.now() - 86400000).toISOString(),
        interval: 1,
        streak: 0,
        lastResult: "correct" as const,
      };
      await kv.set(["retention", "domain-b"], pastDue);

      const due = await repos.retention.getDue();
      assertEquals(due.length, 1);
      assertEquals(due[0].domainId, "domain-b");
    });

    it("should return an empty array when nothing is due", async () => {
      // All schedules will have future nextDue
      await repos.retention.put("domain-a", "correct");
      const due = await repos.retention.getDue();
      assertEquals(due.length, 0);
    });
  });

  describe("recalculateAfterPause", () => {
    it("should reset interval when pause exceeds the current interval (long pause)", async () => {
      // Build up a schedule with interval > 1
      await repos.retention.put("domain-a", "correct"); // interval 3
      await repos.retention.put("domain-a", "correct"); // interval 8

      const updated = await repos.retention.recalculateAfterPause(10);
      assertEquals(updated, 1); // 1 schedule updated

      const schedule = await repos.retention.get("domain-a");
      assertEquals(schedule!.interval, 1); // reset to initial
      assertEquals(schedule!.streak, 0); // streak reset
    });

    it("should decay interval when pause is shorter than the current interval", async () => {
      // Build up a schedule with a large interval
      await repos.retention.put("domain-a", "correct"); // 3
      await repos.retention.put("domain-a", "correct"); // 8
      await repos.retention.put("domain-a", "correct"); // 20

      const scheduleBefore = await repos.retention.get("domain-a");
      const intervalBefore = scheduleBefore!.interval;

      // Pause shorter than the interval
      await repos.retention.recalculateAfterPause(5);

      const scheduleAfter = await repos.retention.get("domain-a");
      // Interval should be reduced but not to initial
      assert(scheduleAfter!.interval < intervalBefore);
      assert(scheduleAfter!.interval >= 1);
      // Streak should be preserved for short pause
      assert(scheduleAfter!.streak > 0);
    });

    it("should return 0 when there are no schedules to recalculate", async () => {
      const updated = await repos.retention.recalculateAfterPause(7);
      assertEquals(updated, 0);
    });
  });
});
