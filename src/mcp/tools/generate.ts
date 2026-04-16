import { z } from "zod";
import { defineTool, txt } from "../define_tool.ts";
import type { ToolCtx } from "./context.ts";
import { validateSceneDocument } from "../../scrim/validate.ts";
import { toSceneDocumentSnapshot } from "../../scrim/snapshot.ts";
import { recordFeedbackAndProgress } from "../../domain/feedback.ts";

export function register({ server, repos }: ToolCtx): void {
  defineTool(
    server,
    "create_week_plan",
    {
      description: "Maak het weekplan aan voor de komende week",
      inputSchema: z.object({
        weekNumber: z.number(),
        domainId: z.string(),
        isStretchWeek: z.boolean(),
        summary: z.string(),
      }),
    },
    async (args) => txt(await repos.weeks.create(args)),
  );

  defineTool(
    server,
    "create_day_content",
    {
      description:
        "Genereer en sla de content op voor een specifieke dag. Gebruik sceneDocument voor interactieve Scrim-content (theory, practice, assessment). Het body veld is altijd verplicht als tekstsamenvatting.",
      inputSchema: z.object({
        weekNumber: z.number(),
        dayOfWeek: z.number().min(1).max(6),
        type: z.enum([
          "theory",
          "practice_guided",
          "practice_open",
          "practice_troubleshoot",
          "assessment",
          "review",
          "retention",
        ]),
        domainId: z.string(),
        title: z.string(),
        body: z.string(),
        sceneDocument: z.unknown().optional(),
        basedOn: z.array(z.string()).optional(),
      }),
    },
    async (args) => {
      if (args.sceneDocument) {
        const validation = validateSceneDocument(args.sceneDocument);
        if (!validation.valid) {
          return txt({
            error: "Invalid SceneDocument",
            errors: validation.errors,
          });
        }
      }
      return txt(
        await repos.days.create({
          ...args,
          dayOfWeek: args.dayOfWeek as 1 | 2 | 3 | 4 | 5 | 6,
          sceneDocument: args.sceneDocument
            ? toSceneDocumentSnapshot(args.sceneDocument)
            : undefined,
        }),
      );
    },
  );

  defineTool(
    server,
    "create_questions",
    {
      description:
        "Voeg vragen toe aan een dagcontent. Gebruik scrimCheckpoint om een vraag te koppelen aan een Scrim challenge checkpoint.",
      inputSchema: z.object({
        dayContentId: z.string(),
        questions: z.array(z.object({
          domainId: z.string(),
          sequence: z.number(),
          type: z.enum(["scenario", "open", "multiple_choice", "troubleshoot"]),
          body: z.string(),
          maxLevel: z.number(),
          deadline: z.string(),
          options: z.array(
            z.object({
              key: z.enum(["A", "B", "C", "D"]),
              text: z.string(),
              isOptimal: z.boolean(),
            }),
          ).optional(),
          hints: z.array(z.string()).optional(),
          scrimCheckpoint: z.string().optional(),
          metacognitiveType: z.enum(["forethought", "monitoring", "reflection"])
            .optional(),
        })),
      }),
    },
    async (args) =>
      txt(
        await repos.questions.create(
          args.questions.map((q) => ({
            ...q,
            dayContentId: args.dayContentId,
          })),
        ),
      ),
  );

  defineTool(
    server,
    "create_feedback",
    {
      description:
        "Schrijf feedback op een antwoord. Gebruik de drie-componentenstructuur: feedUp (waar gaat de leerling naartoe), feedBack (hoe deed hij het), feedForward (wat moet hij nu doen). Kies het hoogste feedbackLevel dat van toepassing is: task < process < self_regulation.",
      inputSchema: z.object({
        answerId: z.string(),
        questionId: z.string(),
        score: z.enum(["correct", "partial", "incorrect"]),
        explanation: z.string(),
        suggestedLevel: z.number().min(0).max(5),
        levelApplied: z.boolean(),
        improvements: z.array(z.string()),
        feedUp: z.string().optional(),
        feedBack: z.string().optional(),
        feedForward: z.string().optional(),
        feedbackLevel: z.enum(["task", "process", "self_regulation"])
          .optional(),
      }),
    },
    async (args) => txt(await recordFeedbackAndProgress(repos, args)),
  );
}
