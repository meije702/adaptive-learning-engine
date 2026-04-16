import { z } from "zod";
import { defineTool, txt } from "../define_tool.ts";
import type { ToolCtx } from "./context.ts";
import { toGapAnalysisSnapshot } from "../../analysis/types.ts";

export function register({ server, repos, config }: ToolCtx): void {
  defineTool(
    server,
    "start_intake",
    {
      description:
        "Start of hervat de intake. Maakt een IntakeSession aan als die nog niet bestaat. Retourneert de sessie plus learner config samenvatting en curriculum bridge voor context.",
      inputSchema: z.object({}),
    },
    async () => {
      let session = await repos.intake.getSession();
      if (!session) {
        session = {
          id: crypto.randomUUID(),
          status: "goal_validation",
          startedAt: new Date().toISOString(),
          baselineResults: [],
        };
        await repos.intake.putSession(session);
      }
      return txt({
        session,
        learner: {
          profile: config.learner.profile,
          background: config.learner.background,
        },
        curriculum: {
          meta: config.curriculum.meta,
          bridge: config.curriculum.bridge,
          phases: config.curriculum.phases,
        },
      });
    },
  );

  defineTool(
    server,
    "send_intake_message",
    {
      description:
        "Stuur een bericht in het intake-gesprek. De agent gebruikt dit om vragen te stellen, feedback te geven, en analyses te delen. Optioneel kan de fase worden bijgewerkt.",
      inputSchema: z.object({
        content: z.string(),
        phase: z.enum([
          "goal_validation",
          "profile_validation",
          "baseline",
          "gap_analysis",
          "confirmation",
          "completed",
        ]).optional(),
      }),
    },
    async (args) => {
      const session = await repos.intake.getSession();
      if (!session) {
        return txt({ error: "No intake session. Call start_intake first." });
      }

      if (args.phase && args.phase !== session.status) {
        session.status = args.phase;
        await repos.intake.putSession(session);
      }

      const message = await repos.intake.addMessage({
        role: "agent",
        content: args.content,
        phase: session.status,
      });
      return txt(message);
    },
  );

  defineTool(
    server,
    "complete_intake",
    {
      description:
        "Rond de intake af. Slaat gap-analyse en baseline resultaten op. Zet initiële competentieniveaus en markeert de intake als voltooid.",
      inputSchema: z.object({
        gapAnalysis: z.object({
          overallFeasible: z.boolean(),
          estimatedWeeks: z.number(),
          phaseGaps: z.array(z.object({
            phaseId: z.number(),
            phaseName: z.string(),
            gapSize: z.enum(["small", "moderate", "large", "very_large"]),
            estimatedWeeks: z.number(),
            strategy: z.enum([
              "analogy",
              "first_principles",
              "contrast",
              "scaffolded",
              "accelerated",
            ]),
          })),
          riskFactors: z.array(z.string()),
          accelerators: z.array(z.string()),
          recommendation: z.string().optional(),
        }),
        baselineResults: z.array(z.object({
          phaseId: z.number(),
          questionId: z.string(),
          question: z.string(),
          answer: z.string(),
          suggestedLevel: z.number().min(0).max(5),
        })),
      }),
    },
    async (args) => {
      const session = await repos.intake.getSession();
      if (!session) {
        return txt({ error: "No intake session. Call start_intake first." });
      }

      session.status = "completed";
      session.completedAt = new Date().toISOString();
      session.gapAnalysis = toGapAnalysisSnapshot(args.gapAnalysis);
      session.baselineResults = args.baselineResults;
      await repos.intake.putSession(session);

      for (const result of args.baselineResults) {
        const phaseDomains = config.curriculum.domains.filter(
          (d) => d.phase === result.phaseId,
        );
        for (const domain of phaseDomains) {
          await repos.progress.put(domain.id, {
            level: result.suggestedLevel as 0 | 1 | 2 | 3 | 4 | 5,
            source: "manual",
            notes: `Intake baseline: ${result.question}`,
          });
        }
      }

      await repos.learnerState.put({
        intake: { completed: true, completedAt: session.completedAt },
        wellbeing: { status: "active" },
      });

      await repos.intake.addMessage({
        role: "agent",
        content: "Intake voltooid. Het leertraject kan beginnen.",
        phase: "completed",
      });

      return txt(session);
    },
  );
}
