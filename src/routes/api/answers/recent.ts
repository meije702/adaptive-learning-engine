import { define } from "../../../utils.ts";
import { jsonResponse } from "../../../api/helpers.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const url = new URL(ctx.req.url);
    const since = url.searchParams.get("since") ??
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const answers = await ctx.state.repos.answers.getRecent(since);
    return jsonResponse(answers);
  },
});
