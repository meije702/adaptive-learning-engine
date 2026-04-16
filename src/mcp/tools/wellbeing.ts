import { z } from "zod";
import { defineTool, txt } from "../define_tool.ts";
import type { ToolCtx } from "./context.ts";
import { applyWellbeingTransition } from "../../domain/wellbeing.ts";

export function register({ server, repos }: ToolCtx): void {
  defineTool(
    server,
    "set_wellbeing_status",
    {
      description:
        "Update de wellbeing status. Bij 'paused': stop alle contentgeneratie. Bij 'returning': start soft re-entry. Bij 'active': normaal leertraject.",
      inputSchema: z.object({
        status: z.enum(["active", "paused", "returning"]),
      }),
    },
    async (args) => {
      const current = await repos.learnerState.get();
      const updated = {
        intake: current?.intake ?? { completed: false },
        wellbeing: applyWellbeingTransition(current?.wellbeing, args.status),
      };
      await repos.learnerState.put(updated);
      return txt(updated.wellbeing);
    },
  );

  defineTool(
    server,
    "recalculate_retention_after_pause",
    {
      description:
        "Herbereken alle retentie-intervallen na een pauze. Intervallen verval tijdens afwezigheid. Draai dit na set_wellbeing_status('returning').",
      inputSchema: z.object({ pauseDays: z.number().min(0) }),
    },
    async (args) => {
      const count = await repos.retention.recalculateAfterPause(args.pauseDays);
      return txt({ recalculated: count, pauseDays: args.pauseDays });
    },
  );
}
