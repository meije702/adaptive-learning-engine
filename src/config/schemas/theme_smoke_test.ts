import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { parse as parseYaml } from "@std/yaml";
import { dirname, fromFileUrl, join } from "@std/path";
import { cssColor, ThemeConfigSchema } from "./theme.ts";

/**
 * Fitness #8 smoke test (corner of the check).
 *
 * The schema uses a single parse-time regex (`cssColor`). This smoke test
 * sanity-checks two things:
 *  (a) the cssColor regex agrees with a hand-picked table of known-valid
 *      modern CSS color values, so we don't regress on oklch/color-mix
 *      support when the regex is tweaked;
 *  (b) every color literal in the committed example `theme.config.yaml`
 *      files parses via ThemeConfigSchema — i.e. the examples themselves
 *      stay valid.
 *
 * `CSS.supports` is only available in a DOM context, not in `deno test`.
 * If we later want a browser-side cross-check, it belongs in an e2e test,
 * not here.
 */

describe("cssColor — modern CSS support (smoke)", () => {
  const known = [
    "#fff",
    "#ffff",
    "#ffffff",
    "#ffffffff",
    "rgb(1 2 3 / 0.5)",
    "hsl(200 50% 50%)",
    "hwb(200 30% 30%)",
    "lab(50% 40 59.5)",
    "oklch(70% 0.1 120)",
    "color-mix(in oklch, red, blue)",
    "currentcolor",
    "transparent",
  ];

  for (const v of known) {
    it(`accepts ${v}`, () => {
      assertEquals(cssColor.safeParse(v).success, true);
    });
  }
});

describe("example theme.config.yaml parses via ThemeConfigSchema", () => {
  it("k8s-hybrid-cloud example", async () => {
    const here = dirname(fromFileUrl(import.meta.url));
    const path = join(
      here,
      "..",
      "..",
      "..",
      "config",
      "examples",
      "k8s-hybrid-cloud",
      "theme.config.yaml",
    );
    const raw = await Deno.readTextFile(path);
    const parsed = parseYaml(raw);
    // All-commented example parses to null; treat as {} for the schema
    // check (the loader does the same).
    const input = parsed ?? {};
    const result = ThemeConfigSchema.safeParse(input);
    if (!result.success) {
      throw new Error(
        `theme.config.yaml failed schema: ${
          JSON.stringify(result.error.format(), null, 2)
        }`,
      );
    }
  });
});
