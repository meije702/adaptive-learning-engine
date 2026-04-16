import { define } from "../../utils.ts";
import { jsonResponse, parseJsonBody } from "../../api/helpers.ts";
import { badRequest } from "../../api/error.ts";

interface EvaluateRequest {
  response: unknown;
  evaluatorKey: string;
  dayContentId: string;
}

/**
 * POST /api/evaluate
 *
 * Evaluator bridge between Scrim's evaluate effect and ALE's feedback system.
 * Called by the ScrimPlayer island when a challenge step needs grading.
 *
 * For multiple-choice (evaluatorKey prefix "mc:"):
 *   Evaluates locally by looking up the Question's optimal option.
 *
 * For free-text/code (evaluatorKey prefix "ai:"):
 *   Stores the answer for async AI evaluation and returns a preliminary result.
 */
export const handler = define.handlers({
  async POST(ctx) {
    const body = await parseJsonBody<EvaluateRequest>(ctx.req);
    if (!body?.evaluatorKey || body.response === undefined) {
      return badRequest(
        "Body must include response, evaluatorKey, and dayContentId",
        "/api/evaluate",
      );
    }

    const { repos } = ctx.state;
    const { response, evaluatorKey, dayContentId } = body;

    // Find the question linked to this evaluator key via checkpoint
    // Convention: evaluatorKey is used as the checkpoint lookup
    const question = await repos.questions.getByCheckpoint(evaluatorKey);

    if (!question) {
      // No linked question — return a generic evaluation result
      // This allows scenes with challenges that aren't linked to ALE questions
      return jsonResponse({
        correct: false,
        score: 0,
        feedback: "Evaluation not configured for this challenge.",
      });
    }

    // Validate that the question belongs to the claimed day content
    if (dayContentId && question.dayContentId !== dayContentId) {
      return badRequest(
        `Question checkpoint "${evaluatorKey}" belongs to day ${question.dayContentId}, not ${dayContentId}`,
        "/api/evaluate",
      );
    }

    // Store the answer
    const answer = await repos.answers.create({
      questionId: question.id,
      body: typeof response === "string" ? response : JSON.stringify(response),
    });

    // Multiple-choice: evaluate locally
    if (question.type === "multiple_choice" && question.options) {
      const optimal = question.options.find((o) => o.isOptimal);
      const correct = optimal
        ? String(response) === optimal.key ||
          String(response) === optimal.text
        : false;

      const score = correct ? "correct" : "incorrect";

      // Create feedback record
      await repos.feedback.create({
        answerId: answer.id,
        questionId: question.id,
        score,
        explanation: correct
          ? "Correct!"
          : `Het juiste antwoord was: ${optimal?.text ?? "onbekend"}`,
        suggestedLevel: correct
          ? question.maxLevel
          : Math.max(0, question.maxLevel - 1),
        applyLevel: false,
        improvements: [],
      });

      return jsonResponse({
        correct,
        score: correct ? 1 : 0,
        feedback: correct
          ? "Correct!"
          : `Het juiste antwoord was: ${optimal?.text ?? "onbekend"}`,
      });
    }

    // Free-text / other: store answer, return preliminary result for async AI evaluation
    return jsonResponse({
      correct: false,
      score: 0.5,
      feedback: "Je antwoord is opgeslagen en wordt beoordeeld.",
      metadata: { answerId: answer.id, pending: true },
    });
  },
});
