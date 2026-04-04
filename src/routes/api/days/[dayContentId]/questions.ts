import { define } from "../../../../utils.ts";
import { jsonResponse, parseJsonBody } from "../../../../api/helpers.ts";
import { badRequest } from "../../../../api/error.ts";
import type { CreateQuestion } from "../../../../db/repositories.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const { dayContentId } = ctx.params;
    const questions = await ctx.state.repos.questions.getByDay(dayContentId);
    return jsonResponse(questions);
  },

  async POST(ctx) {
    const { dayContentId } = ctx.params;
    const body = await parseJsonBody<{
      questions: Omit<CreateQuestion, "dayContentId">[];
    }>(ctx.req);
    if (!body?.questions?.length) {
      return badRequest(
        "Body must include questions array",
        `/api/days/${dayContentId}/questions`,
      );
    }
    const questions = await ctx.state.repos.questions.create(
      body.questions.map((q) => ({ ...q, dayContentId })),
    );
    return jsonResponse(questions, 201);
  },
});
