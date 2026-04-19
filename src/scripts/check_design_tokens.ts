#!/usr/bin/env -S deno run --allow-read

/**
 * Fitness functions #4 and #12 — progressive enforcement.
 *
 * Walks `src/routes`, `src/islands`, `src/components`, strips comments
 * (reusing the stripper from check_no_scrim_vars), and for each source
 * file NOT in the allowlist (.design/migration-remaining.txt), rejects:
 *   - hex literals like `#rgb` / `#rrggbb` / `#rrggbbaa`
 *   - `rgb(` / `rgba(` / `hsl(` / `hsla(` function calls
 *   - Tailwind utility classes (`class="...bg-xxx..."` etc.)
 *
 * The allowlist is a shrinking list. When a D6 PR migrates one file to
 * `var(--ale-*)` references, that file's path is removed from the list
 * and CI starts enforcing the rule for it.
 *
 * Paths in the allowlist are relative to `src/`.
 *
 * See docs/design-system.md § Fitness functions #4 and #12 and § WP-D6.
 */

import { walk } from "@std/fs/walk";
import { fromFileUrl, relative } from "@std/path";
import { stripComments } from "./check_no_scrim_vars.ts";

const ROOT_PATH = fromFileUrl(new URL("../", import.meta.url)); // src/
const ALLOWLIST_PATH = fromFileUrl(
  new URL("../../.design/migration-remaining.txt", import.meta.url),
);

/** Directories scanned (relative to src/). */
const SCAN_ROOTS = ["routes", "islands", "components"];

const EXTENSIONS = [".ts", ".tsx", ".css"];

const EXCLUDED_DIRS = new Set([
  "_fresh",
  "node_modules",
]);

// --- Pattern rules (fitness #4 and #12) ---------------------------------

interface Rule {
  name: string;
  regex: RegExp;
}

const RULES: Rule[] = [
  {
    // #rgb / #rgba / #rrggbb / #rrggbbaa. The trailing lookahead prevents
    // matching hex-like words inside identifiers.
    name: "hex color literal",
    regex: /#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_])/,
  },
  {
    name: "rgb()/rgba() function",
    regex: /\brgba?\s*\(/,
  },
  {
    name: "hsl()/hsla() function",
    regex: /\bhsla?\s*\(/,
  },
  {
    name: "Tailwind utility class",
    regex:
      /class(?:Name)?\s*=\s*["'`][^"'`]*\b(?:bg-|text-|p-|m-|flex\b|border\b|rounded|gap-|grid\b|w-|h-)/,
  },
];

// --- Allowlist parsing --------------------------------------------------

async function loadAllowlist(): Promise<Set<string>> {
  const raw = await Deno.readTextFile(ALLOWLIST_PATH);
  const entries = new Set<string>();
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    entries.add(trimmed);
  }
  return entries;
}

// --- Scanner -------------------------------------------------------------

interface Violation {
  file: string;
  line: number;
  rule: string;
  text: string;
}

async function scan(): Promise<Violation[]> {
  const allowlist = await loadAllowlist();
  const violations: Violation[] = [];

  for (const scanRoot of SCAN_ROOTS) {
    const absRoot = `${ROOT_PATH}${scanRoot}`;
    for await (
      const entry of walk(absRoot, { includeDirs: false })
    ) {
      if (!EXTENSIONS.some((ext) => entry.path.endsWith(ext))) continue;
      const rel = relative(ROOT_PATH, entry.path);
      if (rel.split("/").some((seg) => EXCLUDED_DIRS.has(seg))) continue;
      if (allowlist.has(rel)) continue;

      const raw = await Deno.readTextFile(entry.path);
      const stripped = stripComments(raw);
      const strippedLines = stripped.split("\n");
      const sourceLines = raw.split("\n");

      for (let i = 0; i < strippedLines.length; i++) {
        const line = strippedLines[i];
        for (const rule of RULES) {
          if (rule.regex.test(line)) {
            violations.push({
              file: rel,
              line: i + 1,
              rule: rule.name,
              text: (sourceLines[i] ?? line).trim(),
            });
          }
        }
      }
    }
  }

  return violations;
}

// --- Allowlist sanity ---------------------------------------------------

/** Entries in the allowlist whose files no longer exist — stale entries. */
async function staleAllowlistEntries(): Promise<string[]> {
  const allowlist = await loadAllowlist();
  const stale: string[] = [];
  for (const entry of allowlist) {
    try {
      await Deno.stat(`${ROOT_PATH}${entry}`);
    } catch {
      stale.push(entry);
    }
  }
  return stale;
}

if (import.meta.main) {
  const violations = await scan();
  const stale = await staleAllowlistEntries();

  if (violations.length === 0 && stale.length === 0) {
    const remainingCount = (await loadAllowlist()).size;
    console.log(
      `check_design_tokens: ok (${remainingCount} path(s) still in the migration allowlist)`,
    );
    Deno.exit(0);
  }

  if (stale.length > 0) {
    console.error(
      `check_design_tokens: ${stale.length} stale allowlist entry/entries (file no longer exists):`,
    );
    for (const s of stale) console.error(`  ${s}`);
  }
  if (violations.length > 0) {
    console.error(
      `check_design_tokens: ${violations.length} violation(s) — migrated paths must use var(--ale-*) only:`,
    );
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.text}`);
    }
  }
  Deno.exit(1);
}

export { loadAllowlist, RULES, scan, staleAllowlistEntries };
