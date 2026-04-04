import { define } from "../../../../utils.ts";
import { jsonResponse, parseJsonBody } from "../../../../api/helpers.ts";
import { badRequest, notFound } from "../../../../api/error.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const weekNumber = Number(ctx.params.weekNumber);
    const week = await ctx.state.repos.weeks.get(weekNumber);
    if (!week) {
      return notFound(
        `No week plan found for week ${weekNumber}`,
        `/api/weeks/${weekNumber}`,
      );
    }
    return jsonResponse(week);
  },

  async PATCH(ctx) {
    const weekNumber = Number(ctx.params.weekNumber);
    const body = await parseJsonBody<{ retrospective: string }>(ctx.req);
    if (!body?.retrospective) {
      return badRequest(
        "Body must include retrospective",
        `/api/weeks/${weekNumber}`,
      );
    }
    try {
      const updated = await ctx.state.repos.weeks.addRetrospective(
        weekNumber,
        body.retrospective,
      );
      return jsonResponse(updated);
    } catch {
      return notFound(
        `No week plan found for week ${weekNumber}`,
        `/api/weeks/${weekNumber}`,
      );
    }
  },
});
