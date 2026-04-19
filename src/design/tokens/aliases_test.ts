import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { themeProperties } from "@scrim/web";
import { parseAliasMap, parseAliasNames } from "./aliases.ts";

/**
 * Fitness function #1 — every Scrim token has an ALE alias.
 *
 * The ALE alias layer is the Dependency-Inversion seam (see
 * docs/design-system.md § Layer 1.5). If Scrim adds or renames a token,
 * the Scrim token snapshot test fires first, then this test forces the
 * matching update to aliases.css before the work lands.
 */

describe("aliases.css", () => {
  it("declares exactly one --ale-* alias per Scrim token", () => {
    const aliasMap = parseAliasMap();
    const aliasedScrimTokens = Object.values(aliasMap).sort();
    const scrimTokens = Object.keys(themeProperties).sort();
    assertEquals(aliasedScrimTokens, scrimTokens);
  });

  it("every alias targets exactly one Scrim token (no duplicates)", () => {
    const names = parseAliasNames();
    const map = parseAliasMap();
    assertEquals(names.length, Object.keys(map).length);
    assertEquals(
      new Set(Object.values(map)).size,
      Object.values(map).length,
      "each --scrim-* token is aliased at most once",
    );
  });

  it("alias names follow the --ale-<same-suffix> convention", () => {
    const map = parseAliasMap();
    for (const [aleName, scrimName] of Object.entries(map)) {
      const aleSuffix = aleName.replace(/^--ale-/, "");
      const scrimSuffix = scrimName.replace(/^--scrim-/, "");
      assertEquals(
        aleSuffix,
        scrimSuffix,
        `alias ${aleName} should map to --scrim-${aleSuffix}, got ${scrimName}`,
      );
    }
  });
});
