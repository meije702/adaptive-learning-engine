import { define } from "../../utils.ts";
import { jsonResponse, parseJsonBody } from "../../api/helpers.ts";
import { badRequest } from "../../api/error.ts";

/**
 * POST /api/calibration
 *
 * Learner submits a self-assessment prediction before seeing feedback.
 * The actual score is looked up from existing feedback.
 */
export const handler = define.handlers({
  async POST(ctx) {
    const body = await parseJsonBody<{
      questionId: string;
      predictedScore: string;
    }>(ctx.req);

    if (
      !body?.questionId || !body?.predictedScore ||
      !["correct", "partial", "incorrect"].includes(body.predictedScore)
    ) {
      return badRequest(
        "Body must include questionId and predictedScore (correct|partial|incorrect)",
        "/api/calibration",
      );
    }

    const { repos } = ctx.state;
    const question = await repos.questions.get(body.questionId);
    if (!question) {
      return badRequest("Question not found", "/api/calibration");
    }

    // Find the answer and feedback
    const answer = await repos.answers.getByQuestion(body.questionId);
    if (!answer) {
      return badRequest(
        "No answer submitted yet for this question",
        "/api/calibration",
      );
    }

    const feedback = await repos.feedback.getByAnswer(answer.id);
    if (!feedback) {
      return badRequest(
        "Feedback has not been created yet for this answer. Calibration requires an actual score to compare against.",
        "/api/calibration",
      );
    }
    const actualScore = feedback.score;

    // Compute delta
    const scoreOrder = { incorrect: 0, partial: 1, correct: 2 };
    const predicted =
      scoreOrder[body.predictedScore as keyof typeof scoreOrder];
    const actual = scoreOrder[actualScore];
    const delta = predicted > actual ? -1 : predicted < actual ? 1 : 0;

    const entry = await repos.calibration.create({
      questionId: body.questionId,
      domainId: question.domainId,
      predictedScore: body.predictedScore as
        | "correct"
        | "partial"
        | "incorrect",
      actualScore,
      delta: delta as -1 | 0 | 1,
    });

    return jsonResponse(entry, 201);
  },
});
