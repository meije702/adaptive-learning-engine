import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { themeProperties } from "@scrim/web";

/**
 * Fitness function — Scrim token snapshot.
 *
 * Freezes the current set of CSS custom properties that Scrim exposes via
 * `themeProperties`. If Scrim adds, removes, or renames a token in a dep
 * bump, this test fails before anything else does and forces a deliberate
 * review. See docs/design-system.md § WP-D0.
 *
 * When Scrim intentionally evolves its token set:
 *   1) Update EXPECTED_TOKENS below to match.
 *   2) Update `src/design/tokens/aliases.css` (fitness #1).
 *   3) Update `src/design/themes/default.ts` + other presets (fitness #2, #7).
 *   4) Commit all of the above together — the failing snapshot is the
 *      forcing function that guarantees those updates happen.
 */

const EXPECTED_TOKENS: readonly string[] = [
  // Typography
  "--scrim-font-family",
  "--scrim-font-size",
  "--scrim-line-height",
  "--scrim-font-mono",

  // Color
  "--scrim-color-text",
  "--scrim-color-bg",
  "--scrim-color-primary",
  "--scrim-color-primary-light",
  "--scrim-color-danger",
  "--scrim-color-warning",
  "--scrim-color-success",
  "--scrim-color-info",
  "--scrim-color-muted",
  "--scrim-color-border",

  // Spacing
  "--scrim-spacing-xs",
  "--scrim-spacing-sm",
  "--scrim-spacing-md",
  "--scrim-spacing-lg",
  "--scrim-spacing-xl",

  // Surface
  "--scrim-radius",
  "--scrim-shadow",
];

describe("Scrim token vocabulary snapshot", () => {
  it("exports exactly the expected set of CSS custom properties", () => {
    const actual = Object.keys(themeProperties).sort();
    const expected = [...EXPECTED_TOKENS].sort();
    assertEquals(actual, expected);
  });

  it("every token has a non-empty string value", () => {
    for (const [key, value] of Object.entries(themeProperties)) {
      assertEquals(
        typeof value,
        "string",
        `Token ${key} must be a string, got ${typeof value}`,
      );
      if ((value as string).length === 0) {
        throw new Error(`Token ${key} has empty string value`);
      }
    }
  });
});
