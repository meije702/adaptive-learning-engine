import { define } from "../../utils.ts";
import { jsonResponse, parseJsonBody } from "../../api/helpers.ts";
import { badRequest } from "../../api/error.ts";
import { problemFromDomainError } from "../../api/error.ts";
import {
  computeNextLearnerTheme,
  resolveLearnerTheme,
  revertLearnerTheme,
} from "../../domain/learner_theme.ts";
import { DomainError } from "../../domain/errors.ts";
import { mergeTheme } from "../../design/themes/merge.ts";
import { presetFor } from "../../design/themes/presets.ts";
import {
  ThemePartialSchema,
  ThemePresetIdSchema,
} from "../../config/schemas/theme.ts";
import { z } from "zod";

/**
 * GET /api/theme
 *   → the resolved rendering theme + the stored LearnerTheme (if any).
 * PUT /api/theme
 *   → writes a new LearnerTheme via the state-machine. Two shapes:
 *     { source: "user", preset?, overrides? }    — set a user pick
 *     { source: "revert" }                        — undo one step
 *   (ai_proposed / ai_accepted writes come via the MCP design tools in D8.)
 */

const UserBody = z
  .object({
    source: z.literal("user"),
    preset: ThemePresetIdSchema.optional(),
    overrides: ThemePartialSchema.optional(),
  })
  .refine(
    (v) => v.preset !== undefined || v.overrides !== undefined,
    { message: "user theme write must include preset or overrides" },
  );
const RevertBody = z.object({ source: z.literal("revert") });
const PutBodySchema = z.union([UserBody, RevertBody]);

export const handler = define.handlers({
  async GET(ctx) {
    const { repos, config } = ctx.state;
    const learnerState = await repos.learnerState.get();
    const learnerOverlay = resolveLearnerTheme(learnerState);
    const basePresetId = learnerOverlay?.preset ?? config.theme.preset;
    const composed = mergeTheme(
      presetFor(basePresetId),
      config.theme.overrides ?? {},
      learnerOverlay?.overrides ?? {},
    );
    return jsonResponse({
      active: composed,
      learner: learnerState?.theme ?? null,
    });
  },

  async PUT(ctx) {
    const raw = await parseJsonBody<unknown>(ctx.req);
    const parsed = PutBodySchema.safeParse(raw);
    if (!parsed.success) {
      return badRequest(
        "Invalid theme body: " +
          parsed.error.issues.map((i) => i.message).join("; "),
        "/api/theme",
      );
    }

    const { repos } = ctx.state;
    const current = await repos.learnerState.get() ?? {
      intake: { completed: false },
      wellbeing: { status: "active" as const },
    };

    try {
      const nextTheme = parsed.data.source === "revert"
        ? revertLearnerTheme(current.theme)
        : computeNextLearnerTheme(current.theme, {
          source: "user",
          preset: parsed.data.preset,
          overrides: parsed.data.overrides,
        });

      const nextState = { ...current, theme: nextTheme };
      await repos.learnerState.put(nextState);

      return jsonResponse({
        learner: nextTheme ?? null,
      });
    } catch (err) {
      const mapped = problemFromDomainError(err, "/api/theme");
      if (mapped) return mapped;
      if (err instanceof DomainError) {
        return badRequest(err.message, "/api/theme");
      }
      throw err;
    }
  },
});
