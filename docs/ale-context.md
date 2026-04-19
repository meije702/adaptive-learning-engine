# ALE context pack (for the AI agent, and humans)

Living reference read by the AI agent when generating day content for the
`learning-ale` curriculum — and a useful orientation for any human stepping
into the codebase. It captures where each architectural concern *actually
lives today*, what's stable versus still in motion, and which docs are
authoritative for which topics. Keep it current when architecture shifts
meaningfully.

> If you're reading this as the AI teacher: prefer pointing the learner at
> real source files over inventing examples. The whole point of the
> self-referential course is that the system teaches itself by showing its
> own guts. Each curriculum domain has a `resources` field listing the
> exact files to anchor the lesson in.

---

## Module map

```
src/
  main.ts                    — Fresh app entry; middleware chain, fs routes,
                               correlation-bound logging.
  config/
    loader.ts                — Loads system/curriculum/learner (required) +
                               theme (optional). ALE_CONFIG_DIR overrides.
    schemas/                 — Zod schemas: system, curriculum, learner, theme.
  db/
    types.ts                 — Nine persisted entities. Re-exports Theme +
                               gap-analysis types from analysis/design.
    repositories.ts          — Interface contracts.
    factory.ts               — createRepositories(kv, system).
    kv/                      — One implementation per entity.
  domain/                    — Pure business rules (no IO). This is the
                               seam that killed the "rule duplicated at REST
                               + MCP" bug class.
    calibration.ts           — computeCalibrationDelta
    wellbeing.ts             — applyWellbeingTransition
    feedback.ts              — recordFeedbackAndProgress
    evaluate_mc.ts           — autoGradeMultipleChoice
    spaced_repetition.ts     — SM-2 + pause decay
    learner_theme.ts         — Theme state machine with provenance
    errors.ts                — DomainError hierarchy + boundary mappers
  analysis/
    gap.ts                   — computeGapAnalysis (pure)
    types.ts                 — GapAnalysis, GapAnalysisSnapshot + unwrap
  mcp/
    main.ts                  — Stdio entrypoint for the MCP server.
    server.ts                — ~70-line registry; wires each tool module.
    define_tool.ts           — Typed defineTool<Schema> + correlation wrap.
    tools/                   — Per-concern tool modules. Each exports
                               register(ctx) and is wired from server.ts.
      observe / generate / steer / calibration / wellbeing / gap /
      intake / scheduling / theme
    sdk_compat.js            — Runtime bridge for MCP SDK imports under
                               Deno. Deliberate; do NOT inline back to deep
                               subpath imports.
  obs/
    logger.ts                — Structured JSON lines to stderr.
    correlation.ts           — AsyncLocalStorage for correlation IDs.
  scrim/
    validate.ts              — SceneDocument validation wrapper.
    snapshot.ts              — SceneDocumentSnapshot wrap/unwrap.
    language_reference.ts    — Loads Scrim language ref for the MCP
                               instructions string.
  design/
    tokens/aliases.css       — Layer 1.5 — ALE's vocabulary alias to Scrim's.
    tokens/aliases.ts        — Parser + raw text for SSR injection.
    themes/                  — types, default, dark, high_contrast, merge,
                               apply_to_root, presets registry.
  api/
    error.ts                 — RFC 7807 problem responses.
    helpers.ts               — parseJsonBody, jsonResponse.
  routes/
    _app.tsx                 — Root layout; composes + applies theme.
    index.tsx                — Dashboard (D6-migrated to --ale-* tokens).
    today.tsx, day/, week/, intake.tsx, retention.tsx
    api/                     — REST surface mirroring the MCP tool catalog.
  islands/
    ScrimPlayer.tsx, AnswerForm.tsx, IntakeChat.tsx, SelfAssessment.tsx,
    ThemeSwitcher.tsx (smoke test for WP-D5)
  scripts/
    check_no_scrim_vars.ts   — Fitness #3.
    check_design_tokens.ts   — Fitness #4 + #12 with allowlist.
  tasks/
    manifest.ts              — Scheduled-task manifest read by the agent.
```

---

## What's stable

These are load-bearing and unlikely to shift without a deliberate ADR:

- **Three-component topology** (ALE / Scrim / Agent via MCP).
- **Repository pattern** over Deno KV; the nine core entities in
  `src/db/types.ts`.
- **Pure-domain invariant**: any rule called from both REST and MCP lives
  in `src/domain/`.
- **MCP stdio transport** (the schema only allows `"stdio"`; SSE was
  specced and never shipped).
- **Error taxonomy**: `DomainError` → REST RFC 7807 / MCP `txt({error,code})`.
- **SM-2 retention math** and the pause-decay formula.
- **The bridge principle** and feedback-component structure as pedagogy.

---

## What's still in motion

Flag these to the learner when they come up — don't teach them as if they're
final:

- **Design-system chrome migration (WP-D6)** is progressive. `.design/migration-remaining.txt` lists the 13 paths still carrying hex literals or Tailwind classes. The dashboard (`src/routes/index.tsx`) has landed as the proof-of-mechanism.
- **Tailwind drop (WP-D7)** is optional and folded into whichever D6 PR migrates `src/components/Button.tsx` + `src/islands/Counter.tsx`.
- **AI-proposed themes (WP-D8)** are a stretch: the domain layer has the `ai_proposed` state and supersede rule fully wired, but no `propose_course_theme` MCP tool exists yet.
- **Snapshot versioning** currently covers `SceneDocumentSnapshot` and `GapAnalysisSnapshot`. It's not on every entity on purpose — only unstable shapes get the wrapper.
- **Gap-analysis recalculation cadence** is driven by the agent (not a scheduler). `recalculate_gaps` is a tool the agent calls after assessment weeks.

---

## Known rough edges

Honest about the current state:

- **Day-by-week scanning** in `src/db/kv/days.ts` walks weeks to find "today." Fine at single-learner scale; a secondary `["day_by_date", iso]` index would help when the system goes multi-tenant.
- **No data migrations**. If a non-versioned entity shape changes, old records will silently shear. When this first bites, we formalise a migration story.
- **Single-learner system**. The whole codebase assumes one learner per process. Multi-tenancy is an organisation-wide rework, explicitly out of scope until there's a concrete second user.
- **`theme.config.yaml` colour validation** uses a parse-time regex, not `CSS.supports`. The D4 smoke test cross-checks against known modern colour values (oklch, color-mix, etc.); if one slips through, update the regex, don't add a second validator.
- **AGENTS.md** holds working-in-this-codebase notes; if something in the module map above differs from AGENTS.md, update both.

---

## Authoritative docs by topic

Point the learner at these when a domain asks for it — don't paraphrase from
memory.

| Topic                                  | Source                                            |
| -------------------------------------- | ------------------------------------------------- |
| Whole-system architecture              | `docs/technical-design.md`                        |
| Operational design + learning science  | `docs/SYSTEM.md`                                  |
| Pedagogical contract (agent behaviour) | `CLAUDE.md`                                       |
| Codebase dev notes                     | `AGENTS.md`                                       |
| Design system layering                 | `docs/design-system.md`                           |
| Data-model decisions                   | `docs/adr/001-data-model-api.md`                  |
| Config-first rationale                 | `docs/adr/002-configuration-first.md`             |
| Bridge principle + intake              | `docs/adr/003-bridge-principle-intake.md`         |
| Research / evidence base               | `docs/research/learning-science.md`               |
| Session-specific context (this file)   | `docs/ale-context.md`                             |

---

## Curriculum-specific reading order

When teaching the `learning-ale` curriculum, the day content should follow
the grain of the curriculum's phase bridges. For each domain, the pattern
works well as:

1. **Theory day** — one concrete problem this abstraction solves, then the
   shape of the solution. Anchor in the domain's `resources` field.
2. **Practice days** — read real code, not synthetic snippets. Challenge
   the learner to predict what the code does before revealing; to spot the
   invariants; to identify what would break if a specific line were removed.
3. **Assessment day** — one scenario that requires synthesising the week's
   concepts. For later phases, lean on cross-phase integration.
4. **Review day** — the learner explains back the week's arc; the agent
   identifies misconceptions and files retention questions.

The self-referential twist: the teaching medium IS the subject. When a
theory day explains `defineTool`, the tool that generated the theory day is
itself a `defineTool` registration. Point that out when it helps; don't
belabour it.

---

## Updating this file

Change it when:
- A new module lands that a learner would need to know about.
- A "still in motion" item settles (promote to "stable") or drifts further
  (add detail to rough edges).
- An authoritative doc is added or moved.

Not a contract; a map. Replace sections freely when the territory changes.
