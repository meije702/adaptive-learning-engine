import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertMatch } from "@std/assert";
import { log } from "./logger.ts";
import { withCorrelationId } from "./correlation.ts";

function captureStderr(fn: () => void | Promise<void>): Promise<string[]> {
  const original = console.error;
  const lines: string[] = [];
  console.error = (msg?: unknown) => {
    lines.push(typeof msg === "string" ? msg : String(msg));
  };
  const result = fn();
  const finish = () => {
    console.error = original;
    return lines;
  };
  return result instanceof Promise
    ? result.then(finish)
    : Promise.resolve(finish());
}

describe("log", () => {
  it("emits JSON lines with ts, level, event", async () => {
    const lines = await captureStderr(() => {
      log.info("test_event", { foo: "bar" });
    });
    assertEquals(lines.length, 1);
    const parsed = JSON.parse(lines[0]);
    assertEquals(parsed.level, "info");
    assertEquals(parsed.event, "test_event");
    assertEquals(parsed.foo, "bar");
    assertMatch(parsed.ts, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("attaches correlationId when one is in scope", async () => {
    const lines = await captureStderr(async () => {
      await withCorrelationId("corr-123", () => {
        log.info("scoped");
      });
    });
    const parsed = JSON.parse(lines[0]);
    assertEquals(parsed.correlationId, "corr-123");
  });

  it("omits correlationId when none is in scope", async () => {
    const lines = await captureStderr(() => {
      log.warn("unscoped");
    });
    const parsed = JSON.parse(lines[0]);
    assertEquals(parsed.correlationId, undefined);
    assertEquals(parsed.level, "warn");
  });
});
