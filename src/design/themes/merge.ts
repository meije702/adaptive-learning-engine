/**
 * Deep merge for themes.
 *
 * Semantics:
 *   mergeTheme(base, ...partials) — start with base; each partial layers
 *   on top in order. Nested objects merge key-by-key; leaf values (strings)
 *   replace. Siblings of an overridden key survive. Partials with
 *   `undefined` leaves are ignored (so Zod-parsed partials with omitted
 *   keys behave correctly).
 *
 * The function is generic over `T` to keep typing honest, but in practice
 * `T = Theme`. All Theme leaves are strings — no arrays or nulls to worry
 * about.
 */

import type { Theme } from "./types.ts";

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function applyInto<T>(target: T, source: DeepPartial<T>): T {
  const out = target as Record<string, unknown>;
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = applyInto(
        existing,
        value as DeepPartial<typeof existing>,
      );
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/**
 * Merge a base theme with zero or more partial overrides, left-to-right.
 * Returns a new `Theme`; the inputs and the result share no references,
 * so callers can treat the result as freely mutable without affecting
 * base. (Theme is small — a full structuredClone up front is cheap.)
 */
export function mergeTheme(
  base: Theme,
  ...partials: DeepPartial<Theme>[]
): Theme {
  const out = structuredClone(base);
  for (const partial of partials) {
    applyInto(out, partial);
  }
  return out;
}
