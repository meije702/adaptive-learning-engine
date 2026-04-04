import { define } from "../../../utils.ts";
import { jsonResponse, parseJsonBody } from "../../../api/helpers.ts";
import { badRequest } from "../../../api/error.ts";
import type { CreateWeekPlan } from "../../../db/repositories.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const weeks = await ctx.state.repos.weeks.getAll();
    return jsonResponse(weeks);
  },

  async POST(ctx) {
    const body = await parseJsonBody<CreateWeekPlan>(ctx.req);
    if (!body || !body.weekNumber || !body.domainId || !body.summary) {
      return badRequest(
        "Body must include weekNumber, domainId, isStretchWeek, and summary",
        "/api/weeks",
      );
    }
    const plan = await ctx.state.repos.weeks.create(body);
    return jsonResponse(plan, 201);
  },
});
