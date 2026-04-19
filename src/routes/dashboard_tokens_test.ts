import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertMatch, assertNotEquals } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import { defaultTheme } from "@/design/themes/default.ts";
import { darkTheme } from "@/design/themes/dark.ts";
import { highContrastTheme } from "@/design/themes/high_contrast.ts";
import { themeToCustomProps } from "@/design/themes/apply_to_root.ts";
import { parseAliasMap } from "@/design/tokens/aliases.ts";

/**
 * WP-D6 sanity test for the dashboard family (src/routes/index.tsx).
 *
 * The user's regression ask in the design doc: "reads getComputedStyle on
 * a representative element and asserts the resolved value equals the
 * current --ale-* token's value." Deno tests don't have a DOM, so we
 * exercise the same contract without a browser by:
 *
 *   (a) parsing the migrated component's SOURCE for `var(--ale-…)`
 *       references — the source-level post-condition;
 *   (b) walking each referenced alias through aliases.css to its
 *       `--scrim-*` counterpart, then through each preset's
 *       themeToCustomProps map — the runtime resolution path;
 *   (c) asserting that at least one referenced token resolves to
 *       materially different values across the three presets.
 *
 * Case (c) is what a screenshot-diff would catch indirectly: if a
 * literal hex snuck through unchanged, the "resolves differently per
 * preset" invariant would fail. Fitness #4 already blocks hex literals
 * at the grep level; this test covers the complementary failure mode
 * where `var(--ale-X)` is written but `--ale-X` doesn't actually
 * exist or resolves to a fixed value.
 */

const DASHBOARD_PATH = join(
  dirname(fromFileUrl(import.meta.url)),
  "index.tsx",
);

async function readDashboard(): Promise<string> {
  return await Deno.readTextFile(DASHBOARD_PATH);
}

function aliasReferences(source: string): string[] {
  const refs = new Set<string>();
  for (const m of source.matchAll(/var\((--ale-[a-z0-9-]+)\)/g)) {
    refs.add(m[1]);
  }
  return [...refs].sort();
}

describe("dashboard (routes/index.tsx) token flow", () => {
  it("source references at least one --ale-* alias via var()", async () => {
    const refs = aliasReferences(await readDashboard());
    if (refs.length === 0) {
      throw new Error(
        "expected dashboard to reference --ale-* tokens; found none",
      );
    }
  });

  it("every --ale-* referenced has a declared alias", async () => {
    const aliasMap = parseAliasMap();
    const refs = aliasReferences(await readDashboard());
    for (const ref of refs) {
      if (!(ref in aliasMap)) {
        throw new Error(
          `dashboard references ${ref} which is not declared in aliases.css`,
        );
      }
    }
  });

  it("every referenced alias resolves to a string value in every preset", async () => {
    const aliasMap = parseAliasMap();
    const refs = aliasReferences(await readDashboard());
    const presets = {
      default: themeToCustomProps(defaultTheme),
      dark: themeToCustomProps(darkTheme),
      high_contrast: themeToCustomProps(highContrastTheme),
    };
    for (const ref of refs) {
      const scrimName = aliasMap[ref];
      for (const [presetName, props] of Object.entries(presets)) {
        const resolved = props[scrimName];
        assertEquals(
          typeof resolved,
          "string",
          `${ref} via ${scrimName} has no value in preset "${presetName}"`,
        );
        assertMatch(resolved, /\S/, `empty value for ${ref} in ${presetName}`);
      }
    }
  });

  it("at least one referenced token resolves differently across presets (proof of token flow)", async () => {
    const aliasMap = parseAliasMap();
    const refs = aliasReferences(await readDashboard());
    const def = themeToCustomProps(defaultTheme);
    const dark = themeToCustomProps(darkTheme);
    const hc = themeToCustomProps(highContrastTheme);

    let diverges = false;
    for (const ref of refs) {
      const scrimName = aliasMap[ref];
      const v1 = def[scrimName];
      const v2 = dark[scrimName];
      const v3 = hc[scrimName];
      if (v1 !== v2 || v2 !== v3 || v1 !== v3) {
        diverges = true;
        break;
      }
    }
    if (!diverges) {
      throw new Error(
        "no referenced token varies across presets — migration may have left hex literals behind OR chose only theme-invariant tokens (spacing, radius). Ensure the dashboard uses at least one color token.",
      );
    }
  });

  it("source contains no hex color literals (belt-and-braces with fitness #4)", async () => {
    const src = await readDashboard();
    // Strip comments first — level-color mapping table may mention hex
    // values in comments as documentation.
    const noComments = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[\s;{}()])\/\/[^\n]*/gm, "$1");
    const match = noComments.match(/#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_])/);
    assertNotEquals(
      match !== null,
      true,
      match ? `dashboard still contains hex literal: ${match[0]}` : undefined,
    );
  });
});
