import { z } from "zod";
import { defineTool, txt } from "../define_tool.ts";
import type { ToolCtx } from "./context.ts";
import { SCHEDULED_TASKS } from "../../tasks/manifest.ts";

export function register({ server, config }: ToolCtx): void {
  defineTool(
    server,
    "get_scheduled_tasks",
    {
      description:
        "Haal het taakmanifest op: welke taken moet de agent uitvoeren en wanneer. Bevat ook de huidige schedule configuratie van de leerling.",
      inputSchema: z.object({}),
    },
    () => txt({ tasks: SCHEDULED_TASKS, schedule: config.learner.schedule }),
  );
}
