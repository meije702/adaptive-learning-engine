import type {
  Answer,
  CalibrationEntry,
  DayContent,
  DayType,
  Feedback,
  IntakeMessage,
  IntakePhase,
  IntakeSession,
  LearnerState,
  Progress,
  Question,
  QuestionOption,
  RetentionSchedule,
  WeekPlan,
} from "./types.ts";

// --- Input types for creates/updates ---

export interface ProgressUpdate {
  level: 0 | 1 | 2 | 3 | 4 | 5;
  source: "assessment" | "retention" | "manual";
  notes?: string;
}

export interface CreateWeekPlan {
  weekNumber: number;
  domainId: string;
  isStretchWeek: boolean;
  summary: string;
}

export interface CreateDayContent {
  weekNumber: number;
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6;
  type: DayType;
  domainId: string;
  title: string;
  body: string;
  sceneDocument?: unknown;
  basedOn?: string[];
}

export interface CreateQuestion {
  dayContentId: string;
  domainId: string;
  sequence: number;
  type: "scenario" | "open" | "multiple_choice" | "troubleshoot";
  body: string;
  options?: QuestionOption[];
  hints?: string[];
  maxLevel: number;
  deadline: string;
  scrimCheckpoint?: string;
}

export interface CreateAnswer {
  questionId: string;
  body: string;
  timeSpentSeconds?: number;
}

export interface CreateFeedback {
  answerId: string;
  questionId: string;
  score: "correct" | "partial" | "incorrect";
  explanation: string;
  suggestedLevel: number;
  applyLevel: boolean;
  improvements: string[];
  feedUp?: string;
  feedBack?: string;
  feedForward?: string;
  feedbackLevel?: "task" | "process" | "self_regulation";
}

// --- Repository interfaces ---

export interface ProgressRepository {
  getAll(): Promise<Progress[]>;
  get(domainId: string): Promise<Progress | null>;
  put(domainId: string, update: ProgressUpdate): Promise<Progress>;
}

export interface WeekRepository {
  getAll(): Promise<WeekPlan[]>;
  get(weekNumber: number): Promise<WeekPlan | null>;
  create(plan: CreateWeekPlan): Promise<WeekPlan>;
  addRetrospective(weekNumber: number, text: string): Promise<WeekPlan>;
}

export interface DayRepository {
  getByWeek(weekNumber: number): Promise<DayContent[]>;
  get(weekNumber: number, dayOfWeek: number): Promise<DayContent | null>;
  getById(id: string): Promise<DayContent | null>;
  getToday(
    activeDays: number[],
    dayPlan: Record<string, string>,
  ): Promise<DayContent | null>;
  create(content: CreateDayContent): Promise<DayContent>;
}

export interface QuestionRepository {
  getByDay(dayContentId: string): Promise<Question[]>;
  get(questionId: string): Promise<Question | null>;
  getByCheckpoint(checkpoint: string): Promise<Question | null>;
  getPending(): Promise<Question[]>;
  create(questions: CreateQuestion[]): Promise<Question[]>;
}

export interface AnswerRepository {
  getByQuestion(questionId: string): Promise<Answer | null>;
  get(answerId: string): Promise<Answer | null>;
  getRecent(since: string): Promise<Answer[]>;
  create(answer: CreateAnswer): Promise<Answer>;
}

export interface FeedbackRepository {
  getByAnswer(answerId: string): Promise<Feedback | null>;
  get(feedbackId: string): Promise<Feedback | null>;
  getRecent(since: string): Promise<Feedback[]>;
  create(feedback: CreateFeedback): Promise<Feedback>;
}

export interface RetentionRepository {
  getAll(): Promise<RetentionSchedule[]>;
  getDue(): Promise<RetentionSchedule[]>;
  get(domainId: string): Promise<RetentionSchedule | null>;
  put(
    domainId: string,
    result: "correct" | "partial" | "incorrect",
  ): Promise<RetentionSchedule>;
  recalculateAfterPause(pauseDays: number): Promise<number>;
}

export interface CalibrationRepository {
  getByDomain(domainId: string): Promise<CalibrationEntry[]>;
  getRecent(limit: number): Promise<CalibrationEntry[]>;
  create(entry: Omit<CalibrationEntry, "id" | "createdAt">): Promise<CalibrationEntry>;
  getSummary(): Promise<{ domainId: string; avgDelta: number; count: number }[]>;
}

export interface InteractionLogRepository {
  get(dayContentId: string): Promise<unknown | null>;
  put(dayContentId: string, log: unknown): Promise<void>;
}

export interface LearnerStateRepository {
  get(): Promise<LearnerState | null>;
  put(state: LearnerState): Promise<void>;
}

export interface IntakeRepository {
  getSession(): Promise<IntakeSession | null>;
  putSession(session: IntakeSession): Promise<void>;
  addMessage(
    msg: { role: "agent" | "learner"; content: string; phase: IntakePhase },
  ): Promise<IntakeMessage>;
  getMessages(since?: string): Promise<IntakeMessage[]>;
}

// --- Aggregate ---

export interface Repositories {
  progress: ProgressRepository;
  weeks: WeekRepository;
  days: DayRepository;
  questions: QuestionRepository;
  answers: AnswerRepository;
  feedback: FeedbackRepository;
  retention: RetentionRepository;
  calibration: CalibrationRepository;
  interactionLogs: InteractionLogRepository;
  learnerState: LearnerStateRepository;
  intake: IntakeRepository;
}
