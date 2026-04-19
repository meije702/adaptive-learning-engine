import { McpServer } from "./sdk_compat.js";
import type { Repositories } from "../db/repositories.ts";
import type { AppConfig } from "../config/loader.ts";
import { loadLanguageReference } from "../scrim/language_reference.ts";
import type { ToolCtx } from "./tools/context.ts";
import * as observe from "./tools/observe.ts";
import * as generate from "./tools/generate.ts";
import * as steer from "./tools/steer.ts";
import * as scheduling from "./tools/scheduling.ts";
import * as calibration from "./tools/calibration.ts";
import * as wellbeing from "./tools/wellbeing.ts";
import * as gap from "./tools/gap.ts";
import * as intake from "./tools/intake.ts";
import * as theme from "./tools/theme.ts";

/**
 * Build the MCP server for the Adaptive Learning Engine.
 *
 * Tool registrations live in src/mcp/tools/*.ts, grouped by concern. Each
 * module exports `register(ctx)` and this file simply wires them up.
 */
export async function createMcpServer(
  repos: Repositories,
  config: AppConfig,
): Promise<InstanceType<typeof McpServer>> {
  const langRef = await loadLanguageReference();

  const server = new McpServer(
    { name: "adaptive-learning-engine", version: "1.0.0" },
    {
      instructions:
        `MCP server voor het ${config.curriculum.meta.name} leersysteem.
Gebruik observe-tools om de huidige staat te lezen, generate-tools om content te schrijven, en steer-tools om voortgang bij te werken.

## Scrim SceneDocument generatie

Gebruik SceneDocuments voor theory, practice en assessment dagen. Retention quick-recall kan plain text + losse vragen blijven.

Wanneer je een SceneDocument genereert, geef het mee als JSON in het sceneDocument veld van create_day_content. Het body veld moet altijd een korte tekstsamenvatting bevatten (voor zoeken en fallback).

## Metacognitieve scaffolding

Embed metacognitieve momenten op natuurlijke punten:
- **Forethought**: begin van practice-dagen — "Wat is je aanpak?" (metacognitiveType: "forethought")
- **Monitoring**: halverwege langere oefeningen — "Werkt deze aanpak?" (metacognitiveType: "monitoring")
- **Reflection**: na assessments, vóór feedback — "Hoe denk je dat het ging?" (metacognitiveType: "reflection")

Gebruik deze niet bij elke sessie — alleen wanneer het waarde toevoegt. In Scrim SceneDocuments kun je ask-steps gebruiken voor metacognitieve prompts.

## Feedback structuur

Gebruik de drie-componentenstructuur bij create_feedback:
- feedUp: waar gaat de leerling naartoe? (verbind met hun doel)
- feedBack: hoe deed hij het? (specifiek, evidence-based)
- feedForward: wat moet hij nu doen? (concreet, actionable — dit is het belangrijkst)
Kies het hoogste feedbackLevel: task < process < self_regulation.

${langRef}`,
    },
  );

  const ctx: ToolCtx = { server, repos, config };
  observe.register(ctx);
  generate.register(ctx);
  steer.register(ctx);
  scheduling.register(ctx);
  calibration.register(ctx);
  wellbeing.register(ctx);
  gap.register(ctx);
  intake.register(ctx);
  theme.register(ctx);

  return server;
}
