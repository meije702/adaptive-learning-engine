import { define } from "../../../utils.ts";
import { jsonResponse } from "../../../api/helpers.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const retention = await ctx.state.repos.retention.getAll();
    return jsonResponse(retention);
  },
});
