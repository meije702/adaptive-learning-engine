import { z } from "zod";
import { defineTool, txt } from "../define_tool.ts";
import type { ToolCtx } from "./context.ts";
import { computeGapAnalysis } from "../../analysis/gap.ts";
import { unwrapGapAnalysisSnapshot } from "../../analysis/types.ts";
import { NotFoundError } from "../../domain/errors.ts";

export function register({ server, repos, config }: ToolCtx): void {
  defineTool(
    server,
    "get_gap_analysis",
    {
      description:
        "Bereken de huidige gap-analyse: waar staat de leerling ten opzichte van het doel? Toont per fase de gemiddelde level, gap-grootte, strategie, en risicofactoren (zwakke prerequisites). Optioneel filter op een specifieke fase.",
      inputSchema: z.object({ phaseId: z.number().optional() }),
    },
    async (args) => {
      const progress = await repos.progress.getAll();
      const result = computeGapAnalysis(progress, config.curriculum);
      if (args.phaseId !== undefined) {
        const phaseGap = result.phaseGaps.find((p) =>
          p.phaseId === args.phaseId
        );
        if (!phaseGap) {
          throw new NotFoundError(`Phase ${args.phaseId} not found`);
        }
        return txt(phaseGap);
      }
      return txt(result);
    },
  );

  defineTool(
    server,
    "recalculate_gaps",
    {
      description:
        "Herbereken gaps na een assessment-week. Vergelijkt de huidige voortgang met de intake gap-analyse en geeft aanbevelingen: tijdlijn verlengen, prerequisites herstellen, of versnellen.",
      inputSchema: z.object({ weekNumber: z.number() }),
    },
    async (args) => {
      const [progress, intakeSession] = await Promise.all([
        repos.progress.getAll(),
        repos.intake.getSession(),
      ]);

      const currentGap = computeGapAnalysis(progress, config.curriculum);
      const intakeGap = unwrapGapAnalysisSnapshot(intakeSession?.gapAnalysis);

      const recommendations: string[] = [];
      if (intakeGap) {
        const weeksDiff = currentGap.estimatedRemainingWeeks -
          intakeGap.estimatedWeeks;
        if (weeksDiff > 2) {
          recommendations.push(
            `Trajectory is ${weeksDiff} weeks behind initial estimate. Consider extending the timeline or narrowing scope.`,
          );
        } else if (weeksDiff < -2) {
          recommendations.push(
            `Trajectory is ${
              Math.abs(weeksDiff)
            } weeks ahead of initial estimate. Consider accelerating or adding stretch goals.`,
          );
        }
      }

      if (currentGap.riskFactors.length > 0) {
        recommendations.push(
          `Prerequisite risks detected: consider remediation before advancing.`,
        );
      }

      return txt({
        weekNumber: args.weekNumber,
        currentGap,
        intakeGapComparison: intakeGap
          ? {
            initialEstimatedWeeks: intakeGap.estimatedWeeks,
            currentEstimatedWeeks: currentGap.estimatedRemainingWeeks,
            delta: currentGap.estimatedRemainingWeeks -
              intakeGap.estimatedWeeks,
          }
          : null,
        recommendations,
      });
    },
  );
}
