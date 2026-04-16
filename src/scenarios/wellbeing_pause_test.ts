import { assertEquals, assertExists } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { createTestKv } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

describe("Scenario: Wellbeing pause/return lifecycle", () => {
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

    it("handles pause → return → recalculate → active cycle", async () => {
        // Step 1: Seed retention schedules for 2 domains
        // domain-a: interval 7 (short)
        // domain-b: interval 30 (long)
        const futureDate = new Date(Date.now() + 86400000 * 7).toISOString();

        await kv.set(["retention", "domain-a"], {
            domainId: "domain-a",
            nextDue: futureDate,
            interval: 7,
            streak: 3,
            lastResult: "correct",
        });
        await kv.set(["retention", "domain-b"], {
            domainId: "domain-b",
            nextDue: futureDate,
            interval: 30,
            streak: 5,
            lastResult: "correct",
        });

        // Step 2: Set wellbeing to paused, verify pausedAt
        const pausedAt = new Date().toISOString();
        await repos.learnerState.put({
            intake: { completed: true },
            wellbeing: { status: "paused", pausedAt },
        });

        const paused = await repos.learnerState.get();
        assertExists(paused);
        assertEquals(paused.wellbeing.status, "paused");
        assertExists(paused.wellbeing.pausedAt);

        // Step 3: Set wellbeing to returning with simulated 10-day pause
        const returnedAt = new Date().toISOString();
        await repos.learnerState.put({
            intake: { completed: true },
            wellbeing: { status: "returning", pausedAt, returnedAt },
        });

        const returning = await repos.learnerState.get();
        assertExists(returning);
        assertEquals(returning.wellbeing.status, "returning");

        // Step 4: Recalculate retention with 10-day pause
        const pauseDays = 10;
        const recalculated = await repos.retention.recalculateAfterPause(pauseDays);
        assertEquals(recalculated, 2);

        // Domain A (interval=7): 10 >= 7 → reset to initial interval (1), streak reset to 0
        const retA = await repos.retention.get("domain-a");
        assertExists(retA);
        assertEquals(retA.interval, 1); // Reset because pauseDays (10) >= interval (7)
        assertEquals(retA.streak, 0);

        // Domain B (interval=30): 10 < 30 → decayed but not reset
        const retB = await repos.retention.get("domain-b");
        assertExists(retB);
        assertEquals(retB.interval > 1, true); // Should have decayed but not fully reset
        assertEquals(retB.interval < 30, true); // Should be less than original
        assertEquals(retB.streak, 5); // Streak preserved because pauseDays < interval

        // Step 5: Set back to active
        await repos.learnerState.put({
            intake: { completed: true },
            wellbeing: { status: "active", pausedAt, returnedAt },
        });

        const active = await repos.learnerState.get();
        assertExists(active);
        assertEquals(active.wellbeing.status, "active");
    });
});
