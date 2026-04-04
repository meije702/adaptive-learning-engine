import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { KvProgressRepository } from "./progress.ts";

Deno.test("KvProgressRepository - CRUD operations", async () => {
  const kv = await Deno.openKv(":memory:");
  const repo = new KvProgressRepository(kv);

  try {
    // Initially empty
    const all = await repo.getAll();
    assertEquals(all.length, 0);

    // Get non-existent returns null
    const missing = await repo.get("nonexistent");
    assertEquals(missing, null);

    // Put creates new progress
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

    // Get returns the created progress
    const fetched = await repo.get("container-fundamentals");
    assertNotEquals(fetched, null);
    assertEquals(fetched!.level, 2);

    // Put updates existing progress
    const updated = await repo.put("container-fundamentals", {
      level: 3,
      source: "retention",
    });
    assertEquals(updated.level, 3);
    assertEquals(updated.assessmentCount, 2);
    assertEquals(updated.history.length, 2);

    // GetAll returns all
    await repo.put("k8s-architecture", {
      level: 1,
      source: "manual",
    });
    const allAfter = await repo.getAll();
    assertEquals(allAfter.length, 2);
  } finally {
    kv.close();
  }
});
