import { define } from "../../../../../utils.ts";
import { jsonResponse, parseJsonBody } from "../../../../../api/helpers.ts";
import { badRequest } from "../../../../../api/error.ts";
import type { CreateDayContent } from "../../../../../db/repositories.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const weekNumber = Number(ctx.params.weekNumber);
    const days = await ctx.state.repos.days.getByWeek(weekNumber);
    return jsonResponse(days);
  },

  async POST(ctx) {
    const weekNumber = Number(ctx.params.weekNumber);
    const body = await parseJsonBody<Omit<CreateDayContent, "weekNumber">>(
      ctx.req,
    );
    if (!body || !body.dayOfWeek || !body.type || !body.domainId || !body.title || !body.body) {
      return badRequest(
        "Body must include dayOfWeek, type, domainId, title, and body",
        `/api/weeks/${weekNumber}/days`,
      );
    }
    const content = await ctx.state.repos.days.create({
      ...body,
      weekNumber,
    });
    return jsonResponse(content, 201);
  },
});
