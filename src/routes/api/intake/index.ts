import { define } from "../../../utils.ts";
import { jsonResponse } from "../../../api/helpers.ts";
import { notFound } from "../../../api/error.ts";

/**
 * GET /api/intake
 *
 * Returns the current IntakeSession, or 404 if none exists.
 */
export const handler = define.handlers({
  async GET(ctx) {
    const session = await ctx.state.repos.intake.getSession();
    if (!session) {
      return notFound("No intake session found", "/api/intake");
    }
    return jsonResponse(session);
  },
});
