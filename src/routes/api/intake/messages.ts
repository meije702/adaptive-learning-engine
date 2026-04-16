import { define } from "../../../utils.ts";
import { jsonResponse, parseJsonBody } from "../../../api/helpers.ts";
import { badRequest, notFound } from "../../../api/error.ts";

/**
 * GET /api/intake/messages?since=<timestamp>
 * POST /api/intake/messages
 *
 * GET: Returns intake messages, optionally filtered by `since` timestamp.
 * POST: Learner sends a message in the intake conversation.
 */
export const handler = define.handlers({
  async GET(ctx) {
    const url = new URL(ctx.req.url);
    const since = url.searchParams.get("since") ?? undefined;
    const messages = await ctx.state.repos.intake.getMessages(since);
    return jsonResponse(messages);
  },

  async POST(ctx) {
    const body = await parseJsonBody<{ content: string }>(ctx.req);
    if (!body?.content) {
      return badRequest(
        "Body must include content (the message text)",
        "/api/intake/messages",
      );
    }

    // Verify intake session exists
    const session = await ctx.state.repos.intake.getSession();
    if (!session) {
      return notFound(
        "No intake session found. Start intake via MCP first.",
        "/api/intake/messages",
      );
    }

    if (session.status === "completed") {
      return badRequest(
        "Intake is already completed",
        "/api/intake/messages",
      );
    }

    const message = await ctx.state.repos.intake.addMessage({
      role: "learner",
      content: body.content,
      phase: session.status,
    });

    return jsonResponse(message, 201);
  },
});
