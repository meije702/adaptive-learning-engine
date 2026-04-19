import type { LearnerState } from "../types.ts";
import type { LearnerStateRepository } from "../repositories.ts";
import { LearnerThemeSchema } from "../../domain/learner_theme.ts";
import { ValidationError } from "../../domain/errors.ts";

/**
 * KV-backed learner state repository.
 *
 * `put` validates `theme` (if present) against LearnerThemeSchema so the
 * provenance invariants from docs/design-system.md § Fitness #9 (source ↔
 * timestamp fields, preset-or-overrides) are enforced at the storage
 * boundary, regardless of which entry point wrote the state (REST, MCP,
 * test, or a future migration tool).
 */
export class KvLearnerStateRepository implements LearnerStateRepository {
  constructor(private kv: Deno.Kv) {}

  async get(): Promise<LearnerState | null> {
    const result = await this.kv.get<LearnerState>(["learner_state"]);
    return result.value;
  }

  async put(state: LearnerState): Promise<void> {
    if (state.theme !== undefined) {
      const result = LearnerThemeSchema.safeParse(state.theme);
      if (!result.success) {
        const issues = result.error.issues
          .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
          .join("\n");
        throw new ValidationError(
          `Invalid LearnerState.theme:\n${issues}`,
        );
      }
    }
    await this.kv.set(["learner_state"], state);
  }
}
