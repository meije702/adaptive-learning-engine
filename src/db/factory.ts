import type { SystemConfig } from "../config/schemas/index.ts";
import type { Repositories } from "./repositories.ts";
import { KvProgressRepository } from "./kv/progress.ts";
import { KvWeekRepository } from "./kv/weeks.ts";
import { KvDayRepository } from "./kv/days.ts";
import { KvQuestionRepository } from "./kv/questions.ts";
import { KvAnswerRepository } from "./kv/answers.ts";
import { KvFeedbackRepository } from "./kv/feedback.ts";
import { KvRetentionRepository } from "./kv/retention.ts";
import { KvInteractionLogRepository } from "./kv/interaction_logs.ts";
import { KvCalibrationRepository } from "./kv/calibration.ts";
import { KvLearnerStateRepository } from "./kv/learner_state.ts";
import { KvIntakeRepository } from "./kv/intake.ts";

export function createRepositories(
  kv: Deno.Kv,
  system: SystemConfig,
): Repositories {
  return {
    progress: new KvProgressRepository(kv),
    weeks: new KvWeekRepository(kv),
    days: new KvDayRepository(kv),
    questions: new KvQuestionRepository(kv),
    answers: new KvAnswerRepository(kv),
    feedback: new KvFeedbackRepository(kv),
    retention: new KvRetentionRepository(kv, system.retention),
    calibration: new KvCalibrationRepository(kv),
    interactionLogs: new KvInteractionLogRepository(kv),
    learnerState: new KvLearnerStateRepository(kv),
    intake: new KvIntakeRepository(kv),
  };
}
