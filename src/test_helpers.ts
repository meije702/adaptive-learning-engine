/**
 * Shared test helpers for the ALE BDD test suite.
 *
 * Provides in-memory KV setup, test config factories, and entity builders.
 */

import { createRepositories } from "./db/factory.ts";
import type { Repositories } from "./db/repositories.ts";
import type { AppConfig } from "./config/loader.ts";
import type {
  Answer,
  BaselineResult,
  CalibrationEntry,
  DayContent,
  Feedback,
  GapAnalysis,
  IntakeMessage,
  IntakeSession,
  LearnerState,
  Progress,
  Question,
  RetentionSchedule,
  WeekPlan,
} from "./db/types.ts";

// ── KV + Repos Setup ────────────────────────

export async function createTestKv(): Promise<
  { kv: Deno.Kv; repos: Repositories }
> {
  const kv = await Deno.openKv(":memory:");
  const config = createTestConfig();
  const repos = createRepositories(kv, config.system);
  return { kv, repos };
}

// ── Test Config ─────────────────────────────

export function createTestConfig(): AppConfig {
  return {
    system: {
      server: { port: 8000, base_url: "http://localhost:8000" },
      auth: { type: "none" },
      storage: { type: "deno-kv" },
      ai: {
        provider: "anthropic",
        model: "test-model",
        system_prompt_template: "Test prompt",
      },
      mcp: { transport: "stdio", path: "/mcp" },
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
          question_types: ["scenario", "open", "multiple_choice"],
          options_count: 4,
          passing_score: "partial",
        },
      },
      export: { enabled: false, format: "json", schedule: "manual" },
    },
    curriculum: {
      meta: {
        id: "test-curriculum",
        name: "Test Curriculum",
        version: "1.0.0",
        description: "A test curriculum",
        estimated_weeks: 8,
        language: "en",
      },
      bridge: {
        from: {
          label: "Existing knowledge",
          concepts: ["concept-a"],
          proficiency: "advanced",
        },
        to: {
          label: "Target knowledge",
          concepts: ["concept-b"],
          proficiency: "expert",
        },
      },
      levels: [
        {
          id: 0,
          label: "Unknown",
          description: "Not assessed",
          assessment_type: null,
        },
        {
          id: 1,
          label: "Conceptual",
          description: "Can explain",
          assessment_type: "theory",
        },
        {
          id: 2,
          label: "Understanding",
          description: "Can relate",
          assessment_type: "comparison",
        },
        {
          id: 3,
          label: "Application",
          description: "Can apply",
          assessment_type: "guided_practice",
        },
        {
          id: 4,
          label: "Independent",
          description: "Can do alone",
          assessment_type: "open_scenario",
        },
        {
          id: 5,
          label: "Expert",
          description: "Can teach",
          assessment_type: "architecture",
        },
      ],
      phases: [
        {
          id: 1,
          name: "Fundamentals",
          description: "Basic concepts",
          bridge: {
            from: {
              label: "Prior knowledge",
              concepts: ["basics"],
              proficiency: "expert",
            },
            to: {
              label: "Foundation",
              concepts: ["core-a", "core-b"],
              proficiency: "intermediate",
            },
          },
        },
        {
          id: 2,
          name: "Advanced",
          description: "Advanced topics",
          bridge: {
            from: {
              label: "Foundation",
              concepts: ["core-a", "core-b"],
              proficiency: "intermediate",
            },
            to: {
              label: "Mastery",
              concepts: ["adv-a", "adv-b"],
              proficiency: "advanced",
            },
          },
        },
      ],
      domains: [
        {
          id: "domain-a",
          name: "Domain A",
          phase: 1,
          week: 1,
          tags: ["tag-a"],
          prerequisites: [],
          bridge: {
            from: {
              label: "Known A",
              concepts: ["existing-a"],
              proficiency: "expert",
            },
            to: {
              label: "Target A",
              concepts: ["new-a"],
              proficiency: "intermediate",
            },
          },
          key_concepts: ["concept-1", "concept-2"],
          resources: [],
        },
        {
          id: "domain-b",
          name: "Domain B",
          phase: 1,
          week: 2,
          tags: ["tag-b"],
          prerequisites: ["domain-a"],
          bridge: {
            from: {
              label: "Known B",
              concepts: ["existing-b"],
              proficiency: "advanced",
            },
            to: {
              label: "Target B",
              concepts: ["new-b"],
              proficiency: "intermediate",
            },
          },
          key_concepts: ["concept-3"],
          resources: [],
        },
        {
          id: "domain-c",
          name: "Domain C",
          phase: 2,
          week: 3,
          tags: ["tag-c"],
          prerequisites: ["domain-a", "domain-b"],
          bridge: {
            from: null,
            to: {
              label: "Target C",
              concepts: ["new-c"],
              proficiency: "advanced",
            },
          },
          key_concepts: ["concept-4"],
          resources: [],
        },
        {
          id: "domain-d",
          name: "Domain D",
          phase: 2,
          week: 4,
          tags: ["tag-d"],
          prerequisites: [],
          bridge: {
            from: {
              label: "Known D",
              concepts: ["existing-d"],
              proficiency: "intermediate",
            },
            to: {
              label: "Target D",
              concepts: ["new-d"],
              proficiency: "advanced",
            },
          },
          key_concepts: ["concept-5"],
          resources: [],
        },
      ],
      stretch: { frequency: 4, domains: [] },
    },
    learner: {
      profile: { name: "Test Learner", language: "en", timezone: "UTC" },
      background: {
        summary: "Test background",
        technologies: [
          { name: "TypeScript", proficiency: "expert" },
        ],
      },
      intake: { completed: false, completed_at: null, result: null },
      schedule: {
        rest_day: 0,
        active_days: [1, 2, 3, 4, 5, 6],
        day_plan: {
          "1": "theory",
          "2": "practice_guided",
          "3": "practice_open",
          "4": "practice_troubleshoot",
          "5": "assessment",
          "6": "review",
        },
        generation_time: "22:00",
        assessment_deadline_day: 6,
        assessment_deadline_time: "20:00",
        feedback_available_day: 6,
        feedback_available_time: "22:00",
        retention: {
          enabled: true,
          days: [1, 2, 3, 4, 5, 6],
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
    },
  };
}

// ── Entity Builders ─────────────────────────

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

export function buildProgress(
  overrides?: Partial<Progress>,
): Progress {
  return {
    domainId: "domain-a",
    level: 2,
    lastAssessedAt: now(),
    assessmentCount: 1,
    history: [{
      level: 2,
      assessedAt: now(),
      source: "assessment",
    }],
    ...overrides,
  };
}

export function buildWeekPlan(
  overrides?: Partial<WeekPlan>,
): WeekPlan {
  return {
    weekNumber: 1,
    domainId: "domain-a",
    isStretchWeek: false,
    createdAt: now(),
    summary: "Test week summary",
    ...overrides,
  };
}

export function buildDayContent(
  overrides?: Partial<DayContent>,
): DayContent {
  return {
    id: uuid(),
    weekNumber: 1,
    dayOfWeek: 1,
    type: "theory",
    domainId: "domain-a",
    title: "Test day",
    body: "Test body content",
    createdAt: now(),
    ...overrides,
  };
}

export function buildQuestion(
  overrides?: Partial<Question>,
): Question {
  return {
    id: uuid(),
    dayContentId: uuid(),
    domainId: "domain-a",
    sequence: 1,
    type: "open",
    body: "Test question?",
    maxLevel: 3,
    deadline: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

export function buildAnswer(
  overrides?: Partial<Answer>,
): Answer {
  return {
    id: uuid(),
    questionId: uuid(),
    body: "Test answer",
    submittedAt: now(),
    ...overrides,
  };
}

export function buildFeedback(
  overrides?: Partial<Feedback>,
): Feedback {
  return {
    id: uuid(),
    answerId: uuid(),
    questionId: uuid(),
    score: "correct",
    explanation: "Well done",
    suggestedLevel: 3,
    levelApplied: false,
    improvements: [],
    createdAt: now(),
    ...overrides,
  };
}

export function buildRetentionSchedule(
  overrides?: Partial<RetentionSchedule>,
): RetentionSchedule {
  return {
    domainId: "domain-a",
    nextDue: new Date(Date.now() - 86400000).toISOString(), // yesterday = due
    interval: 1,
    streak: 0,
    lastResult: "correct",
    ...overrides,
  };
}

export function buildIntakeSession(
  overrides?: Partial<IntakeSession>,
): IntakeSession {
  return {
    id: uuid(),
    status: "goal_validation",
    startedAt: now(),
    baselineResults: [],
    ...overrides,
  };
}

export function buildCalibrationEntry(
  overrides?: Partial<CalibrationEntry>,
): CalibrationEntry {
  return {
    id: uuid(),
    questionId: uuid(),
    domainId: "domain-a",
    predictedScore: "correct",
    actualScore: "correct",
    delta: 0,
    createdAt: now(),
    ...overrides,
  };
}

export function buildIntakeMessage(
  overrides?: Partial<IntakeMessage>,
): IntakeMessage {
  return {
    id: uuid(),
    role: "agent",
    content: "Test message",
    timestamp: now(),
    phase: "goal_validation",
    ...overrides,
  };
}

export function buildLearnerState(
  overrides?: Partial<LearnerState>,
): LearnerState {
  return {
    intake: { completed: false },
    wellbeing: { status: "active" },
    ...overrides,
  };
}

export function buildBaselineResult(
  overrides?: Partial<BaselineResult>,
): BaselineResult {
  return {
    phaseId: 1,
    questionId: uuid(),
    question: "Baseline question?",
    answer: "Baseline answer",
    suggestedLevel: 2,
    ...overrides,
  };
}

export function buildGapAnalysis(
  overrides?: Partial<GapAnalysis>,
): GapAnalysis {
  return {
    overallFeasible: true,
    estimatedWeeks: 8,
    phaseGaps: [
      {
        phaseId: 1,
        phaseName: "Fundamentals",
        gapSize: "moderate",
        estimatedWeeks: 4,
        strategy: "analogy",
      },
    ],
    riskFactors: [],
    accelerators: [],
    ...overrides,
  };
}
