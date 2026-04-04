import { define } from "../../../../../utils.ts";
import { jsonResponse } from "../../../../../api/helpers.ts";
import { notFound } from "../../../../../api/error.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const weekNumber = Number(ctx.params.weekNumber);
    const dayOfWeek = Number(ctx.params.dayOfWeek);
    const day = await ctx.state.repos.days.get(weekNumber, dayOfWeek);
    if (!day) {
      return notFound(
        `No content found for week ${weekNumber}, day ${dayOfWeek}`,
        `/api/weeks/${weekNumber}/days/${dayOfWeek}`,
      );
    }
    return jsonResponse(day);
  },
});
