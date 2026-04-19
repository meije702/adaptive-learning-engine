import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { ThemeSchema } from "@/config/schemas/theme.ts";
import { defaultTheme } from "./default.ts";
import { darkTheme } from "./dark.ts";
import { highContrastTheme } from "./high_contrast.ts";

/**
 * Fitness #7 — every preset satisfies ThemeSchema.
 *
 * Keeps presets honest: every required token has a value, every color
 * passes the cssColor validator, no unknown keys. If a preset drifts from
 * the schema, this test fails before the preset is ever loaded at runtime.
 */

const PRESETS = [
  ["default", defaultTheme],
  ["dark", darkTheme],
  ["high_contrast", highContrastTheme],
] as const;

describe("preset theme modules (fitness #7)", () => {
  for (const [name, preset] of PRESETS) {
    it(`${name} satisfies ThemeSchema`, () => {
      const result = ThemeSchema.safeParse(preset);
      if (!result.success) {
        throw new Error(
          `Preset "${name}" failed schema validation: ${
            JSON.stringify(result.error.format(), null, 2)
          }`,
        );
      }
      assertEquals(result.success, true);
    });
  }
});
