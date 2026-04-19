import { z } from "zod";
import { defineTool, txt } from "../define_tool.ts";
import type { ToolCtx } from "./context.ts";
import {
  computeNextLearnerTheme,
  resolveLearnerTheme,
  revertLearnerTheme,
} from "../../domain/learner_theme.ts";
import { mergeTheme } from "../../design/themes/merge.ts";
import { presetFor } from "../../design/themes/presets.ts";
import {
  ThemePartialSchema,
  ThemePresetIdSchema,
} from "../../config/schemas/theme.ts";

export function register({ server, repos, config }: ToolCtx): void {
  defineTool(
    server,
    "get_theme",
    {
      description:
        "Haal de actieve theme op — het samengestelde resultaat van default preset ← course theme.config.yaml ← LearnerState.theme. Retourneert ook het opgeslagen LearnerTheme record voor introspectie (inclusief ai_proposed voorstellen die nog niet actief zijn).",
      inputSchema: z.object({}),
    },
    async () => {
      const learnerState = await repos.learnerState.get();
      const learnerOverlay = resolveLearnerTheme(learnerState);
      const basePresetId = learnerOverlay?.preset ?? config.theme.preset;
      const composed = mergeTheme(
        presetFor(basePresetId),
        config.theme.overrides ?? {},
        learnerOverlay?.overrides ?? {},
      );
      return txt({
        active: composed,
        learner: learnerState?.theme ?? null,
      });
    },
  );

  defineTool(
    server,
    "set_theme",
    {
      description:
        "Schrijf een learner-scoped theme via de state-machine. source='user' zet een eigen keuze (supersede-t een openstaand ai_proposed). source='revert' rolt één stap terug naar previous (of naar het course theme als previous leeg is).",
      inputSchema: z.union([
        z.object({
          source: z.literal("user"),
          preset: ThemePresetIdSchema.optional(),
          overrides: ThemePartialSchema.optional(),
        }),
        z.object({
          source: z.literal("revert"),
        }),
      ]),
    },
    async (args) => {
      const current = await repos.learnerState.get() ?? {
        intake: { completed: false },
        wellbeing: { status: "active" as const },
      };

      const nextTheme = args.source === "revert"
        ? revertLearnerTheme(current.theme)
        : computeNextLearnerTheme(current.theme, {
          source: "user",
          preset: args.preset,
          overrides: args.overrides,
        });

      if (args.source === "user" && !args.preset && !args.overrides) {
        return txt({
          error: "set_theme source=user requires preset or overrides",
        });
      }

      await repos.learnerState.put({ ...current, theme: nextTheme });
      return txt({ learner: nextTheme ?? null });
    },
  );
}
