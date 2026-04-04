import { define } from "../../../utils.ts";
import { jsonResponse } from "../../../api/helpers.ts";
import { notFound } from "../../../api/error.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const { schedule } = ctx.state.config.learner;
    const today = await ctx.state.repos.days.getToday(
      schedule.active_days,
      schedule.day_plan,
    );
    if (!today) {
      return notFound("No content for today", "/api/days/today");
    }
    return jsonResponse(today);
  },
});
