import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { SystemConfigSchema } from "./system.ts";

describe("SystemConfigSchema", () => {
  it("should reject invalid auth type", () => {
    const result = SystemConfigSchema.safeParse({
      server: { port: 8000, base_url: "http://localhost" },
      auth: { type: "oauth" },
      storage: { type: "deno-kv" },
      ai: { provider: "anthropic", model: "test", system_prompt_template: "" },
      mcp: { transport: "sse", path: "/mcp" },
      retention: {
        initial_interval_days: 1,
        multiplier_correct: 2.5,
        multiplier_partial: 1.2,
        multiplier_incorrect: 0,
        max_interval_days: 60,
      },
      content: {
        max_length: {
          theory: 600,
          practice: 400,
          assessment: 500,
          retention_question: 50,
          feedback: 300,
        },
        assessment: {
          question_types: ["scenario"],
          options_count: 4,
          passing_score: "partial",
        },
      },
      export: { enabled: true, format: "json", schedule: "weekly" },
    });

    assertEquals(result.success, false);
  });

  it("should reject missing server field", () => {
    const result = SystemConfigSchema.safeParse({
      auth: { type: "bearer" },
    });

    assertEquals(result.success, false);
  });

  it("should accept valid config", () => {
    const result = SystemConfigSchema.safeParse({
      server: { port: 8000, base_url: "http://localhost" },
      auth: { type: "none" },
      storage: { type: "deno-kv" },
      ai: { provider: "anthropic", model: "test", system_prompt_template: "t" },
      mcp: { transport: "sse", path: "/mcp" },
      retention: {
        initial_interval_days: 1,
        multiplier_correct: 2.5,
        multiplier_partial: 1.2,
        multiplier_incorrect: 0,
        max_interval_days: 60,
        min_domains_per_session: 2,
      },
      content: {
        cognitive_budget: 4,
        max_length: {
          theory: 600,
          practice: 400,
          assessment: 500,
          retention_question: 50,
          feedback: 300,
        },
        assessment: {
          question_types: ["scenario"],
          options_count: 4,
          passing_score: "partial",
        },
      },
      export: { enabled: true, format: "json", schedule: "weekly" },
    });

    assertEquals(result.success, true);
  });
});
