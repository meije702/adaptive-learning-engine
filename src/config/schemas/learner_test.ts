import { assertEquals } from "jsr:@std/assert";
import { LearnerConfigSchema } from "./learner.ts";

const validMinimal = {
  profile: {
    name: "Test",
    language: "en",
    timezone: "UTC",
  },
  background: {
    summary: "Developer",
    technologies: [{ name: "TypeScript", proficiency: "expert" }],
  },
  intake: {
    completed: false,
    completed_at: null,
    result: null,
  },
  schedule: {
    rest_day: 0,
    active_days: [1, 2, 3, 4, 5],
    day_plan: { "1": "theory", "2": "practice_guided" },
    generation_time: "22:00",
    assessment_deadline_day: 5,
    assessment_deadline_time: "20:00",
    feedback_available_day: 5,
    feedback_available_time: "22:00",
    retention: {
      enabled: true,
      days: [1, 2, 3],
      questions_per_day: { min: 1, max: 3 },
    },
  },
  preferences: {
    content_length: "concise",
    tone: "collegial",
    show_bridges: true,
    hints_enabled: true,
    time_tracking: false,
  },
};

Deno.test("LearnerConfigSchema - accepts valid config", () => {
  const result = LearnerConfigSchema.safeParse(validMinimal);
  assertEquals(result.success, true);
});

Deno.test("LearnerConfigSchema - rejects invalid tone", () => {
  const invalid = {
    ...validMinimal,
    preferences: { ...validMinimal.preferences, tone: "aggressive" },
  };
  const result = LearnerConfigSchema.safeParse(invalid);
  assertEquals(result.success, false);
});

Deno.test("LearnerConfigSchema - rejects invalid proficiency in technologies", () => {
  const invalid = {
    ...validMinimal,
    background: {
      ...validMinimal.background,
      technologies: [{ name: "Go", proficiency: "godlike" }],
    },
  };
  const result = LearnerConfigSchema.safeParse(invalid);
  assertEquals(result.success, false);
});

Deno.test("LearnerConfigSchema - rejects invalid day type in day_plan", () => {
  const invalid = {
    ...validMinimal,
    schedule: {
      ...validMinimal.schedule,
      day_plan: { "1": "meditation" },
    },
  };
  const result = LearnerConfigSchema.safeParse(invalid);
  assertEquals(result.success, false);
});
