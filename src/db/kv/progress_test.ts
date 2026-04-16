import { assertEquals, assertNotEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { KvProgressRepository } from "./progress.ts";
import { createTestKv } from "@/test_helpers.ts";

describe("KvProgressRepository", () => {
  let kv: Deno.Kv;
  let repo: KvProgressRepository;

  beforeEach(async () => {
    const testKv = await createTestKv();
    kv = testKv.kv;
    repo = testKv.repos.progress as KvProgressRepository;
  });

  afterEach(() => {
    kv.close();
  });

  it("should return empty array when no progress exists", async () => {
    const all = await repo.getAll();
    assertEquals(all.length, 0);
  });

  it("should return null for non-existent domain", async () => {
    const missing = await repo.get("nonexistent");
    assertEquals(missing, null);
  });

  it("should create new progress via put", async () => {
    const created = await repo.put("container-fundamentals", {
      level: 2,
      source: "assessment",
      notes: "Good understanding",
    });
    assertEquals(created.domainId, "container-fundamentals");
    assertEquals(created.level, 2);
    assertEquals(created.assessmentCount, 1);
    assertEquals(created.history.length, 1);
    assertEquals(created.history[0].source, "assessment");
    assertEquals(created.history[0].notes, "Good understanding");
  });

  it("should retrieve created progress via get", async () => {
    await repo.put("container-fundamentals", {
      level: 2,
      source: "assessment",
      notes: "Good understanding",
    });

    const fetched = await repo.get("container-fundamentals");
    assertNotEquals(fetched, null);
    assertEquals(fetched!.level, 2);
  });

  it("should update existing progress via put", async () => {
    await repo.put("container-fundamentals", {
      level: 2,
      source: "assessment",
    });

    const updated = await repo.put("container-fundamentals", {
      level: 3,
      source: "retention",
    });
    assertEquals(updated.level, 3);
    assertEquals(updated.assessmentCount, 2);
    assertEquals(updated.history.length, 2);
  });

  it("should return all progress entries via getAll", async () => {
    await repo.put("container-fundamentals", {
      level: 2,
      source: "assessment",
    });
    await repo.put("k8s-architecture", {
      level: 1,
      source: "manual",
    });

    const allAfter = await repo.getAll();
    assertEquals(allAfter.length, 2);
  });
});
