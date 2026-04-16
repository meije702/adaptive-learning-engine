import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertNotEquals } from "@std/assert";
import {
  getCorrelationId,
  newCorrelationId,
  withCorrelationId,
} from "./correlation.ts";

describe("correlation", () => {
  it("returns undefined outside any context", () => {
    assertEquals(getCorrelationId(), undefined);
  });

  it("propagates correlation id through async awaits", async () => {
    const id = newCorrelationId();
    await withCorrelationId(id, async () => {
      assertEquals(getCorrelationId(), id);
      await new Promise((r) => setTimeout(r, 1));
      assertEquals(getCorrelationId(), id);
    });
  });

  it("isolates nested contexts", async () => {
    const outer = newCorrelationId();
    const inner = newCorrelationId();
    assertNotEquals(outer, inner);
    await withCorrelationId(outer, async () => {
      assertEquals(getCorrelationId(), outer);
      await withCorrelationId(inner, () => {
        assertEquals(getCorrelationId(), inner);
        return Promise.resolve();
      });
      assertEquals(getCorrelationId(), outer);
    });
  });

  it("generates unique ids", () => {
    const a = newCorrelationId();
    const b = newCorrelationId();
    assertNotEquals(a, b);
  });
});
