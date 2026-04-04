import { define } from "../../../../utils.ts";
import { jsonResponse, parseJsonBody } from "../../../../api/helpers.ts";
import { badRequest, notFound } from "../../../../api/error.ts";
import type { CreateAnswer } from "../../../../db/repositories.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const { questionId } = ctx.params;
    const answer = await ctx.state.repos.answers.getByQuestion(questionId);
    if (!answer) {
      return notFound(
        `No answer found for question ${questionId}`,
        `/api/questions/${questionId}/answer`,
      );
    }
    return jsonResponse(answer);
  },

  async POST(ctx) {
    const { questionId } = ctx.params;
    const body = await parseJsonBody<Omit<CreateAnswer, "questionId">>(
      ctx.req,
    );
    if (!body?.body) {
      return badRequest(
        "Body must include body (the answer text)",
        `/api/questions/${questionId}/answer`,
      );
    }
    const answer = await ctx.state.repos.answers.create({
      ...body,
      questionId,
    });
    return jsonResponse(answer, 201);
  },
});
