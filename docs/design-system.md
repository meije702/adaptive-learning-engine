# ALE Design System

> How visual design is layered across ALE and Scrim, what lives where, and the
> fitness functions that keep the architecture from drifting as it evolves.

**TL;DR.** Scrim owns the token vocabulary (22 CSS custom properties). ALE
aliases those into its own `--ale-*` namespace (one file), applies values from
typed preset modules, overlays per-course YAML, then per-learner state with
explicit provenance. Each layer is independently testable. Twelve fitness
functions enforce the invariants. Work packages D0–D8 ship in order; the plan
names what's deliberately deferred and when to revisit.

---

## Context

ALE and Scrim are asymmetric today. Scrim ships a mature design system:
`packages/web/src/theme.ts` exposes `themeProperties` — a
`Record<string, string>` of **22** CSS custom properties
(`--scrim-color-primary`, `--scrim-color-bg`, `--scrim-spacing-md`,
`--scrim-font-family`, `--scrim-radius`, `--scrim-shadow`, etc.).
`packages/web/src/styles.ts` is a scoped stylesheet that reads them. The
`WebRenderer.mount()` path applies tokens and injects a
`<style data-scrim="styles">` element; host apps can override any token on an
ancestor before mount.

ALE has none of that. `src/routes/*.tsx` and `src/islands/*.tsx` use inline
`style="…"` with hardcoded hex literals. `src/components/Button.tsx` uses
Tailwind. There's no token file, no theme object, no global stylesheet.
Curriculum, learner, and system configs are entirely semantic — no `theme`,
`brand`, or `appearance` keys.

The product direction points to multiple themes, per-course visual identity,
and (as a stretch) AI-proposed themes at intake. The seam is ready:
`src/islands/ScrimPlayer.tsx` mounts Scrim into a plain `<div>`, so setting
CSS custom properties on `document.documentElement` (or the scene host)
before mount is the natural extension point.

The question is where each piece of that system should live so it can evolve
independently under load.

---

## Principles

Named explicitly so they're auditable against later changes:

- **Single Responsibility.** Each config file, module, and layer does exactly
  one thing. Curriculum config defines *what* is learned. Theme config defines
  *how it looks*. The alias layer defines *what ALE calls things*. Preset files
  define *values for a named visual identity*. A change that spans two of
  those is a boundary violation.
- **Dependency Inversion.** ALE chrome depends on an abstract vocabulary
  (`--ale-*`). That vocabulary resolves, today, to Scrim's concrete tokens
  (`--scrim-*`). Scrim can rename, split, or add tokens upstream; the blast
  radius in ALE is one file.
- **Open/Closed.** Adding a preset, a course, an accepted AI proposal, or a
  new token is an addition, not a modification. Where that's not possible,
  the plan says so and leaves a seam.
- **Postpone irreversible decisions.** Anything committing to a shape we're
  not sure about (AI proposal UX, live OS-theme reaction, Tailwind's future,
  density tokens) is named as deferred with the signal that tells us when
  to revisit.
- **Fitness functions.** Every architectural invariant this plan depends on
  has a corresponding test or lint rule. If it's not enforced in CI, it
  drifts, and drift is how evolutionary architectures die.
- **Reversible steps.** Each work package lands as a small, independently
  revertible set of commits.

---

## The layering

Six layers. Layer 1.5 — the alias layer — is the seam that lets every other
layer evolve independently.

### Layer 1 — Token vocabulary (Scrim)

Scrim's `packages/web/src/theme.ts` is the single source of token names. When
ALE genuinely needs a new token, it's added upstream in Scrim first. No
parallel ALE vocabulary of values.

### Layer 1.5 — Alias vocabulary (ALE)

One file — `src/design/tokens/aliases.css` — declares `--ale-*` aliases that
resolve to `--scrim-*`:

```css
:root {
  --ale-color-primary:  var(--scrim-color-primary);
  --ale-color-text:     var(--scrim-color-text);
  --ale-color-bg:       var(--scrim-color-bg);
  --ale-spacing-md:     var(--scrim-spacing-md);
  --ale-font-family:    var(--scrim-font-family);
  --ale-radius:         var(--scrim-radius);
  /* …one line per token in themeProperties */
}
```

ALE chrome reads `var(--ale-*)` exclusively. Scrim continues reading its own
names. Cost: one file, plus one line per token whenever Scrim evolves.
Benefit: when Scrim renames a token (it's a real dependency, this will
happen), the alias file is the only place in the ALE repo that touches
`--scrim-*`.

This isn't duplicating values — the aliases are references, not copies.
It's duplicating *names as an adapter*, which is exactly what adapters do.

**Enforced by:** fitness #1 (every Scrim token has an alias) and fitness
#3 (`var(--scrim-*)` outside `aliases.css` fails CI).

### Layer 2 — Theme presets (ALE)

```
src/design/themes/
  types.ts                  # Theme type mirrors themeProperties (all required)
  default.ts                # baseline light neutral
  dark.ts
  high_contrast.ts
  apply_to_root.ts          # applyThemeToRoot(theme): void
  merge.ts                  # mergeTheme(base, ...partials): Theme
```

`apply_to_root.ts` and `merge.ts` are separate modules. One has a DOM side
effect, one is a pure function with a deep-merge contract. Different failure
modes, different test surfaces.

The function is named `applyThemeToRoot` rather than `applyTheme` because
Scrim already exports `applyTheme` at `@scrim/web`. Keeping distinct names
makes stack traces and grep unambiguous. The signature is
`applyThemeToRoot(theme: Theme): void` — it always targets
`document.documentElement`. There is intentionally no `el` parameter; a
scoped-element variant is added only if and when a concrete need emerges.

### Layer 3 — Per-course theme config (separate file)

Theme configuration lives in its own optional file:

```
config/examples/k8s-hybrid-cloud/
  curriculum.config.yaml    # unchanged — what is learned
  learner.config.yaml       # unchanged — who is learning
  system.config.yaml        # unchanged — how the system operates
  theme.config.yaml         # NEW, OPTIONAL — what it looks like
```

```yaml
# theme.config.yaml
preset: dark                # optional — defaults to "default"
overrides:                  # optional — partial override
  color:
    primary: "#8b5cf6"
  font:
    family: "Inter, system-ui, sans-serif"
```

Absent file ⇒ default preset. No changes to curriculum schema. Reskinning
a course is a new YAML file, not a curriculum fork.

### Layer 4 — Learner-scoped theme with provenance

`LearnerState.theme` records who set the theme, when, and what it replaced.
The field is **optional** — its absence IS the "fall through to the course
theme" state. Explicit sentinels would be redundant with optionality:

```ts
type ThemeSource = "user" | "ai_proposed" | "ai_accepted";

interface LearnerTheme {
  source: ThemeSource;
  preset?: ThemePresetId;
  overrides?: Partial<Theme>;
  proposedAt?: string;      // required when source ∈ {ai_proposed, ai_accepted}
  acceptedAt?: string;      // required when source === "ai_accepted"
  previous?: PreviousTheme; // what was active (rendering) before this change
}

// Separate type — by construction, no nested `previous` field.
// The type system prevents a history chain; no runtime refinement needed.
interface PreviousTheme {
  source: "user" | "ai_accepted";
  preset?: ThemePresetId;
  overrides?: Partial<Theme>;
}

// On LearnerState:
//   theme?: LearnerTheme
//
// undefined  => course-fallback (no learner override)
// defined    => overlays the course theme per the resolution rule below
```

Three things the shape records that a flat `{preset?, overrides?}` would lose:

1. **Who set this** — learner pick, AI proposal, accepted proposal.
   Course-fallback is the absence of the field, not a source value.
2. **When** — `proposedAt` / `acceptedAt` for auditability and UX
   ("proposed 3 days ago, accepted yesterday"). On acceptance, `proposedAt`
   persists *alongside* `acceptedAt` — we record the full lifecycle.
3. **What to revert to** — `previous` lets the learner go back one step
   without guessing. `PreviousTheme` has no `previous` field, so the
   revert chain is one deep by construction.

`source === "ai_proposed"` exists in data but does **not** reach rendering.
Only `"ai_accepted"`, `"user"`, or (field absent) compose into the resolved
theme. This separation means the AI can leave proposals in the inbox
without hijacking the UI, and accept/reject is a distinct write.

**Race invariant (fitness #10).** Any write with `source === "user"` — and
any course-level change that supersedes the learner's state (covered by
the course theme layer reloading) — supersedes an outstanding
`ai_proposed`: the new write replaces the slot entirely. `previous`
captures what was *rendering* before the change, which during a proposal is
still the underlying course/user state (because `ai_proposed` never
rendered), not the proposal itself. A proposal rejected implicitly (by the
learner picking something else) leaves no trace. This is intentional.

> There's a cleaner shape — two slots: `LearnerState.theme` for active
> render state, `LearnerState.themeProposal` for the AI inbox — that
> eliminates the race by construction. It's deferred until the proposal UI
> needs more than accept/reject (see the Deferred table). For the current
> scope, the supersedes-rule is sufficient.

### Layer 5 — AI-proposed themes (stretch)

Writes Layer 4 with `source: "ai_proposed"` and `proposedAt`. The learner's
accept action is a distinct write that transitions to `"ai_accepted"`,
persists `proposedAt`, sets `acceptedAt`, and populates `previous`. No
other layer changes.

### Resolution order

One overlay chain, applied once at page load:

```
default preset
  ← theme.config.yaml (if present)
  ← LearnerState.theme (if defined AND source ∈ {user, ai_accepted})
```

Absent `LearnerState.theme` means "fall through to course." `ai_proposed`
is invisible to rendering.

---

## Where each thing lives

| Concern                               | Lives in                                                 | Owner           |
| ------------------------------------- | -------------------------------------------------------- | --------------- |
| Token names / semantic contract       | `@scrim/web/theme.ts` (`themeProperties`)                | Scrim upstream  |
| ALE alias vocabulary                  | `src/design/tokens/aliases.css`                          | ALE             |
| Default token values                  | `src/design/themes/default.ts`                           | ALE             |
| Alternate presets                     | `src/design/themes/{dark,high_contrast,…}.ts`            | ALE             |
| Theme applier (DOM side effect)       | `src/design/themes/apply_to_root.ts`                     | ALE             |
| Theme merge (pure)                    | `src/design/themes/merge.ts`                             | ALE             |
| Theme schema (Zod)                    | `src/config/schemas/theme.ts`                            | ALE             |
| Per-course theme config               | `config/examples/*/theme.config.yaml` (optional)         | Course author   |
| Config loader (theme)                 | `src/config/loader.ts` (extended)                        | ALE             |
| Learner-scoped theme + provenance     | `LearnerState.theme` via `learnerState` repo             | ALE runtime     |
| Root-layout composition & application | `src/routes/_app.tsx`                                    | ALE             |
| Chrome components (post-migration)    | `src/components/*`, `src/routes/*.tsx` reading `--ale-*` | ALE follow-up   |
| AI proposal tool                      | `src/mcp/tools/design.ts` (stretch)                      | ALE + MCP agent |
| Fitness functions                     | `src/design/*_test.ts`, `scripts/check_*.ts`             | ALE             |

---

## Fitness functions

Every architectural claim this plan makes has a corresponding enforceable
check in CI. Checks land with the work packages that introduce the
invariants they enforce.

| #  | Invariant                                                          | Enforcement                                                                                                                                                                      | Lands in |
| -- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1  | Every Scrim token has an ALE alias                                 | Test: `Object.keys(themeProperties)` ≡ set parsed from `aliases.css`                                                                                                             | D2       |
| 2  | Every Scrim token has a default value                              | Test: every key in `themeProperties` is set in `default.ts`                                                                                                                      | D1       |
| 3  | No `var(--scrim-*)` outside `aliases.css`                          | `scripts/check_no_scrim_vars.ts` — Deno script walks `.css`/`.ts`/`.tsx`, strips `//` and `/* */` comments, greps for `var(--scrim-`, excludes `aliases.css`. Wired into `check`. | D2       |
| 4  | No hex / `rgb(` / `hsl(` literals in migrated ALE paths            | `scripts/check_design_tokens.ts` — Deno script reads `.design/migration-remaining.txt` allowlist and greps every **non-allowlisted** path. Wired into `check`.                    | D6+      |
| 5  | `mergeTheme(x, {})` structurally equals `x`                        | Property test                                                                                                                                                                    | D3       |
| 6  | Deep overrides land at the right nested key; siblings survive      | Table-driven unit test                                                                                                                                                           | D3       |
| 7  | Every `.ts` preset satisfies `ThemeSchema`                         | Test: iterate `src/design/themes/` and `ThemeSchema.parse` each imported module                                                                                                  | D3       |
| 8  | `theme.config.yaml` rejects unknown keys and invalid CSS colors    | **Single** parse-time regex for colors (see definition below); runtime `CSS.supports` is a separate smoke test at D4 verification, never part of the schema                      | D4       |
| 9  | `LearnerTheme` provenance invariants                               | Zod refinements: `ai_proposed` ⇒ `proposedAt`; `ai_accepted` ⇒ `proposedAt` **AND** `acceptedAt`                                                                                 | D5       |
| 10 | Writes populate `previous` correctly AND supersede proposals       | Repo-level test: write with `source: "user"` over existing `ai_proposed` replaces the slot; `previous` reflects what was **rendering** (course/user state), not the proposal     | D5       |
| 11 | `ai_proposed` never reaches rendering                              | Integration test: root-layout composer ignores `source === "ai_proposed"` and returns course/user theme                                                                          | D5 / D8  |
| 12 | No new Tailwind classes in migrated files                          | Same Deno script as #4 (shared allowlist); additional regex for `className="[^"]*\b(bg-|text-|p-|m-|flex)\b`                                                                     | D6       |

Items 3, 4, and 12 are implemented as small Deno scripts rather than bash
one-liners. The scripts are portable, testable, and produce readable error
output pointing at the specific file and line.

### The migration allowlist (fitness #4 and #12)

"Progressive enforcement" without a mechanism is "enforcement that everyone
agrees we'll add later." The mechanism is concrete:

- `.design/migration-remaining.txt` lists directory-family paths (one per
  line) that have not yet been migrated. D6 starts with all of
  `src/routes`, `src/islands`, `src/components` listed.
- `scripts/check_design_tokens.ts` reads this file, enumerates every
  `.ts`/`.tsx`/`.css` source file **outside** those paths, and greps for
  `#[0-9a-fA-F]{3,8}`, `rgb(`, `hsl(`, and the Tailwind utility pattern.
- Each D6 PR shrinks the allowlist by one line. The file's line count is
  the migration progress bar — a reviewable metric.
- PRs that *add* entries require explicit justification in the PR
  description.

### Single color validator (fitness #8)

One validator, one responsibility, at the schema parse point:

```ts
// Parse-time regex. Intentionally permissive — catches typos and wrong-type
// values, not full CSS color parsing. Runtime CSS.supports check is a
// separate smoke test, not part of the schema.
const HEX = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FN  = /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\([^)]*\)$/;
const NAMED = new Set<string>([/* vendored CSS named-color list */]);

export const cssColor = z.string().refine(
  (v) => HEX.test(v) || FN.test(v) || NAMED.has(v.toLowerCase()),
  { message: "must be a CSS color value" },
);
```

The D4 verification step includes a runtime smoke test that iterates every
color in the committed `theme.config.yaml` examples and asserts
`CSS.supports('color', v)` agrees with the regex. Divergence between the
two is a signal to update the regex, not to add a second validator to the
schema.

---

## Work packages

Each WP lands as a small, revertible set of commits. Sequence: D0→D1→D2
unblocks chrome migration (D6); D3→D4→D5 are the config and state changes
that unlock AI (D8). D7 (Tailwind removal) is decoupled and optional.

### WP-D0 — Scrim token snapshot test *(half-day)*

Freeze the current Scrim token vocabulary as a snapshot test in ALE.

1. Import `themeProperties` from `@scrim/web/theme.ts`.
2. Write a test asserting the exact set of keys (22 today).
3. Commit.

**Why first:** this is the contract. A silent change via dep bump fails this
test before anything else does; the upgrade becomes gated on review.
Cheapest fitness function in the plan.

### WP-D1 — Default theme, applier, root mount *(day 1)*

1. `src/design/themes/types.ts` — `Theme` type.
2. `src/design/themes/default.ts` — neutral light values, one per token.
3. `src/design/themes/apply_to_root.ts` — `applyThemeToRoot(theme): void`
   (no `el` parameter; always `document.documentElement`).
4. Call `applyThemeToRoot(defaultTheme)` from `_app.tsx`.
5. Fitness #2.

**Verification.** Load `/`, inspect `<html>`: every `--scrim-*` token
present. Scrim scenes render as before. Chrome visually unchanged.

### WP-D2 — Alias layer *(day 2)*

1. `src/design/tokens/aliases.css` — one `--ale-*: var(--scrim-*)` per
   token.
2. Import from `_app.tsx` (or the root stylesheet).
3. `scripts/check_no_scrim_vars.ts` — walks source, strips comments, greps.
4. Wire the script into `cd src && deno task check`.
5. Fitness #1 and #3.

**Verification.** `getComputedStyle(document.documentElement)
.getPropertyValue('--ale-color-primary')` returns `default.ts`'s value.
Script green when run on the current tree; fails when a test file
intentionally contains `var(--scrim-color-primary)` outside `aliases.css`.

### WP-D3 — Alternate presets, deep merge, schema *(days 3–4)*

1. `dark.ts`, `high_contrast.ts`.
2. `src/design/themes/merge.ts` — deep merge. Explicit semantics: partial
   overrides land on specific nested keys; siblings survive; unknown keys
   pass through typed-unchecked (Zod validates at the config boundary).
3. `src/config/schemas/theme.ts` — `ThemeSchema` (full/required) and
   `ThemePartialSchema` (deep partial). Uses the single `cssColor`
   validator above.
4. Fitness #5, #6, #7.

**Verification.** Unit tests green. Temporarily import `dark` from
`_app.tsx`; chrome + scenes render dark.

### WP-D4 — `theme.config.yaml` loader *(day 5)*

1. Extend `src/config/loader.ts` to look for `theme.config.yaml` in the
   config dir. Absent ⇒ `{ preset: 'default' }`.
2. Parse via `ThemeConfigSchema`.
3. `_app.tsx` composes: `merge(presetFor(config.theme.preset),
   config.theme.overrides)`.
4. Commented example at
   `config/examples/k8s-hybrid-cloud/theme.config.yaml`.
5. Fitness #8 (regex). Runtime `CSS.supports` cross-check as smoke test.

**Verification.** Without the file, neutral. `preset: dark` ⇒ dark chrome
and scenes. A single `overrides.color.primary` change ⇒ only that token
changes.

### WP-D5 — `LearnerState.theme` with provenance *(days 6–7)*

1. Extend `LearnerState` in `src/db/types.ts` with optional
   `theme?: LearnerTheme`. `LearnerTheme` and `PreviousTheme` are two
   separate types — no nested `previous`, no `"course"` sentinel, just
   optionality.
2. Zod refinements (fitness #9): `ai_proposed` ⇒ `proposedAt`;
   `ai_accepted` ⇒ `proposedAt` AND `acceptedAt`.
3. Repo-level write guard (fitness #10):
   - Writes that change the active rendered theme populate `previous`
     from the resolved rendered theme.
   - Writes with `source: "user"` over an existing `ai_proposed` clear
     the proposal (replace the slot).
   - No-op writes (same preset, same overrides) do not mutate `previous`.
4. `_app.tsx` composition extends to:
   course theme ← (learner theme when `source ∈ {user, ai_accepted}`).
   Otherwise pass through. (Fitness #11, stubbed; full coverage in D8.)
5. REST: `GET /api/theme` / `PUT /api/theme`. MCP: `get_theme` /
   `set_theme`.
6. Top-nav switcher (smoke test): default / dark / high_contrast / revert.
   Revert reads `previous` and re-applies.

**Verification — supersede fixture (the non-obvious case).**

> Start state: no `theme.config.yaml` → course-fallback is the default
> preset. `LearnerState.theme` is `undefined`.
>
> 1. AI calls `propose_course_theme` → `LearnerState.theme =
>    { source: "ai_proposed", preset: "dark", proposedAt: t0 }`.
>    Rendered theme at this point is still the default preset
>    (proposals don't render — fitness #11).
> 2. Learner picks `high_contrast` via switcher → `PUT /api/theme
>    { source: "user", preset: "high_contrast" }`.
> 3. Expected post-state:
>    `LearnerState.theme = {
>       source: "user",
>       preset: "high_contrast",
>       previous: { source: undefined }  // represents course-fallback
>    }`.
>    The `ai_proposed` is gone. `previous` points at what was *rendering*
>    before the user pick (the course-fallback default), **not** at the
>    superseded proposal.

This scenario is explicit in the D5 integration tests. Other verification
cases:

- `PUT /api/theme` that mutates active without populating `previous` ⇒
  400.
- `set_theme({source: "ai_accepted", …})` without `acceptedAt` ⇒ schema
  rejects.
- Switcher → revert ⇒ falls back through `previous`.

### WP-D6 — Chrome migration to aliases *(ongoing, one PR per route family)*

Can start after D2. After D3 at minimum, D4 preferably, for meaningful
visual-regression verification.

Process per PR:

1. Pick one directory family (e.g., `src/routes/week/`).
2. Replace hex with `var(--ale-color-*)`, rem/px with
   `var(--ale-spacing-*)`, etc.
3. Screenshot diff against baseline under **default preset** (invariance)
   AND **dark preset** (token flow — catches "values identical by
   accident").
4. Remove the directory from `.design/migration-remaining.txt`.

When the allowlist reaches zero, fitness #4 covers the entire chrome tree.

### WP-D7 — Tailwind removal *(optional, after D6 completes)*

1. Migrate `src/components/Button.tsx` and any remaining Tailwind
   consumers to token-driven CSS.
2. Remove Tailwind from deps and config.
3. Fitness #12 global.

**Trigger to keep Tailwind instead:** D6 reveals a pattern (complex
responsive grids, utility combinations) that genuinely reads better with
Tailwind and would be reinvented poorly in CSS. Default position: drop.

### WP-D8 — AI-proposed themes *(stretch, after D5 solid)*

1. MCP tool `propose_course_theme` — reads learner + curriculum context,
   returns a validated `{preset, overrides, rationale}`, writes
   `LearnerState.theme` with `source: "ai_proposed"` and `proposedAt`.
2. MCP tool `accept_proposed_theme` — transitions `ai_proposed` →
   `ai_accepted`, persists `proposedAt`, sets `acceptedAt`, populates
   `previous`. Validates the proposal hasn't been superseded.
3. REST mirror.
4. Intake hook: optional theme proposal at end of intake; learner sees
   rationale and picks accept / reject / later.
5. Fitness #11 extended across this flow.

**Trigger to build:** D1–D5 solid; ≥ 1 real user requesting it, or a
curriculum that ships with theme guidance the AI could infer. Without one,
this is speculative.

---

## Decisions deferred, with their triggers

Evolutionary architecture treats "not now" as a first-class output. These
are decisions this doc explicitly does not make, paired with the signal
that should prompt revisiting.

| Deferred decision                                                    | Revisit when…                                                                                |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Live OS-theme reaction (`prefers-color-scheme` mid-session)          | A learner asks for it, or analytics show multi-session OS theme toggling                     |
| Two-slot shape (`LearnerState.themeProposal` separate from `.theme`) | Proposal UI needs more than accept/reject (e.g., history, multiple pending, comparison view) |
| Motion / animation tokens                                            | A scene or chrome component needs more than one animation timing                             |
| Density tokens (compact / comfortable / spacious)                    | A learner preference for information density emerges, or a course has screens that'd benefit |
| Typography scale beyond Scrim's tokens                               | Two consecutive chrome migrations want the same custom scale                                 |
| A full component library (`Card`, `Stack`, …)                        | Chrome migrations in D6 duplicate the same pattern ≥ 3 times                                 |
| Per-viewport theme variation (print, mobile-specific chrome)         | Print styles or mobile-only chrome become concrete asks                                      |
| Theme versioning / migration                                         | A preset's token set changes in a way that invalidates older saved themes                    |
| User-defined custom presets saved as named profiles                  | `overrides` proves insufficient; ≥ 2 users asking for it                                     |

None of these are designed into v3. Each has a clear "now it matters"
signal — and because of the layering, each slots in as a new layer or an
extended schema without restructuring.

---

## Explicitly out of scope

- Re-theming Scrim. It's good; don't touch.
- Runtime theme hot-reload in development. Page reload is fine.
- A themes gallery UI. The top-nav switcher is smoke-test scope.
- Multi-tenant theme isolation. Per `AGENTS.md § Gotchas`, ALE is
  single-learner today; multi-tenant is an organization-wide rework when
  the time comes.

---

## End-to-end verification (after D1–D5)

1. `cd src && deno task check && deno task test:check` — both green.
2. `/` with default config ⇒ neutral theme, Scrim scenes as before.
3. `theme.config.yaml` with `preset: dark` ⇒ chrome + scenes dark.
4. Switcher → `high_contrast` ⇒ `LearnerState.theme.source === "user"`,
   `previous.source === undefined` (course-fallback), overrides
   per-learner.
5. Switcher → revert ⇒ falls back to course theme.
6. `PUT /api/theme` that mutates active without populating `previous` ⇒
   400.
7. Fitness functions #1, #2, #3, #5, #6, #7, #8, #9, #10, #11 all green in
   CI. (#4 and #12 track the D6 allowlist; initial state: all of
   `src/routes`, `src/islands`, `src/components` in the allowlist.)
8. `getComputedStyle(document.documentElement).getPropertyValue('--ale-color-primary')`
   returns the expected value at each layer.
9. Grep: no `var(--scrim-*)` usage in ALE source outside `aliases.css`.

After D6: `.design/migration-remaining.txt` empty; fitness #4 covers the
entire chrome tree.

After D7: Tailwind absent from `deno.json` and `tailwind.config.*`
deleted.

After D8: theme proposal lands in inbox, doesn't render until accepted,
`previous` populated on accept, supersede-rule clears proposal on user
pick.
