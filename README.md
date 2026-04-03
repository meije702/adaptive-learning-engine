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

## Quick start

```bash
# Clone
git clone https://github.com/your-username/adaptive-learning-engine.git
cd adaptive-learning-engine

# Copy and customize config
cp config/examples/k8s-hybrid-cloud/curriculum.config.yaml config/curriculum.config.yaml
cp config/examples/k8s-hybrid-cloud/learner.config.yaml config/learner.config.yaml
cp config/examples/k8s-hybrid-cloud/system.config.yaml config/system.config.yaml

# Edit your configs
# → curriculum.config.yaml: define what to learn
# → learner.config.yaml: define who you are and your schedule
# → system.config.yaml: configure AI provider and parameters

# Run
deno task dev
```

## Create your own curriculum

Write three YAML files. No code changes needed.

- `curriculum.config.yaml` — domains, phases, bridges between prior and new knowledge
- `learner.config.yaml` — your background, schedule, preferences
- `system.config.yaml` — AI provider, timing, spaced repetition parameters

See `config/examples/` for a complete example (Kubernetes for AWS engineers).

## Architecture

Read [DESIGN.md](./DESIGN.md) for the full design philosophy.

Technical decisions are documented as ADRs:

- [ADR-001: Data model & API](./docs/adr/001-data-model-api.md)
- [ADR-002: Configuration-first design](./docs/adr/002-configuration-first.md)
- [ADR-003: Bridge principle & intake](./docs/adr/003-bridge-principle-intake.md)

## Core concept: everything is a bridge

Every step in the learning process is a transformation from a known state (`from`)
to a desired state (`to`). This pattern is recursive — it applies at every level:
curriculum, phase, domain, week, day.

The `from` can be empty. Not everyone has prior knowledge. The system detects this
and adapts: where an experienced professional learns through analogy, a beginner
learns through first principles.

## Tech stack

- **Runtime**: Deno
- **Web framework**: Fresh
- **Storage**: Deno KV
- **AI integration**: MCP (Model Context Protocol)
- **Language**: TypeScript

## License

MIT
