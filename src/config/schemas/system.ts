import { z } from "zod";

export const SystemConfigSchema = z.object({
  server: z.object({
    port: z.number(),
    base_url: z.string(),
  }),

  auth: z.object({
    type: z.enum(["bearer", "none"]),
  }),

  storage: z.object({
    type: z.enum(["deno-kv", "sqlite", "postgres"]),
  }),

  ai: z.object({
    provider: z.enum(["anthropic", "openai", "local"]),
    model: z.string(),
    system_prompt_template: z.string(),
  }),

  mcp: z.object({
    transport: z.enum(["sse", "stdio"]),
    path: z.string(),
  }),

  retention: z.object({
    initial_interval_days: z.number(),
    multiplier_correct: z.number(),
    multiplier_partial: z.number(),
    multiplier_incorrect: z.number(),
    max_interval_days: z.number(),
    min_domains_per_session: z.number(),
  }),

  content: z.object({
    cognitive_budget: z.number(),
    max_length: z.object({
      theory: z.number(),
      practice: z.number(),
      assessment: z.number(),
      retention_question: z.number(),
      feedback: z.number(),
    }),
    assessment: z.object({
      question_types: z.array(z.string()),
      options_count: z.number(),
      passing_score: z.string(),
    }),
  }),

  export: z.object({
    enabled: z.boolean(),
    format: z.enum(["json", "markdown"]),
    schedule: z.enum(["daily", "weekly", "manual"]),
  }),
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;
