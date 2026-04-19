import { z } from "zod";
import { defineTool, txt } from "../define_tool.ts";
import type { ToolCtx } from "./context.ts";
import { unwrapSceneDocument } from "../../scrim/snapshot.ts";
import { NotFoundError } from "../../domain/errors.ts";

export function register({ server, repos, config }: ToolCtx): void {
  defineTool(
    server,
    "get_dashboard",
    {
      description: "Haal het complete overzicht op",
      inputSchema: z.object({}),
    },
    async () => {
      const [progress, weeks, pending, retentionDue] = await Promise.all([
        repos.progress.getAll(),
        repos.weeks.getAll(),
        repos.questions.getPending(),
        repos.retention.getDue(),
      ]);
      const currentWeek = weeks.length > 0
        ? Math.max(...weeks.map((w) => w.weekNumber))
        : 0;
      return txt({
        currentWeek,
        overallProgress: {
          totalDomains: config.curriculum.domains.length,
          domainsStarted: progress.filter((p) => p.level > 0).length,
        },
        pendingQuestions: pending.length,
        retentionDue: retentionDue.length,
      });
    },
  );

  defineTool(
    server,
    "get_progress",
    {
      description:
        "Haal competentieniveaus op voor alle domeinen of één specifiek domein",
      inputSchema: z.object({ domainId: z.string().optional() }),
    },
    async (args) =>
      txt(
        args.domainId
          ? await repos.progress.get(args.domainId)
          : await repos.progress.getAll(),
      ),
  );

  defineTool(
    server,
    "get_pending_answers",
    {
      description: "Haal alle onbeantwoorde vragen op",
      inputSchema: z.object({}),
    },
    async () => txt(await repos.questions.getPending()),
  );

  defineTool(
    server,
    "get_recent_answers",
    {
      description: "Haal antwoorden op die nog geen feedback hebben",
      inputSchema: z.object({ since: z.string().optional() }),
    },
    async (args) => {
      const since = args.since ?? new Date(Date.now() - 86400000).toISOString();
      return txt(await repos.answers.getRecent(since));
    },
  );

  defineTool(
    server,
    "get_week_overview",
    {
      description:
        "Haal alle content, vragen, antwoorden en feedback op voor een week",
      inputSchema: z.object({ weekNumber: z.number() }),
    },
    async (args) => {
      const plan = await repos.weeks.get(args.weekNumber);
      const days = (await repos.days.getByWeek(args.weekNumber)).map((day) => ({
        ...day,
        sceneDocument: unwrapSceneDocument(day.sceneDocument),
      }));
      return txt({ plan, days });
    },
  );

  defineTool(
    server,
    "get_retention_due",
    {
      description: "Welke domeinen zijn toe aan herhaling vandaag?",
      inputSchema: z.object({}),
    },
    async () => txt(await repos.retention.getDue()),
  );

  defineTool(
    server,
    "get_scene_document",
    {
      description:
        "Haal het SceneDocument en interaction log op voor een dag. Gebruik dit om learner interacties te evalueren en volgende content te informeren.",
      inputSchema: z.object({ dayContentId: z.string() }),
    },
    async (args) => {
      const day = await repos.days.getById(args.dayContentId);
      if (!day) throw new NotFoundError("Day content not found");
      const interactionLog = await repos.interactionLogs.get(args.dayContentId);
      return txt({
        sceneDocument: unwrapSceneDocument(day.sceneDocument) ?? null,
        interactionLog: interactionLog ?? null,
      });
    },
  );
}
