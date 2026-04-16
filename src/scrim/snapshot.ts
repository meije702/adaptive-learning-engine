/**
 * Persistence wrapper for Scrim SceneDocuments.
 *
 * The Scrim SceneDocument shape evolves upstream (new step types, new
 * protocol versions). Storing the raw JSON under DayContent.sceneDocument
 * means a learner's historical days break the moment the upstream shape
 * changes. Wrapping it here gives us one explicit seam to migrate from.
 *
 * Old DayContent records stored the raw SceneDocument directly — readers
 * should use `unwrapSceneDocument` which tolerates both shapes.
 */

export interface SceneDocumentSnapshot {
  schemaVersion: 1;
  /** Opaque SceneDocument payload — Scrim types live in @scrim/core. */
  document: unknown;
}

/** Wrap a freshly-built SceneDocument for persistence. */
export function toSceneDocumentSnapshot(
  document: unknown,
): SceneDocumentSnapshot {
  return { schemaVersion: 1, document };
}

/**
 * Normalise a stored sceneDocument value back to the raw SceneDocument.
 * Returns undefined / null when the stored value is missing.
 */
export function unwrapSceneDocument(stored: unknown): unknown {
  if (stored == null) return stored;
  if (typeof stored === "object") {
    const maybe = stored as { schemaVersion?: number; document?: unknown };
    if (typeof maybe.schemaVersion === "number" && "document" in maybe) {
      return maybe.document;
    }
  }
  return stored;
}
