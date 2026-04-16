import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assertNotEquals } from "@std/assert";
import { buildLearnerState, createTestKv } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

describe("KvLearnerStateRepository", () => {
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

    describe("get", () => {
        it("should return null when no state has been stored", async () => {
            const state = await repos.learnerState.get();
            assertEquals(state, null);
        });
    });

    describe("put / get", () => {
        it("should store and retrieve learner state", async () => {
            const state = buildLearnerState({
                intake: { completed: true, completedAt: "2026-01-15T10:00:00Z" },
                wellbeing: { status: "active" },
            });

            await repos.learnerState.put(state);
            const fetched = await repos.learnerState.get();

            assertNotEquals(fetched, null);
            assertEquals(fetched!.intake.completed, true);
            assertEquals(fetched!.intake.completedAt, "2026-01-15T10:00:00Z");
            assertEquals(fetched!.wellbeing.status, "active");
        });

        it("should overwrite previous state", async () => {
            await repos.learnerState.put(buildLearnerState({
                wellbeing: { status: "active" },
            }));

            await repos.learnerState.put(buildLearnerState({
                wellbeing: { status: "paused", pausedAt: "2026-03-01T12:00:00Z" },
            }));

            const fetched = await repos.learnerState.get();
            assertEquals(fetched!.wellbeing.status, "paused");
            assertEquals(fetched!.wellbeing.pausedAt, "2026-03-01T12:00:00Z");
        });
    });
});
