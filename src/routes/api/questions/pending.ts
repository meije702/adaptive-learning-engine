import { define } from "../../../utils.ts";
import { jsonResponse } from "../../../api/helpers.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const pending = await ctx.state.repos.questions.getPending();
    return jsonResponse(pending);
  },
});
