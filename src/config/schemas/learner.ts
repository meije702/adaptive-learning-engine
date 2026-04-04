import { z } from "zod";
import { ProficiencySchema } from "./common.ts";

const TechnologySchema = z.object({
  name: z.string(),
  proficiency: ProficiencySchema,
});

const DayTypeSchema = z.enum([
  "theory",
  "practice_guided",
  "practice_open",
  "practice_troubleshoot",
  "assessment",
  "review",
]);

export const LearnerConfigSchema = z.object({
  profile: z.object({
    name: z.string(),
    language: z.string(),
    timezone: z.string(),
  }),

  background: z.object({
    summary: z.string(),
    technologies: z.array(TechnologySchema),
  }),

  intake: z.object({
    completed: z.boolean(),
    completed_at: z.string().nullable(),
    result: z.unknown().nullable(),
  }),

  schedule: z.object({
    rest_day: z.number(),
    active_days: z.array(z.number()),
    day_plan: z.record(z.string(), DayTypeSchema),
    generation_time: z.string(),
    assessment_deadline_day: z.number(),
    assessment_deadline_time: z.string(),
    feedback_available_day: z.number(),
    feedback_available_time: z.string(),
    retention: z.object({
      enabled: z.boolean(),
      days: z.array(z.number()),
      questions_per_day: z.object({
        min: z.number(),
        max: z.number(),
      }),
    }),
  }),

  preferences: z.object({
    content_length: z.enum(["concise", "standard", "detailed"]),
    tone: z.enum(["formal", "collegial", "casual"]),
    show_bridges: z.boolean(),
    hints_enabled: z.boolean(),
    time_tracking: z.boolean(),
  }),
});

export type LearnerConfig = z.infer<typeof LearnerConfigSchema>;
