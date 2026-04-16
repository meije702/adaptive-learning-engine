/**
 * Multiple-choice auto-grading — pure function.
 *
 * Compares a response against a question's optimal option. The response may be
 * either the option key (e.g. "A") or the option text.
 */

import type { Question } from "../db/types.ts";

export interface McGradeResult {
  correct: boolean;
  score: 0 | 1;
  explanation: string;
  /** The optimal option text (for feedback messages), if available. */
  optimalText?: string;
}

/**
 * Auto-grade a multiple-choice response.
 *
 * Returns correct/incorrect with a human-readable explanation in Dutch
 * (matches the existing learner-facing messages).
 */
export function autoGradeMultipleChoice(
  question: Question,
  response: unknown,
): McGradeResult {
  if (question.type !== "multiple_choice" || !question.options) {
    return {
      correct: false,
      score: 0,
      explanation: "Vraag is niet een multiple-choice vraag.",
    };
  }

  const optimal = question.options.find((o) => o.isOptimal);
  if (!optimal) {
    return {
      correct: false,
      score: 0,
      explanation: "Geen optimaal antwoord geconfigureerd.",
    };
  }

  const asString = typeof response === "string" ? response : String(response);
  const correct = asString === optimal.key || asString === optimal.text;

  return {
    correct,
    score: correct ? 1 : 0,
    explanation: correct
      ? "Correct!"
      : `Het juiste antwoord was: ${optimal.text}`,
    optimalText: optimal.text,
  };
}
