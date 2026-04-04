import { define } from "../../../utils.ts";
import { jsonResponse, parseJsonBody } from "../../../api/helpers.ts";
import { badRequest, notFound } from "../../../api/error.ts";
import type { ProgressUpdate } from "../../../db/repositories.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const { domainId } = ctx.params;
    const progress = await ctx.state.repos.progress.get(domainId);
    if (!progress) {
      return notFound(
        `No progress found for domain ${domainId}`,
        `/api/progress/${domainId}`,
      );
    }
    return jsonResponse(progress);
  },

  async PUT(ctx) {
    const { domainId } = ctx.params;
    const body = await parseJsonBody<ProgressUpdate>(ctx.req);
    if (!body || body.level === undefined || !body.source) {
      return badRequest(
        "Body must include level (0-5) and source",
        `/api/progress/${domainId}`,
      );
    }
    const updated = await ctx.state.repos.progress.put(domainId, body);
    return jsonResponse(updated);
  },
});
