/**
 * Read and parse the alias file at module-init time.
 *
 * Single source of truth: `aliases.css`. This module exists only to make
 * that file's contents available to SSR (`_app.tsx` inlines the CSS text
 * into a <style> tag) and to tests (fitness #1 parses the declared names).
 */

import { dirname, fromFileUrl, join } from "@std/path";

const HERE = dirname(fromFileUrl(import.meta.url));

/** Raw text of aliases.css. Read once at module init. */
export const aliasesCss: string = Deno.readTextFileSync(
  join(HERE, "aliases.css"),
);

/**
 * Extract the set of `--ale-*` custom property names declared in aliases.css.
 * Parsing is a narrow regex — the file format is fully under our control.
 */
export function parseAliasNames(css: string = aliasesCss): string[] {
  const names = new Set<string>();
  for (const match of css.matchAll(/(--ale-[a-z0-9-]+)\s*:/gi)) {
    names.add(match[1]);
  }
  return [...names].sort();
}

/**
 * Extract the mapping `--ale-* -> --scrim-*` declared in aliases.css.
 * Used by fitness #1 to assert 1:1 coverage against themeProperties.
 */
export function parseAliasMap(
  css: string = aliasesCss,
): Record<string, string> {
  const map: Record<string, string> = {};
  const re = /(--ale-[a-z0-9-]+)\s*:\s*var\((--scrim-[a-z0-9-]+)\)/gi;
  for (const match of css.matchAll(re)) {
    map[match[1]] = match[2];
  }
  return map;
}
