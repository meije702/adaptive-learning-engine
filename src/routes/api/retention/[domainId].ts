import { define } from "../../../utils.ts";
import { jsonResponse, parseJsonBody } from "../../../api/helpers.ts";
import { badRequest } from "../../../api/error.ts";

export const handler = define.handlers({
  async PUT(ctx) {
    const { domainId } = ctx.params;
    const body = await parseJsonBody<{
      result: "correct" | "partial" | "incorrect";
    }>(ctx.req);
    if (!body?.result) {
      return badRequest(
        "Body must include result (correct, partial, or incorrect)",
        `/api/retention/${domainId}`,
      );
    }
    const updated = await ctx.state.repos.retention.put(
      domainId,
      body.result,
    );
    return jsonResponse(updated);
  },
});
