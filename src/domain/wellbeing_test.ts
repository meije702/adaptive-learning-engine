import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { applyWellbeingTransition } from "./wellbeing.ts";

describe("applyWellbeingTransition", () => {
  const NOW = "2026-04-16T10:00:00.000Z";

  it("stamps pausedAt when transitioning to paused, preserves returnedAt", () => {
    const result = applyWellbeingTransition(
      { status: "active", returnedAt: "2026-04-01T00:00:00.000Z" },
      "paused",
      NOW,
    );
    assertEquals(result.status, "paused");
    assertEquals(result.pausedAt, NOW);
    assertEquals(result.returnedAt, "2026-04-01T00:00:00.000Z");
  });

  it("stamps returnedAt on returning, preserves pausedAt", () => {
    const result = applyWellbeingTransition(
      { status: "paused", pausedAt: "2026-04-05T00:00:00.000Z" },
      "returning",
      NOW,
    );
    assertEquals(result.status, "returning");
    assertEquals(result.returnedAt, NOW);
    assertEquals(result.pausedAt, "2026-04-05T00:00:00.000Z");
  });

  it("stamps returnedAt on active transition (normalises the full return flow)", () => {
    const result = applyWellbeingTransition(
      { status: "returning", pausedAt: "2026-04-05T00:00:00.000Z" },
      "active",
      NOW,
    );
    assertEquals(result.status, "active");
    assertEquals(result.returnedAt, NOW);
    assertEquals(result.pausedAt, "2026-04-05T00:00:00.000Z");
  });

  it("works with no prior wellbeing state", () => {
    const result = applyWellbeingTransition(undefined, "paused", NOW);
    assertEquals(result.status, "paused");
    assertEquals(result.pausedAt, NOW);
    assertEquals(result.returnedAt, undefined);
  });
});
