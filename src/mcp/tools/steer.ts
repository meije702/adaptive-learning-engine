import { z } from "zod";
import { defineTool, txt } from "../define_tool.ts";
import type { ToolCtx } from "./context.ts";

export function register({ server, repos }: ToolCtx): void {
  defineTool(
    server,
    "update_progress",
    {
      description: "Werk het competentieniveau bij voor een domein",
      inputSchema: z.object({
        domainId: z.string(),
        level: z.number().min(0).max(5),
        source: z.enum(["assessment", "retention", "manual"]),
        notes: z.string().optional(),
      }),
    },
    async (args) =>
      txt(
        await repos.progress.put(args.domainId, {
          level: args.level as 0 | 1 | 2 | 3 | 4 | 5,
          source: args.source,
          notes: args.notes,
        }),
      ),
  );

  defineTool(
    server,
    "update_retention",
    {
      description:
        "Werk de spaced repetition planning bij na een retentietoets",
      inputSchema: z.object({
        domainId: z.string(),
        result: z.enum(["correct", "partial", "incorrect"]),
      }),
    },
    async (args) => txt(await repos.retention.put(args.domainId, args.result)),
  );

  defineTool(
    server,
    "add_retrospective",
    {
      description: "Voeg een weekretrospective toe",
      inputSchema: z.object({
        weekNumber: z.number(),
        retrospective: z.string(),
      }),
    },
    async (args) =>
      txt(
        await repos.weeks.addRetrospective(args.weekNumber, args.retrospective),
      ),
  );
}
