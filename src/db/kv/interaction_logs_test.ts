import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { createTestKv } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

describe("KvInteractionLogRepository", () => {
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
    it("should return null when no log exists for the day content id", async () => {
      const log = await repos.interactionLogs.get("nonexistent-day");
      assertEquals(log, null);
    });
  });

  describe("put / get", () => {
    it("should store and retrieve an interaction log", async () => {
      const log = {
        events: [
          {
            type: "click",
            target: "hint-button",
            timestamp: "2026-01-15T10:00:00Z",
          },
          {
            type: "submit",
            target: "answer-form",
            timestamp: "2026-01-15T10:05:00Z",
          },
        ],
        duration: 300,
      };

      await repos.interactionLogs.put("day-1", log);
      const fetched = await repos.interactionLogs.get("day-1");

      assertEquals(fetched, log);
    });
  });

  describe("overwrite", () => {
    it("should overwrite an existing log for the same day content id", async () => {
      const first = { events: [{ type: "start" }], duration: 60 };
      const second = {
        events: [{ type: "start" }, { type: "complete" }],
        duration: 180,
      };

      await repos.interactionLogs.put("day-1", first);
      await repos.interactionLogs.put("day-1", second);

      const fetched = await repos.interactionLogs.get("day-1");
      assertEquals(fetched, second);
    });
  });
});
