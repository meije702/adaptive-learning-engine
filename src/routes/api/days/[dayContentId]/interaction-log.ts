import { define } from "../../../../utils.ts";
import { jsonResponse, parseJsonBody } from "../../../../api/helpers.ts";
import { badRequest, notFound } from "../../../../api/error.ts";

/**
 * GET/PUT /api/days/:dayContentId/interaction-log
 *
 * Persists and retrieves Scrim interaction logs for replay support.
 * Called by the ScrimPlayer island to save progress and restore sessions.
 */
export const handler = define.handlers({
  async GET(ctx) {
    const { dayContentId } = ctx.params;
    const log = await ctx.state.repos.interactionLogs.get(dayContentId);
    if (!log) {
      return notFound(
        `No interaction log for day ${dayContentId}`,
        `/api/days/${dayContentId}/interaction-log`,
      );
    }
    return jsonResponse(log);
  },

  async PUT(ctx) {
    const { dayContentId } = ctx.params;
    const log = await parseJsonBody<unknown>(ctx.req);
    if (!log) {
      return badRequest(
        "Body must be a valid interaction log JSON",
        `/api/days/${dayContentId}/interaction-log`,
      );
    }

    // Verify the day content exists
    const day = await ctx.state.repos.days.getById(dayContentId);
    if (!day) {
      return notFound(
        `Day content ${dayContentId} not found`,
        `/api/days/${dayContentId}/interaction-log`,
      );
    }

    await ctx.state.repos.interactionLogs.put(dayContentId, log);
    return jsonResponse({ ok: true });
  },
});
