import { define } from "../../utils.ts";
import { jsonResponse, parseJsonBody } from "../../api/helpers.ts";
import { badRequest } from "../../api/error.ts";

/**
 * POST /api/wellbeing
 *
 * Update the learner's wellbeing status.
 * When transitioning to "returning", triggers retention recalculation.
 */
export const handler = define.handlers({
  async POST(ctx) {
    const body = await parseJsonBody<{ status: string }>(ctx.req);
    if (
      !body?.status ||
      !["active", "paused", "returning"].includes(body.status)
    ) {
      return badRequest(
        "Body must include status: 'active' | 'paused' | 'returning'",
        "/api/wellbeing",
      );
    }

    const { repos } = ctx.state;
    const current = await repos.learnerState.get();
    const now = new Date().toISOString();

    const updated = {
      intake: current?.intake ?? { completed: false },
      wellbeing: {
        status: body.status as "active" | "paused" | "returning",
        pausedAt: body.status === "paused" ? now : current?.wellbeing?.pausedAt,
        returnedAt: body.status === "returning" || body.status === "active"
          ? now
          : current?.wellbeing?.returnedAt,
      },
    };

    await repos.learnerState.put(updated);

    // Recalculate retention when returning from pause
    let retentionRecalculated = 0;
    if (body.status === "returning" && current?.wellbeing?.pausedAt) {
      const pauseDays = Math.floor(
        (Date.now() - new Date(current.wellbeing.pausedAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      retentionRecalculated = await repos.retention.recalculateAfterPause(
        pauseDays,
      );
    }

    return jsonResponse({
      wellbeing: updated.wellbeing,
      retentionRecalculated,
    });
  },
});
