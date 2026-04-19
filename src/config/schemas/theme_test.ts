import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import {
  cssColor,
  ThemeConfigSchema,
  ThemePartialSchema,
  ThemeSchema,
} from "./theme.ts";

describe("cssColor (fitness #8 core)", () => {
  const valid = [
    "#fff",
    "#ffffff",
    "#ffffffff",
    "rgb(1, 2, 3)",
    "rgba(1,2,3,0.5)",
    "hsl(200 50% 50%)",
    "oklch(70% 0.1 120)",
    "color-mix(in srgb, red, blue)",
    "transparent",
    "currentColor",
    "red",
  ];
  const invalid = [
    "not a color",
    "#gg",
    "rgb(",
    "#12345",
  ];

  for (const v of valid) {
    it(`accepts ${v}`, () => {
      const result = cssColor.safeParse(v);
      assertEquals(result.success, true, `expected valid: ${v}`);
    });
  }
  for (const v of invalid) {
    it(`rejects ${v}`, () => {
      const result = cssColor.safeParse(v);
      assertEquals(result.success, false, `expected invalid: ${v}`);
    });
  }
});

describe("ThemeSchema", () => {
  const validTheme = {
    font: {
      family: "system-ui",
      size: "16px",
      lineHeight: "1.6",
      mono: "monospace",
    },
    color: {
      text: "#000",
      bg: "#fff",
      primary: "#2563eb",
      primaryLight: "#dbeafe",
      danger: "#dc2626",
      warning: "#d97706",
      success: "#16a34a",
      info: "#0891b2",
      muted: "#6b7280",
      border: "#e5e7eb",
    },
    spacing: {
      xs: "4px",
      sm: "8px",
      md: "16px",
      lg: "24px",
      xl: "32px",
    },
    radius: "6px",
    shadow: "0 1px 3px rgba(0,0,0,0.1)",
  };

  it("accepts a valid theme", () => {
    assertEquals(ThemeSchema.safeParse(validTheme).success, true);
  });

  it("rejects unknown top-level keys", () => {
    const withExtra = { ...validTheme, bogus: "x" };
    assertEquals(ThemeSchema.safeParse(withExtra).success, false);
  });

  it("rejects invalid color values", () => {
    const bad = {
      ...validTheme,
      color: { ...validTheme.color, primary: "not a color" },
    };
    assertEquals(ThemeSchema.safeParse(bad).success, false);
  });

  it("rejects missing required tokens", () => {
    const missing = { ...validTheme, radius: undefined };
    assertEquals(ThemeSchema.safeParse(missing).success, false);
  });
});

describe("ThemePartialSchema", () => {
  it("accepts an empty object", () => {
    assertEquals(ThemePartialSchema.safeParse({}).success, true);
  });

  it("accepts a single nested override", () => {
    const result = ThemePartialSchema.safeParse({
      color: { primary: "#ff0000" },
    });
    assertEquals(result.success, true);
  });

  it("rejects unknown nested keys", () => {
    const result = ThemePartialSchema.safeParse({
      color: { bogus: "#000" },
    });
    assertEquals(result.success, false);
  });

  it("validates color values even in partials", () => {
    const result = ThemePartialSchema.safeParse({
      color: { primary: "not a color" },
    });
    assertEquals(result.success, false);
  });
});

describe("ThemeConfigSchema", () => {
  it("accepts an empty config", () => {
    assertEquals(ThemeConfigSchema.safeParse({}).success, true);
  });

  it("accepts a preset reference", () => {
    assertEquals(
      ThemeConfigSchema.safeParse({ preset: "dark" }).success,
      true,
    );
  });

  it("rejects an unknown preset", () => {
    assertEquals(
      ThemeConfigSchema.safeParse({ preset: "neon" }).success,
      false,
    );
  });

  it("accepts preset + overrides together", () => {
    const result = ThemeConfigSchema.safeParse({
      preset: "dark",
      overrides: { color: { primary: "#ff00ff" } },
    });
    assertEquals(result.success, true);
  });

  it("rejects unknown top-level keys", () => {
    const result = ThemeConfigSchema.safeParse({ bogus: "x" });
    assertEquals(result.success, false);
  });
});
