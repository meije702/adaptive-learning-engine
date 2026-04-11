import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import type { CreateQuestion, Repositories } from "../db/repositories.ts";
import type { AppConfig } from "../config/loader.ts";
import { validateSceneDocument } from "../scrim/validate.ts";
import { loadLanguageReference } from "../scrim/language_reference.ts";

// deno-lint-ignore no-explicit-any
type AnyCallback = (...args: any[]) => any;

function txt(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

export async function createMcpServer(
  repos: Repositories,
  config: AppConfig,
): Promise<McpServer> {
  const langRef = await loadLanguageReference();

  const server = new McpServer(
    { name: "adaptive-learning-engine", version: "1.0.0" },
    {
      instructions: `MCP server voor het ${config.curriculum.meta.name} leersysteem.
Gebruik observe-tools om de huidige staat te lezen, generate-tools om content te schrijven, en steer-tools om voortgang bij te werken.

## Scrim SceneDocument generatie

Gebruik SceneDocuments voor theory, practice en assessment dagen. Retention quick-recall kan plain text + losse vragen blijven.

Wanneer je een SceneDocument genereert, geef het mee als JSON in het sceneDocument veld van create_day_content. Het body veld moet altijd een korte tekstsamenvatting bevatten (voor zoeken en fallback).

${langRef}`,
    },
  );

  // ── Observe ────────────────────────────────

  server.registerTool("get_dashboard", {
    description: "Haal het complete overzicht op",
    inputSchema: z.object({}),
  }, (async () => {
    const [progress, weeks, pending, retentionDue] = await Promise.all([
      repos.progress.getAll(), repos.weeks.getAll(),
      repos.questions.getPending(), repos.retention.getDue(),
    ]);
    const currentWeek = weeks.length > 0 ? Math.max(...weeks.map((w) => w.weekNumber)) : 0;
    return txt({
      currentWeek,
      overallProgress: { totalDomains: config.curriculum.domains.length, domainsStarted: progress.filter((p) => p.level > 0).length },
      pendingQuestions: pending.length,
      retentionDue: retentionDue.length,
    });
  }) as AnyCallback);

  server.registerTool("get_progress", {
    description: "Haal competentieniveaus op voor alle domeinen of één specifiek domein",
    inputSchema: z.object({ domainId: z.string().optional() }),
  }, (async (args: { domainId?: string }) => {
    return txt(args.domainId ? await repos.progress.get(args.domainId) : await repos.progress.getAll());
  }) as AnyCallback);

  server.registerTool("get_pending_answers", {
    description: "Haal alle onbeantwoorde vragen op",
    inputSchema: z.object({}),
  }, (async () => txt(await repos.questions.getPending())) as AnyCallback);

  server.registerTool("get_recent_answers", {
    description: "Haal antwoorden op die nog geen feedback hebben",
    inputSchema: z.object({ since: z.string().optional() }),
  }, (async (args: { since?: string }) => {
    const since = args.since ?? new Date(Date.now() - 86400000).toISOString();
    return txt(await repos.answers.getRecent(since));
  }) as AnyCallback);

  server.registerTool("get_week_overview", {
    description: "Haal alle content, vragen, antwoorden en feedback op voor een week",
    inputSchema: z.object({ weekNumber: z.number() }),
  }, (async (args: { weekNumber: number }) => {
    const plan = await repos.weeks.get(args.weekNumber);
    const days = await repos.days.getByWeek(args.weekNumber);
    return txt({ plan, days });
  }) as AnyCallback);

  server.registerTool("get_retention_due", {
    description: "Welke domeinen zijn toe aan herhaling vandaag?",
    inputSchema: z.object({}),
  }, (async () => txt(await repos.retention.getDue())) as AnyCallback);

  server.registerTool("get_scene_document", {
    description: "Haal het SceneDocument en interaction log op voor een dag. Gebruik dit om learner interacties te evalueren en volgende content te informeren.",
    inputSchema: z.object({ dayContentId: z.string() }),
  }, (async (args: { dayContentId: string }) => {
    const day = await repos.days.getById(args.dayContentId);
    if (!day) return txt({ error: "Day content not found" });
    const interactionLog = await repos.interactionLogs.get(args.dayContentId);
    return txt({
      sceneDocument: day.sceneDocument ?? null,
      interactionLog: interactionLog ?? null,
    });
  }) as AnyCallback);

  // ── Generate ───────────────────────────────

  server.registerTool("create_week_plan", {
    description: "Maak het weekplan aan voor de komende week",
    inputSchema: z.object({
      weekNumber: z.number(), domainId: z.string(),
      isStretchWeek: z.boolean(), summary: z.string(),
    }),
  }, (async (args: { weekNumber: number; domainId: string; isStretchWeek: boolean; summary: string }) => {
    return txt(await repos.weeks.create(args));
  }) as AnyCallback);

  server.registerTool("create_day_content", {
    description: "Genereer en sla de content op voor een specifieke dag. Gebruik sceneDocument voor interactieve Scrim-content (theory, practice, assessment). Het body veld is altijd verplicht als tekstsamenvatting.",
    inputSchema: z.object({
      weekNumber: z.number(), dayOfWeek: z.number().min(1).max(6),
      type: z.enum(["theory", "practice_guided", "practice_open", "practice_troubleshoot", "assessment", "review", "retention"]),
      domainId: z.string(), title: z.string(), body: z.string(),
      sceneDocument: z.unknown().optional(),
      basedOn: z.array(z.string()).optional(),
    }),
  }, (async (args: { weekNumber: number; dayOfWeek: number; type: string; domainId: string; title: string; body: string; sceneDocument?: unknown; basedOn?: string[] }) => {
    if (args.sceneDocument) {
      const validation = validateSceneDocument(args.sceneDocument);
      if (!validation.valid) {
        return txt({ error: "Invalid SceneDocument", errors: validation.errors });
      }
    }
    return txt(await repos.days.create({
      ...args,
      dayOfWeek: args.dayOfWeek as 1 | 2 | 3 | 4 | 5 | 6,
      type: args.type as "theory",
    }));
  }) as AnyCallback);

  server.registerTool("create_questions", {
    description: "Voeg vragen toe aan een dagcontent. Gebruik scrimCheckpoint om een vraag te koppelen aan een Scrim challenge checkpoint.",
    inputSchema: z.object({
      dayContentId: z.string(),
      questions: z.array(z.object({
        domainId: z.string(), sequence: z.number(),
        type: z.enum(["scenario", "open", "multiple_choice", "troubleshoot"]),
        body: z.string(), maxLevel: z.number(), deadline: z.string(),
        options: z.array(z.object({ key: z.enum(["A", "B", "C", "D"]), text: z.string(), isOptimal: z.boolean() })).optional(),
        hints: z.array(z.string()).optional(),
        scrimCheckpoint: z.string().optional(),
      })),
    }),
  }, (async (args: { dayContentId: string; questions: CreateQuestion[] }) => {
    return txt(await repos.questions.create(
      args.questions.map((q) => ({ ...q, dayContentId: args.dayContentId })),
    ));
  }) as AnyCallback);

  server.registerTool("create_feedback", {
    description: "Schrijf feedback op een antwoord en update optioneel het competentieniveau",
    inputSchema: z.object({
      answerId: z.string(), questionId: z.string(),
      score: z.enum(["correct", "partial", "incorrect"]),
      explanation: z.string(), suggestedLevel: z.number().min(0).max(5),
      applyLevel: z.boolean(), improvements: z.array(z.string()),
    }),
  }, (async (args: { answerId: string; questionId: string; score: "correct" | "partial" | "incorrect"; explanation: string; suggestedLevel: number; applyLevel: boolean; improvements: string[] }) => {
    const feedback = await repos.feedback.create(args);
    if (args.applyLevel) {
      const question = await repos.questions.get(args.questionId);
      if (question) {
        await repos.progress.put(question.domainId, {
          level: args.suggestedLevel as 0 | 1 | 2 | 3 | 4 | 5,
          source: "assessment", notes: args.explanation,
        });
      }
    }
    return txt(feedback);
  }) as AnyCallback);

  // ── Steer ──────────────────────────────────

  server.registerTool("update_progress", {
    description: "Werk het competentieniveau bij voor een domein",
    inputSchema: z.object({
      domainId: z.string(), level: z.number().min(0).max(5),
      source: z.enum(["assessment", "retention", "manual"]),
      notes: z.string().optional(),
    }),
  }, (async (args: { domainId: string; level: number; source: "assessment" | "retention" | "manual"; notes?: string }) => {
    return txt(await repos.progress.put(args.domainId, {
      level: args.level as 0 | 1 | 2 | 3 | 4 | 5,
      source: args.source, notes: args.notes,
    }));
  }) as AnyCallback);

  server.registerTool("update_retention", {
    description: "Werk de spaced repetition planning bij na een retentietoets",
    inputSchema: z.object({
      domainId: z.string(), result: z.enum(["correct", "partial", "incorrect"]),
    }),
  }, (async (args: { domainId: string; result: "correct" | "partial" | "incorrect" }) => {
    return txt(await repos.retention.put(args.domainId, args.result));
  }) as AnyCallback);

  server.registerTool("add_retrospective", {
    description: "Voeg een weekretrospective toe",
    inputSchema: z.object({ weekNumber: z.number(), retrospective: z.string() }),
  }, (async (args: { weekNumber: number; retrospective: string }) => {
    return txt(await repos.weeks.addRetrospective(args.weekNumber, args.retrospective));
  }) as AnyCallback);

  return server;
}
