#!/usr/bin/env -S deno run --allow-read

/**
 * Fitness function #3 — no `var(--scrim-*)` outside aliases.css.
 *
 * Walks the ALE source tree, strips `//` line comments and `/* *\/`
 * block comments, then scans each file for `var(--scrim-`.
 *
 * The ONLY file allowed to reference `--scrim-*` directly is
 * `src/design/tokens/aliases.css` (the alias layer — Layer 1.5 in the
 * design doc). Every other reference must go through the `--ale-*` alias.
 *
 * Exit codes:
 *   0  — no violations
 *   1  — one or more violations (printed to stderr)
 */

import { walk } from "@std/fs/walk";
import { fromFileUrl, relative } from "@std/path";

const ROOT_PATH = fromFileUrl(new URL("../", import.meta.url)); // src/

/** Source file extensions we scan. */
const EXTENSIONS = [".ts", ".tsx", ".css"];

/**
 * Files excluded from the scan.
 *  - aliases.css: the designated source of --scrim-* references (the point
 *    of this script is to enforce that it's the ONLY such file).
 *  - check_no_scrim_vars.ts and its test: they inspect the pattern as a
 *    string, not as a CSS function call.
 */
const EXCLUDED_FILES = new Set([
  "aliases.css",
  "check_no_scrim_vars.ts",
  "check_no_scrim_vars_test.ts",
]);

const EXCLUDED_DIRS = new Set([
  "_fresh",
  "node_modules",
  "static",
]);

/**
 * Strip `//` line comments and `/* *\/` block comments from source text,
 * preserving newlines so post-strip line numbers match the source.
 */
function stripComments(text: string): string {
  // Block comments — replace each non-newline character with a space so
  // the original line count and column offsets survive.
  let stripped = text.replace(
    /\/\*[\s\S]*?\*\//g,
    (match) => match.replace(/[^\n]/g, " "),
  );
  // Line comments — only strip `//` that is preceded by start-of-line or
  // whitespace/punctuation, which leaves `https://` URLs intact.
  stripped = stripped.replace(/(^|[\s;{}()])\/\/[^\n]*/gm, "$1");
  return stripped;
}

interface Violation {
  file: string;
  line: number;
  text: string;
}

async function scan(): Promise<Violation[]> {
  const violations: Violation[] = [];

  for await (const entry of walk(ROOT_PATH, { includeDirs: false })) {
    if (!EXTENSIONS.some((ext) => entry.path.endsWith(ext))) continue;
    const rel = relative(ROOT_PATH, entry.path);
    if (EXCLUDED_FILES.has(entry.name)) continue;
    if (rel.split("/").some((seg) => EXCLUDED_DIRS.has(seg))) continue;

    const raw = await Deno.readTextFile(entry.path);
    const stripped = stripComments(raw);
    const lines = stripped.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("var(--scrim-")) {
        // Use the original (un-stripped) line for the error message so
        // the reporter shows what the author actually wrote.
        const originalLines = raw.split("\n");
        violations.push({
          file: rel,
          line: i + 1,
          text: originalLines[i]?.trim() ?? lines[i].trim(),
        });
      }
    }
  }

  return violations;
}

if (import.meta.main) {
  const violations = await scan();
  if (violations.length === 0) {
    console.log("check_no_scrim_vars: ok");
    Deno.exit(0);
  }
  console.error(
    `check_no_scrim_vars: ${violations.length} violation(s) — var(--scrim-*) must only appear in aliases.css`,
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.text}`);
  }
  Deno.exit(1);
}

// Exported for unit tests.
export { scan, stripComments };
