import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { themeProperties } from "@scrim/web";
import { defaultTheme } from "./default.ts";
import { themeToCustomProps, themeToInlineStyle } from "./apply_to_root.ts";

/**
 * Fitness function #2 — every Scrim token has a default value.
 *
 * If the snapshot test in scrim_tokens_test.ts passes, this test asserts
 * the Theme type + defaultTheme are kept in lockstep with themeProperties
 * via the themeToCustomProps mapping.
 */

describe("defaultTheme", () => {
  it("maps to a custom-prop set that exactly matches Scrim's token vocabulary", () => {
    const actual = Object.keys(themeToCustomProps(defaultTheme)).sort();
    const expected = Object.keys(themeProperties).sort();
    assertEquals(actual, expected);
  });

  it("every mapped value is a non-empty string", () => {
    for (
      const [key, value] of Object.entries(themeToCustomProps(defaultTheme))
    ) {
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Token ${key} has invalid value: ${value}`);
      }
    }
  });
});

describe("themeToInlineStyle", () => {
  it("produces a CSS-valid inline style string", () => {
    const style = themeToInlineStyle(defaultTheme);
    // Each declaration separated by "; ", each declaration is "prop: value".
    const declarations = style.split("; ");
    assertEquals(
      declarations.length,
      Object.keys(themeProperties).length,
      "one declaration per Scrim token",
    );
    for (const decl of declarations) {
      if (!decl.match(/^--scrim-[a-z-]+: .+$/)) {
        throw new Error(`Malformed declaration: ${decl}`);
      }
    }
  });

  it("declarations are stable across calls", () => {
    assertEquals(
      themeToInlineStyle(defaultTheme),
      themeToInlineStyle(defaultTheme),
    );
  });
});
