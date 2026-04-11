import { validate } from "@scrim/validate";
import type { ValidationResult } from "@scrim/validate";

export type { ValidationResult };

/**
 * Validate a SceneDocument JSON value.
 *
 * Runs structural validation (shape, types, required fields) followed by
 * semantic validation (id uniqueness, ref resolution, checkpoint naming,
 * hint thresholds, evaluator keys, node types, challenge steps).
 *
 * Used by the MCP tool handler and API routes to reject invalid documents
 * before storage.
 */
export function validateSceneDocument(document: unknown): ValidationResult {
  return validate(document);
}
