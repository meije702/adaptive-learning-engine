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
  createdAt: string;
  basedOn?: string[];
}

export interface QuestionOption {
  key: "A" | "B" | "C" | "D";
  text: string;
  isOptimal: boolean;
}

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
}

export interface Answer {
  id: string;
  questionId: string;
  body: string;
  submittedAt: string;
  timeSpentSeconds?: number;
}

export interface Feedback {
  id: string;
  answerId: string;
  questionId: string;
  score: "correct" | "partial" | "incorrect";
  explanation: string;
  suggestedLevel: number;
  levelApplied: boolean;
  improvements: string[];
  createdAt: string;
}

export interface RetentionSchedule {
  domainId: string;
  nextDue: string;
  interval: number;
  streak: number;
  lastResult: "correct" | "partial" | "incorrect";
}
