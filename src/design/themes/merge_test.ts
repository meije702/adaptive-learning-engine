import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertNotStrictEquals } from "@std/assert";
import { defaultTheme } from "./default.ts";
import { mergeTheme } from "./merge.ts";

describe("mergeTheme — fitness #5 (identity)", () => {
  it("mergeTheme(x, {}) is structurally equal to x", () => {
    const result = mergeTheme(defaultTheme, {});
    assertEquals(result, defaultTheme);
  });

  it("returns a fresh object (no input mutation)", () => {
    const result = mergeTheme(defaultTheme, {});
    assertNotStrictEquals(result, defaultTheme);
    assertNotStrictEquals(result.color, defaultTheme.color);
  });

  it("identity under multiple empty partials", () => {
    const result = mergeTheme(defaultTheme, {}, {}, {});
    assertEquals(result, defaultTheme);
  });
});

describe("mergeTheme — fitness #6 (deep overrides)", () => {
  it("overrides a single nested leaf without affecting siblings", () => {
    const result = mergeTheme(defaultTheme, {
      color: { primary: "#ff0000" },
    });
    assertEquals(result.color.primary, "#ff0000");
    // siblings in color survive
    assertEquals(result.color.text, defaultTheme.color.text);
    assertEquals(result.color.bg, defaultTheme.color.bg);
    // other top-level groups survive
    assertEquals(result.font, defaultTheme.font);
    assertEquals(result.spacing, defaultTheme.spacing);
    assertEquals(result.radius, defaultTheme.radius);
  });

  it("overrides multiple groups independently", () => {
    const result = mergeTheme(defaultTheme, {
      color: { primary: "#ff0000" },
      spacing: { md: "20px" },
      radius: "12px",
    });
    assertEquals(result.color.primary, "#ff0000");
    assertEquals(result.spacing.md, "20px");
    assertEquals(result.radius, "12px");
    // non-overridden siblings survive
    assertEquals(result.spacing.lg, defaultTheme.spacing.lg);
  });

  it("applies partials left-to-right, right wins", () => {
    const result = mergeTheme(
      defaultTheme,
      { color: { primary: "#111111" } },
      { color: { primary: "#222222" } },
    );
    assertEquals(result.color.primary, "#222222");
  });

  it("ignores undefined leaves in partials", () => {
    const result = mergeTheme(defaultTheme, {
      color: { primary: undefined },
    });
    assertEquals(result.color.primary, defaultTheme.color.primary);
  });
});
