// Entity types from ADR-001

// Gap-analysis shapes live in src/analysis/types.ts (they are computation
// outputs, not persistent entities). Re-exported here for back-compat with
// any external code that still imports them from db/types.
export type {
  GapAnalysis,
  GapAnalysisSnapshot,
  PhaseGap,
} from "../analysis/types.ts";
import type { GapAnalysis, GapAnalysisSnapshot } from "../analysis/types.ts";

// Theme shapes live in design/. Re-exported here for ergonomic imports
// from the db layer's consumers.
import type { ThemePresetId } from "../config/schemas/theme.ts";
import type { Theme } from "../design/themes/types.ts";
import type { DeepPartial } from "../design/themes/merge.ts";
export type { ThemePresetId } from "../config/schemas/theme.ts";

export interface ProgressEntry {
  level: number;
  assessedAt: string;
  source: "assessment" | "retention" | "manual";
  notes?: string;
}

export interface Progress {
  domainId: string;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  lastAssessedAt: string;
  assessmentCount: number;
  history: ProgressEntry[];
}

export interface WeekPlan {
  weekNumber: number;
  domainId: string;
  isStretchWeek: boolean;
  createdAt: string;
  summary: string;
  retrospective?: string;
}

export type DayType =
  | "theory"
  | "practice_guided"
  | "practice_open"
  | "practice_troubleshoot"
  | "assessment"
  | "review"
  | "retention";

export interface DayContent {
  id: string;
  weekNumber: number;
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6;
  type: DayType;
  domainId: string;
  title: string;
  body: string;
  /**
   * A SceneDocumentSnapshot ({ schemaVersion: 1, document }) — see
   * src/scrim/snapshot.ts. Records written before the wrapper existed
   * stored the raw SceneDocument directly; readers should call
   * `unwrapSceneDocument` to handle either shape.
   */
  sceneDocument?: unknown;
  createdAt: string;
  basedOn?: string[];
}

export interface QuestionOption {
  key: "A" | "B" | "C" | "D";
  text: string;
  isOptimal: boolean;
}

export type MetacognitiveType = "forethought" | "monitoring" | "reflection";

export interface Question {
  id: string;
  dayContentId: string;
  domainId: string;
  sequence: number;
  type: "scenario" | "open" | "multiple_choice" | "troubleshoot";
  body: string;
  options?: QuestionOption[];
  hints?: string[];
  maxLevel: number;
  deadline: string;
  /** Maps this question to a Scrim challenge checkpoint for evaluator bridging. */
  scrimCheckpoint?: string;
  /** Metacognitive scaffolding type, if this question serves a metacognitive purpose. */
  metacognitiveType?: MetacognitiveType;
}

export interface Answer {
  id: string;
  questionId: string;
  body: string;
  submittedAt: string;
  timeSpentSeconds?: number;
}

export type FeedbackLevel = "task" | "process" | "self_regulation";

export interface Feedback {
  id: string;
  answerId: string;
  questionId: string;
  score: "correct" | "partial" | "incorrect";
  explanation: string;
  suggestedLevel: number;
  levelApplied: boolean;
  improvements: string[];
  /** Where is the learner heading? Connects to their goal. */
  feedUp?: string;
  /** How did they do? Specific, evidence-based. */
  feedBack?: string;
  /** What should they do next? Concrete and actionable. */
  feedForward?: string;
  /** Target the highest impactful level: task < process < self_regulation. */
  feedbackLevel?: FeedbackLevel;
  createdAt: string;
}

export interface RetentionSchedule {
  domainId: string;
  nextDue: string;
  interval: number;
  streak: number;
  lastResult: "correct" | "partial" | "incorrect";
}

// ── Calibration (self-assessment vs actual performance) ──

export interface CalibrationEntry {
  id: string;
  questionId: string;
  domainId: string;
  predictedScore: "correct" | "partial" | "incorrect";
  actualScore: "correct" | "partial" | "incorrect";
  /** -1 = overestimated, 0 = calibrated, 1 = underestimated */
  delta: -1 | 0 | 1;
  createdAt: string;
}

// ── Learner runtime state (mutable overlay on static YAML config) ──

/**
 * Learner-scoped theme state with provenance (see
 * docs/design-system.md § Layer 4).
 *
 * Absence of `LearnerState.theme` means "no learner override" — render
 * falls through to the course theme. `source === "ai_proposed"` is a
 * data-only state that never reaches rendering.
 */
export type LearnerThemeSource = "user" | "ai_proposed" | "ai_accepted";

export interface LearnerTheme {
  source: LearnerThemeSource;
  preset?: ThemePresetId;
  overrides?: DeepPartial<Theme>;
  /** ISO timestamp. Required when source ∈ {ai_proposed, ai_accepted}. */
  proposedAt?: string;
  /** ISO timestamp. Required when source === "ai_accepted". */
  acceptedAt?: string;
  /** What was rendering before this write. One level only — enforced by type. */
  previous?: PreviousTheme;
}

/**
 * A snapshot of what was being rendered before a theme change landed.
 * Structurally has NO `previous` field: the type system forbids a chain,
 * so revert is always a single step.
 */
export interface PreviousTheme {
  source: "user" | "ai_accepted";
  preset?: ThemePresetId;
  overrides?: DeepPartial<Theme>;
}

export interface LearnerState {
  intake: {
    completed: boolean;
    completedAt?: string;
  };
  wellbeing: {
    status: "active" | "paused" | "returning";
    pausedAt?: string;
    returnedAt?: string;
  };
  /** Optional — absence encodes "no learner override, fall through to course". */
  theme?: LearnerTheme;
}

// ── Intake ──

export type IntakePhase =
  | "goal_validation"
  | "profile_validation"
  | "baseline"
  | "gap_analysis"
  | "confirmation"
  | "completed";

export interface IntakeSession {
  id: string;
  status: IntakePhase;
  startedAt: string;
  completedAt?: string;
  baselineResults: BaselineResult[];
  /**
   * A GapAnalysisSnapshot (schemaVersion 1) wrapping the computed summary.
   * Records written before the snapshot wrapper existed stored the raw
   * GapAnalysis directly — callers should use `unwrapGapAnalysisSnapshot`
   * to handle either shape.
   */
  gapAnalysis?: GapAnalysisSnapshot | GapAnalysis;
}

export interface IntakeMessage {
  id: string;
  role: "agent" | "learner";
  content: string;
  timestamp: string;
  phase: IntakePhase;
}

export interface BaselineResult {
  phaseId: number;
  questionId: string;
  question: string;
  answer: string;
  suggestedLevel: number;
}
