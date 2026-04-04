import { define } from "../../../utils.ts";
import { jsonResponse } from "../../../api/helpers.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const due = await ctx.state.repos.retention.getDue();
    return jsonResponse(due);
  },
});
