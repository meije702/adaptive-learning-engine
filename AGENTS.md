# Agent notes — working in this codebase

Vendor-neutral notes for any coding assistant (Claude Code, Codex, Cursor,
Aider, a new human contributor). The behavioural contract for the in-app
coaching agent lives in `CLAUDE.md` — this file is only about *developing*
the ALE, not about how the coaching persona should act with learners.

Related docs:
- `docs/SYSTEM.md` — full system design and learning-science rationale.
- `docs/technical-design.md` — integration flows (ALE ↔ Scrim ↔ MCP ↔ Claude).
- `docs/design-system.md` — visual design layering across ALE and Scrim:
  token vocabulary (Scrim), `--ale-*` alias layer, preset modules, per-course
  YAML, learner-scoped overlay with provenance, twelve fitness functions.

---

## Deno layout

- **All `deno task` commands run from `src/`**, not the repo root. `deno.json` lives there. `cd src && deno task check` / `test:check` / `mcp`.
- `deno task check` = `deno fmt --check . && deno lint . && deno check`.
- `deno task test:check` = `deno check main.ts mcp/main.ts && deno test -A`. This is the "real" test command — the plain `deno test -A` task skips type-checking.
- **Run `deno fmt .` before committing.** Formatting drift after edits is near-universal and `check` fails on it first.

## MCP SDK

- **`src/mcp/sdk_compat.js` is a deliberate bridge.** The MCP SDK's deep subpath imports (`@modelcontextprotocol/sdk/server/mcp.js` etc.) don't resolve cleanly under Deno. Don't "fix" by replacing with direct imports — it will break `deno check`.
- Type declarations for the bridge are in `src/mcp/sdk_compat.d.ts`.
- `node:async_hooks` (used by `src/obs/correlation.ts`) requires `npm:@types/node` in the import map — already present; leave it.

## Where things live

| Concern | Location | Notes |
|---|---|---|
| Shared business rules | `src/domain/*.ts` | **Invariant:** MCP tools and REST routes both call these. Never reimplement rules at a boundary. |
| Spaced-repetition math | `src/domain/spaced_repetition.ts` | Pure. `KvRetentionRepository` is a thin read/write-through. |
| MCP tools | `src/mcp/tools/*.ts`, registered from `src/mcp/server.ts` | Grouped by concern: observe / generate / steer / calibration / wellbeing / gap / intake / scheduling. |
| Gap-analysis types | `src/analysis/types.ts` | Persisted shape lives here, *not* in `db/types.ts`. |
| Scrim persistence wrapper | `src/scrim/snapshot.ts` | `sceneDocument` is stored wrapped; always `unwrapSceneDocument` on read. |
| Errors | `src/domain/errors.ts` | Throw `ValidationError` / `NotFoundError` / `ConflictError` from domain code. |
| REST error mapper | `src/api/error.ts` | `problemFromDomainError` → RFC 7807. |
| MCP error mapper | `src/mcp/define_tool.ts` | Wraps every tool; maps `DomainError` → `txt({ error, code })`. |
| Logging | `src/obs/logger.ts` | `log.info(event, fields)`. JSON lines to stderr (stdout is MCP transport). |
| Correlation IDs | `src/obs/correlation.ts` | `withCorrelationId(id, fn)` via AsyncLocalStorage. REST middleware + `defineTool` already bind them; don't log inside repos. |

## Persistence versioning

Unstable persisted shapes use an explicit snapshot wrapper:

```ts
{ schemaVersion: 1, result: ... }   // GapAnalysisSnapshot
{ schemaVersion: 1, document: ... } // SceneDocumentSnapshot
```

- **Write** via `toGapAnalysisSnapshot` / `toSceneDocumentSnapshot`.
- **Read** via `unwrapGapAnalysisSnapshot` / `unwrapSceneDocument` — these tolerate legacy raw records.
- **Only unstable shapes get versioning.** Don't add `schemaVersion` to Answer, Feedback, Progress, etc.

## Tests

- BDD via `@std/testing/bdd` — `describe / it / beforeEach / afterEach`.
- `createTestKv()` + entity builders in `src/test_helpers.ts`. Real in-memory KV, no mocks.
- MCP integration tests use `Client` + `InMemoryTransport` from `src/mcp/sdk_compat.js`.
- Unit-test domain modules directly (`src/domain/*_test.ts`) — pure, no KV.
- Scenario tests (`src/scenarios/*_test.ts`) drive real MCP tool calls end-to-end; don't hand-copy handler logic into tests.

## Adding an MCP tool

1. Pick or create a file under `src/mcp/tools/`.
2. Use `defineTool(server, name, { description, inputSchema }, handler)`. Schema is Zod; handler input is inferred. No `any` casts needed.
3. Register the module from `src/mcp/server.ts` (one `register(ctx)` call).
4. If the tool shares logic with a REST route, extract the shared code to `src/domain/` first.

## Commit style

- Conventional prefix: `refactor:`, `feat:`, `fix:`, `chore:`, `docs:`.
- Footer: `Co-Authored-By: Claude <noreply@anthropic.com>` (see recent `git log`).
- Small, focused commits. The recent refactor landed as one commit per work package — easy to revert individually.

## Gotchas

- `src/config/schemas/system.ts` models `mcp.transport` as `z.literal("stdio")`. SSE was specified in early designs, never shipped, and the schema now rejects it. Don't re-add without implementing it.
- `src/db/kv/days.ts` scans weeks to resolve "today". Fine at single-learner scale; revisit before shipping multi-tenant.
- No data migrations exist. Breaking a persisted shape without bumping its snapshot schemaVersion (where one exists) or without adding a migration (where one doesn't) will silently corrupt historical records.
