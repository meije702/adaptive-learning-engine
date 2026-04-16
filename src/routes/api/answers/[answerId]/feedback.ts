import { define } from "../../../../utils.ts";
import { jsonResponse, parseJsonBody } from "../../../../api/helpers.ts";
import { badRequest, notFound } from "../../../../api/error.ts";
import type { CreateFeedback } from "../../../../db/repositories.ts";
import { recordFeedbackAndProgress } from "../../../../domain/feedback.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const { answerId } = ctx.params;
    const feedback = await ctx.state.repos.feedback.getByAnswer(answerId);
    if (!feedback) {
      return notFound(
        `No feedback found for answer ${answerId}`,
        `/api/answers/${answerId}/feedback`,
      );
    }
    return jsonResponse(feedback);
  },

  async POST(ctx) {
    const { answerId } = ctx.params;
    const body = await parseJsonBody<Omit<CreateFeedback, "answerId">>(
      ctx.req,
    );
    if (!body || !body.questionId || !body.score || !body.explanation) {
      return badRequest(
        "Body must include questionId, score, explanation, suggestedLevel, applyLevel, and improvements",
        `/api/answers/${answerId}/feedback`,
      );
    }

    const feedback = await recordFeedbackAndProgress(ctx.state.repos, {
      ...body,
      answerId,
    });

    return jsonResponse(feedback, 201);
  },
});
