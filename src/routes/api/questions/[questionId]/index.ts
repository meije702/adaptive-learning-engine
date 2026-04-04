import { define } from "../../../../utils.ts";
import { jsonResponse } from "../../../../api/helpers.ts";
import { notFound } from "../../../../api/error.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const { questionId } = ctx.params;
    const question = await ctx.state.repos.questions.get(questionId);
    if (!question) {
      return notFound(
        `No question found with id ${questionId}`,
        `/api/questions/${questionId}`,
      );
    }
    return jsonResponse(question);
  },
});
