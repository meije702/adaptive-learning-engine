import { define } from "../../../utils.ts";
import { jsonResponse } from "../../../api/helpers.ts";
import { methodNotAllowed } from "../../../api/error.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const progress = await ctx.state.repos.progress.getAll();
    return jsonResponse(progress);
  },
  GET_HEAD: undefined,
  POST() {
    return methodNotAllowed("/api/progress");
  },
});
