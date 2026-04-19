import { z } from "zod";
import { defineTool, txt } from "../define_tool.ts";
import type { ToolCtx } from "./context.ts";
import { computeCalibrationDelta } from "../../domain/calibration.ts";
import { NotFoundError, ValidationError } from "../../domain/errors.ts";

export function register({ server, repos }: ToolCtx): void {
  defineTool(
    server,
    "record_self_assessment",
    {
      description:
        "Sla de zelfbeoordeling van de leerling op vóór het tonen van feedback. Vergelijkt predicted vs actual score en berekent calibration delta (-1=overschat, 0=gekalibreerd, 1=onderschat).",
      inputSchema: z.object({
        questionId: z.string(),
        predictedScore: z.enum(["correct", "partial", "incorrect"]),
      }),
    },
    async (args) => {
      const question = await repos.questions.get(args.questionId);
      if (!question) throw new NotFoundError("Question not found");

      const answer = await repos.answers.getByQuestion(args.questionId);
      if (!answer) throw new NotFoundError("No answer submitted yet");

      const feedback = await repos.feedback.getByAnswer(answer.id);
      if (!feedback) {
        throw new ValidationError(
          "Feedback has not been created yet. Calibration requires an actual score.",
        );
      }

      const actualScore = feedback.score;
      const delta = computeCalibrationDelta(args.predictedScore, actualScore);

      const entry = await repos.calibration.create({
        questionId: args.questionId,
        domainId: question.domainId,
        predictedScore: args.predictedScore,
        actualScore,
        delta,
      });

      return txt(entry);
    },
  );

  defineTool(
    server,
    "get_calibration_summary",
    {
      description:
        "Haal calibratiepatronen op per domein. Toont gemiddelde delta en aantal metingen. Gebruik dit om de leerling te helpen hun zelfkennis te verbeteren.",
      inputSchema: z.object({}),
    },
    async () => txt(await repos.calibration.getSummary()),
  );
}
