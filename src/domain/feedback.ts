/**
 * Feedback + progress orchestration — the single source of truth for the
 * "write feedback, and optionally bump the learner's level" business rule.
 *
 * Both the REST POST /api/answers/:id/feedback handler and the MCP
 * create_feedback tool must call this function so the two paths cannot drift.
 *
 * Key invariant: when levelApplied is true, progress is keyed on the
 * question's domainId (NOT the question id — that was a bug we fixed).
 */

import type { CreateFeedback, Repositories } from "../db/repositories.ts";
import type { Feedback } from "../db/types.ts";

/**
 * Create a feedback record. When `input.levelApplied` is true, also update
 * the learner's progress on the question's domain to `input.suggestedLevel`.
 *
 * Returns the persisted feedback.
 */
export async function recordFeedbackAndProgress(
  repos: Repositories,
  input: CreateFeedback,
): Promise<Feedback> {
  const feedback = await repos.feedback.create(input);

  if (input.levelApplied) {
    const question = await repos.questions.get(input.questionId);
    if (question) {
      await repos.progress.put(question.domainId, {
        level: input.suggestedLevel as 0 | 1 | 2 | 3 | 4 | 5,
        source: "assessment",
        notes: input.explanation,
      });
    }
  }

  return feedback;
}
