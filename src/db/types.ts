// Entity types from ADR-001

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
  /** Scrim SceneDocument JSON. When present, the frontend renders an interactive scene. */
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
  gapAnalysis?: GapAnalysis;
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

export interface GapAnalysis {
  overallFeasible: boolean;
  estimatedWeeks: number;
  phaseGaps: PhaseGap[];
  riskFactors: string[];
  accelerators: string[];
  recommendation?: string;
}

export interface PhaseGap {
  phaseId: number;
  phaseName: string;
  gapSize: "small" | "moderate" | "large" | "very_large";
  estimatedWeeks: number;
  strategy: "analogy" | "first_principles" | "contrast" | "scaffolded" | "accelerated";
}
