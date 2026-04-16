# Adaptive Learning Engine

An open-source platform that guides professionals from where they are to where
they want to be — with AI as the engine, not the owner.

## What is this?

A self-hosted adaptive learning system consisting of two decoupled components:

- **A web app** (Fresh on Deno Deploy) that owns all learning data: progress,
  generated content, answers, and feedback
- **An AI agent** (via MCP) that reads progress, generates content, evaluates
  answers, and adjusts the learning path

The AI is replaceable. The MCP protocol is the contract. The web app works
independently.

For a more detailed explanation of the system design, learning model, and
operational flow, see [docs/SYSTEM.md](./docs/SYSTEM.md).

## Platform components

The platform consists of these core pieces:

- a Fresh web app with dashboard, today view, and REST API routes
- Deno KV repositories for progress, weeks, days, questions, answers, feedback,
  and retention
- an MCP server that exposes the learning data and write operations to an AI
  coaching agent
- configuration schemas and an example curriculum for Kubernetes and hybrid
  cloud

## Quick start

```bash
# Clone
git clone https://github.com/your-username/adaptive-learning-engine.git
cd adaptive-learning-engine

# Run the web app with the bundled example configuration
cd src
deno task dev
```

Open `http://localhost:5188`.

The app loads `config/examples/k8s-hybrid-cloud/` by default.

## Use your own configuration

Create a directory containing these three files:

- `curriculum.config.yaml`
- `learner.config.yaml`
- `system.config.yaml`

Then point the app to that directory with `ALE_CONFIG_DIR`:

```bash
cd src
ALE_CONFIG_DIR=../config/examples/k8s-hybrid-cloud deno task dev
```

If you want to create a brand new curriculum, copy the example directory first:

```bash
cp -R config/examples/k8s-hybrid-cloud config/my-curriculum
cd src
ALE_CONFIG_DIR=../config/my-curriculum deno task dev
```

## Development commands

Run all commands from `src/`:

```bash
# Start the Fresh dev server
deno task dev

# Validate formatting, linting, and types
deno task check

# Run tests
deno task test

# Build the app
deno task build

# Start the MCP server on stdio
deno task mcp
```

## Create your own curriculum

Write three YAML files. No code changes needed.

- `curriculum.config.yaml` — domains, phases, bridges between prior and new
  knowledge
- `learner.config.yaml` — your background, schedule, preferences
- `system.config.yaml` — AI provider, timing, spaced repetition parameters

See `config/examples/` for a complete example.

## Architecture

Read [DESIGN.md](./DESIGN.md) for the full design philosophy.

Technical decisions are documented as ADRs:

- [ADR-001: Data model & API](./docs/adr/001-data-model-api.md)
- [ADR-002: Configuration-first design](./docs/adr/002-configuration-first.md)
- [ADR-003: Bridge principle & intake](./docs/adr/003-bridge-principle-intake.md)

For more specific and elaborate information about the operational design, weekly
cycle, coaching behavior, retention model, and intake flow, see
[docs/SYSTEM.md](./docs/SYSTEM.md).

## Core concept: everything is a bridge

Every step in the learning process is a transformation from a known state
(`from`) to a desired state (`to`). This pattern is recursive — it applies at
every level: curriculum, phase, domain, week, day.

The `from` can be empty. Not everyone has prior knowledge. The system detects
this and adapts: where an experienced professional learns through analogy, a
beginner learns through first principles.

Before the weekly cycle begins, the system runs an intake to validate the
learner's goal, estimate the gap, and advise whether the plan is realistic.

## Tech stack

- **Runtime**: Deno
- **Web framework**: Fresh
- **Storage**: Deno KV
- **AI integration**: MCP (Model Context Protocol)
- **Language**: TypeScript

## License

MIT
