/**
 * Learner-scoped theme — domain logic.
 *
 * Layer 4 from docs/design-system.md. Implements:
 *  - LearnerThemeSchema / PreviousThemeSchema with provenance refinements
 *    (fitness #9)
 *  - computeNextLearnerTheme(existing, incoming, courseRender):
 *    LearnerTheme | undefined — the state-machine write-guard used by
 *    the repo (fitness #10). Captures: populate `previous` from
 *    rendered state; `source === "user"` supersedes an outstanding
 *    ai_proposed; no-op writes don't mutate `previous`.
 *  - resolveLearnerTheme(state): LearnerTheme | undefined — the render
 *    selector (fitness #11 — ai_proposed never renders).
 */

import { z } from "zod";
import {
  ThemePartialSchema,
  ThemePresetIdSchema,
} from "../config/schemas/theme.ts";
import type {
  LearnerTheme,
  LearnerThemeSource,
  PreviousTheme,
} from "../db/types.ts";

// --- Schemas -------------------------------------------------------------

const LearnerThemeSourceSchema = z.enum([
  "user",
  "ai_proposed",
  "ai_accepted",
]);

const PreviousThemeSourceSchema = z.enum(["user", "ai_accepted"]);

/**
 * Previous-theme snapshot. By construction no nested `previous` field —
 * the revert chain is one deep.
 */
export const PreviousThemeSchema = z.object({
  source: PreviousThemeSourceSchema,
  preset: ThemePresetIdSchema.optional(),
  overrides: ThemePartialSchema.optional(),
}).strict();

/**
 * Fitness #9 — provenance invariants.
 *
 *   ai_proposed  ⇒ proposedAt is present
 *   ai_accepted  ⇒ proposedAt AND acceptedAt are present
 *
 * Also: a LearnerTheme must reference *something* — either a preset or at
 * least one override — otherwise it's an empty record with no rendering
 * effect (drop it instead).
 */
export const LearnerThemeSchema = z
  .object({
    source: LearnerThemeSourceSchema,
    preset: ThemePresetIdSchema.optional(),
    overrides: ThemePartialSchema.optional(),
    proposedAt: z.string().min(1).optional(),
    acceptedAt: z.string().min(1).optional(),
    previous: PreviousThemeSchema.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!v.preset && !v.overrides) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "LearnerTheme must include a preset or overrides",
      });
    }
    if (v.source === "ai_proposed" && !v.proposedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "source=ai_proposed requires proposedAt",
        path: ["proposedAt"],
      });
    }
    if (v.source === "ai_accepted") {
      if (!v.proposedAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "source=ai_accepted requires proposedAt (original proposal timestamp persists through accept)",
          path: ["proposedAt"],
        });
      }
      if (!v.acceptedAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "source=ai_accepted requires acceptedAt",
          path: ["acceptedAt"],
        });
      }
    }
  });

// --- Domain operations ---------------------------------------------------

/**
 * What IS the rendered theme based on learner state? Returns undefined when
 * the course-level theme should render.
 *
 * Fitness #11: `source === "ai_proposed"` never reaches rendering — it's
 * data-only (an inbox item).
 */
export function resolveLearnerTheme(
  state: { theme?: LearnerTheme } | null | undefined,
): LearnerTheme | undefined {
  const t = state?.theme;
  if (!t) return undefined;
  if (t.source === "ai_proposed") return undefined;
  return t;
}

/**
 * The canonical "what was rendering" snapshot. Used to populate `previous`
 * when a write supersedes the current rendered theme.
 *
 * Returns undefined when the course-level theme is what's rendering
 * (no learner override). Absence of `previous` on a LearnerTheme means
 * "revert returns to course theme."
 */
export function renderSnapshotOf(
  state: { theme?: LearnerTheme } | null | undefined,
): PreviousTheme | undefined {
  const rendered = resolveLearnerTheme(state);
  if (!rendered) return undefined;
  // rendered.source is narrower than LearnerThemeSource here — ai_proposed
  // was already filtered out. The remaining values are exactly PreviousTheme's.
  return {
    source: rendered.source as "user" | "ai_accepted",
    preset: rendered.preset,
    overrides: rendered.overrides,
  };
}

/**
 * Structural equality for the render-relevant fields of a theme pair.
 * Used to detect no-op writes.
 */
function sameRender(
  a: Pick<LearnerTheme, "source" | "preset" | "overrides">,
  b: Pick<LearnerTheme, "source" | "preset" | "overrides">,
): boolean {
  return a.source === b.source &&
    a.preset === b.preset &&
    JSON.stringify(a.overrides ?? {}) === JSON.stringify(b.overrides ?? {});
}

export interface ThemeWriteInput {
  source: LearnerThemeSource;
  preset?: LearnerTheme["preset"];
  overrides?: LearnerTheme["overrides"];
  /** When source ∈ {ai_proposed, ai_accepted} — if omitted for
   *  ai_proposed, `now` is used; for ai_accepted the caller must pass
   *  the original proposal's proposedAt. */
  proposedAt?: string;
}

/**
 * Fitness #10 — compute the next LearnerTheme from an incoming write.
 *
 * State machine:
 *   - source="user" over any existing state → new user theme; `previous`
 *     captures what was RENDERING (not the superseded ai_proposed, if any).
 *     No-op writes (same render) preserve the existing `previous`.
 *   - source="ai_proposed" → inbox item; `previous` left unset (not
 *     rendering; no revert target needed).
 *   - source="ai_accepted" → transitions from ai_proposed; `previous`
 *     captures pre-proposal render state, which for ai_proposed is the
 *     same as before the proposal landed (the proposal didn't render).
 *
 * Returns the new LearnerTheme to persist, or `undefined` to delete the
 * field entirely (e.g., a no-op write when no state existed).
 */
export function computeNextLearnerTheme(
  existing: LearnerTheme | undefined,
  incoming: ThemeWriteInput,
  now: string = new Date().toISOString(),
): LearnerTheme {
  // "What was rendering before this write" — the basis for `previous`.
  const renderedBefore = existing && existing.source !== "ai_proposed"
    ? {
      source: existing.source as "user" | "ai_accepted",
      preset: existing.preset,
      overrides: existing.overrides,
    }
    : undefined;

  if (incoming.source === "user") {
    // No-op detection: same render + already a "user" entry ⇒ preserve
    // the existing `previous` (don't overwrite it with itself).
    if (
      existing?.source === "user" &&
      sameRender(
        {
          source: "user",
          preset: incoming.preset,
          overrides: incoming.overrides,
        },
        existing,
      )
    ) {
      return existing;
    }
    return {
      source: "user",
      preset: incoming.preset,
      overrides: incoming.overrides,
      previous: renderedBefore,
    };
  }

  if (incoming.source === "ai_proposed") {
    // Proposals do NOT render, so no `previous` is needed; reverting
    // from a proposal is just "discard the proposal."
    return {
      source: "ai_proposed",
      preset: incoming.preset,
      overrides: incoming.overrides,
      proposedAt: incoming.proposedAt ?? now,
    };
  }

  // ai_accepted
  // Must come paired with a proposedAt (persisted through the transition).
  // renderedBefore here is the pre-proposal render state: the proposal
  // itself didn't render, so renderedBefore correctly captures course /
  // prior user pick.
  const proposedAt = incoming.proposedAt ?? existing?.proposedAt ?? now;
  return {
    source: "ai_accepted",
    preset: incoming.preset,
    overrides: incoming.overrides,
    proposedAt,
    acceptedAt: now,
    previous: renderedBefore,
  };
}

/**
 * Revert the learner-scoped theme one step. Returns the new LearnerTheme
 * (or `undefined` to delete the field and fall through to course theme).
 */
export function revertLearnerTheme(
  existing: LearnerTheme | undefined,
): LearnerTheme | undefined {
  if (!existing?.previous) return undefined;
  return {
    source: existing.previous.source,
    preset: existing.previous.preset,
    overrides: existing.previous.overrides,
    // previous of the revert target is dropped — chain stays one deep.
  };
}
