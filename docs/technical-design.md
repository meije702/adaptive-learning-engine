# Adaptive Learning Engine -- Technical Design

This document describes the complete system architecture, data flow, and
integration points of the Adaptive Learning Engine (ALE). It is written so
that an LLM -- or any engineer -- can fully understand every component,
how they connect, and how to operate or extend the system.

---

## 1. System overview

The system has three components:

```
AI Agent (Claude via MCP)
    |
    |  MCP protocol (stdio transport)
    |  observe / generate / steer tools
    v
ALE (Fresh web app on Deno)
    |  system of record
    |  stores all data in Deno KV
    |  serves dashboard + today view
    |  provides DOM host + evaluator API for Scrim
    v
Scrim (runtime library, client-side)
    interprets SceneDocuments into interactive experiences
    renders into ALE's DOM
    orchestrates challenges, hints, feedback loops
    records interaction logs for replay
```

**ALE** is the entrypoint and system of record. It stores all learning
data, serves the web UI, exposes a REST API, and provides an MCP server
for AI agent interaction. ALE is AI-agnostic -- it works as a standalone
learning tracker without any agent connected.

**Scrim** is a TypeScript DSL and runtime for interactive content
experiences. It is a library that ALE uses client-side to render
SceneDocuments -- structured JSON that defines step-by-step interactive
lessons with rich content nodes, challenges, and evaluation. Scrim has no
server component and no persistence layer. It receives a SceneDocument,
renders it into a DOM host, and reports interactions back.

**The AI Agent** (Claude) is the coaching intelligence. It reads learner
state, generates SceneDocuments, evaluates free-text answers, adjusts
the learning path, and provides pedagogical feedback. It communicates
exclusively through MCP tools -- it never accesses the database or
filesystem directly.

---

## 2. ALE internals

### 2.1 Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Deno |
| Web framework | Fresh 2 (SSR + islands) |
| Frontend | Preact |
| Build | Vite |
| Database | Deno KV |
| AI protocol | MCP (Model Context Protocol) |
| Config | YAML with Zod validation |
| Language | TypeScript throughout |

### 2.2 Directory structure

```
src/
  main.ts                    Fresh app entrypoint
  deno.json                  Dependencies and tasks
  config/
    loader.ts                YAML loading + Zod validation
    schemas/                 Zod schemas for all config files
  db/
    types.ts                 Core entity interfaces
    repositories.ts          Repository interfaces + input types
    factory.ts               Repository instantiation
    kv.ts                    Deno KV connection
    kv/                      KV implementations per entity
  mcp/
    main.ts                  MCP server entrypoint (stdio)
    server.ts                Tool definitions
    handler.ts               Transport layer
  scrim/
    validate.ts              SceneDocument validation wrapper
    language_reference.ts    Loads Scrim language ref for MCP
  routes/
    index.tsx                Dashboard
    today.tsx                Today view (ScrimPlayer or plain text)
    week/[weekNumber]/       Week detail view
    api/                     REST API routes
      evaluate.ts            Evaluator bridge endpoint
      days/[dayContentId]/
        interaction-log.ts   Interaction log persistence
      weeks/, progress/, questions/, answers/, etc.
  islands/
    ScrimPlayer.tsx          Preact island mounting Scrim runtime
  components/
  assets/
config/
  examples/
    k8s-hybrid-cloud/        Complete working config example
      curriculum.config.yaml
      learner.config.yaml
      system.config.yaml
docs/
  SYSTEM.md                  Full operational design
  research/learning-science.md
  adr/                       Architecture decision records
```

### 2.3 Data model

All entities are stored in Deno KV with hierarchical key prefixes.

#### Progress

Tracks competence level (0-5) per curriculum domain.

```typescript
interface Progress {
  domainId: string;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  lastAssessedAt: string;          // ISO timestamp
  assessmentCount: number;
  history: ProgressEntry[];        // full audit trail
}
```

Levels: 0 = Unknown, 1 = Conceptual, 2 = Understanding, 3 = Application,
4 = Independent, 5 = Expert.

KV keys: `["progress", domainId]`

#### WeekPlan

One per week. Links a week to a curriculum domain.

```typescript
interface WeekPlan {
  weekNumber: number;
  domainId: string;
  isStretchWeek: boolean;
  createdAt: string;
  summary: string;                 // AI-generated week summary
  retrospective?: string;          // AI-written end-of-week reflection
}
```

KV keys: `["weeks", weekNumber]`

#### DayContent

One per active day. Contains the learning content.

```typescript
interface DayContent {
  id: string;                      // UUID
  weekNumber: number;
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6;
  type: DayType;                   // theory | practice_guided | practice_open | ...
  domainId: string;
  title: string;
  body: string;                    // text summary (always present)
  sceneDocument?: unknown;         // Scrim SceneDocument JSON (optional)
  createdAt: string;
  basedOn?: string[];              // IDs of answers this content reacts to
}
```

When `sceneDocument` is present, the frontend renders an interactive Scrim
scene. When absent, `body` is rendered as plain text. This provides full
backward compatibility.

KV keys: `["days", weekNumber, dayOfWeek]`, `["days_by_id", id]`

#### Question

Individual assessment items, linked to a DayContent.

```typescript
interface Question {
  id: string;
  dayContentId: string;
  domainId: string;
  sequence: number;
  type: "scenario" | "open" | "multiple_choice" | "troubleshoot";
  body: string;
  options?: QuestionOption[];      // for multiple_choice
  hints?: string[];
  maxLevel: number;                // competence level this question targets
  deadline: string;
  scrimCheckpoint?: string;        // links to Scrim challenge checkpoint
}
```

When a DayContent has a SceneDocument with challenge steps, the AI agent
also creates corresponding Question entities with `scrimCheckpoint` set.
This bridges Scrim challenges to ALE's answer/feedback pipeline.

KV keys: `["questions", questionId]`,
`["questions_by_day", dayContentId, sequence]`,
`["questions_by_checkpoint", scrimCheckpoint]`

#### Answer

```typescript
interface Answer {
  id: string;
  questionId: string;
  body: string;
  submittedAt: string;
  timeSpentSeconds?: number;
}
```

KV keys: `["answers", answerId]`, `["answers_by_question", questionId]`

#### Feedback

```typescript
interface Feedback {
  id: string;
  answerId: string;
  questionId: string;
  score: "correct" | "partial" | "incorrect";
  explanation: string;
  suggestedLevel: number;
  levelApplied: boolean;
  improvements: string[];
  createdAt: string;
}
```

KV keys: `["feedback", feedbackId]`, `["feedback_by_answer", answerId]`

#### RetentionSchedule

SM-2 spaced repetition tracking per domain.

```typescript
interface RetentionSchedule {
  domainId: string;
  nextDue: string;
  interval: number;                // days until next review
  streak: number;
  lastResult: "correct" | "partial" | "incorrect";
}
```

KV keys: `["retention", domainId]`

#### InteractionLog

Scrim interaction logs persisted for replay.

KV keys: `["interaction_logs", dayContentId]`

The log is an opaque JSON blob from Scrim's perspective (see section 3.5
for the structure).

### 2.4 Configuration system

Three YAML files configure the entire system. Zero domain-specific logic
lives in code.

#### curriculum.config.yaml

Defines what to learn: metadata, curriculum-level bridge (from -> to),
competence levels (0-5), learning phases, and individual domains with
their own bridges, prerequisites, key concepts, and resources.

Key concept: the **bridge principle**. Every learning step is a
transformation from a known state (`from`) to a target state (`to`).
This applies at every level: curriculum, phase, domain, week, day. The
AI agent uses the bridge to select teaching strategy:

| From-state | Strategy |
|---|---|
| Strong, related | Analogy -- build on what the learner knows |
| Empty (null) | First principles -- start with why it exists |
| Related, different | Contrast -- compare, emphasize divergence |
| Large gap | Scaffolded -- insert intermediate steps |
| Strong, small gap | Accelerated -- less theory, more challenge |

#### learner.config.yaml

Defines who is learning: profile (name, language, timezone), background
(technologies with proficiency), intake status, weekly schedule (rest day,
active days, day plan, generation time, assessment/feedback timing,
retention settings), and preferences (content length, tone, hints, etc.).

#### system.config.yaml

Defines how the system operates: server config, auth, storage backend,
AI provider/model, MCP transport, SM-2 retention parameters, content
length limits, assessment config, and export settings.

### 2.5 Weekly learning cycle

The schedule is fully configurable via `learner.config.yaml`. A typical
week:

| Day | Type | Activity |
|-----|------|----------|
| Monday | theory | Provocative question + theory briefing + explain-back |
| Tuesday | practice_guided | Guided practice with hints |
| Wednesday | practice_open | Open-ended scenario |
| Thursday | practice_troubleshoot | Broken scenario to diagnose |
| Friday | assessment | Scenario-based assessment targeting weak areas |
| Saturday | review | Feedback review + retention questions |
| Sunday | rest | Agent prepares next week |

Each day also includes 1-3 retention questions drawn from previously
completed domains (interleaving, SM-2 scheduling).

Content is never pre-generated in bulk. Each day's content is generated
after evaluating the previous day's answers, so difficulty and focus
adapt daily.

---

## 3. Scrim internals

### 3.1 What Scrim is

Scrim is a TypeScript DSL and runtime for interactive content experiences.
It defines a constrained vocabulary -- a finite set of node types, a fixed
effect protocol, and a declarative scene format -- in which interactive
lessons, assessments, and guided experiences are expressed as structured,
typed programs.

### 3.2 Package structure

| Package | Purpose |
|---------|---------|
| `@scrim/core` | Runtime, effect protocol, scene interpreter, node types |
| `@scrim/schema` | TypeScript types, JSON Schema, LLM-ready language reference |
| `@scrim/validate` | Structural + semantic validation for SceneDocuments |
| `@scrim/web` | Web renderer (HTML/CSS) with 17 built-in node factories |
| `@scrim/assessment` | Challenge orchestration: attempts, hints, feedback loops |

### 3.3 SceneDocument format

A SceneDocument is a JSON structure that defines an interactive
experience as a sequence of typed steps.

```json
{
  "protocolVersion": "1.0",
  "scene": { "name": "<scene-name>", "schemaVersion": "<version>" },
  "steps": [ ... ]
}
```

#### Step kinds

Every step has `id` (unique string) and `kind` (discriminant).

| Kind | Purpose | Required Fields | Produces Result |
|------|---------|-----------------|-----------------|
| `show` | Render a node tree | `node` | No |
| `ask` | Render prompt, await response | `node`, `checkpoint`, `schemaId` | Yes |
| `fetch` | HTTP request | `url`, `checkpoint`, `schemaId` | Yes |
| `evaluate` | Delegate to evaluator | `response`, `evaluatorKey`, `checkpoint`, `schemaId` | Yes |
| `scene` | Sub-scene or challenge | `name`, `steps` (or `challenge`) | Yes |
| `context` | Timestamp (`op: "now"`) | `op` | Yes |

Steps that produce results store them under the `result` field name
(defaults to `id`).

#### Dataflow

Reference a prior step's result with a `$ref` expression:

```json
{ "$ref": "step-id", "field": "correct" }
```

Valid in: `FetchStep.url`, `EvaluateStep.response`, node `properties`
values.

#### Node types

Nodes represent content. Each has `type`, `properties`, optional `name`,
`children`, `tags`.

**Content nodes:** `text`, `heading`, `code`, `image`, `callout`
**Interactive nodes:** `codeEditor`, `diagram`
**Layout nodes:** `stack`, `row`, `grid`, `card`
**Interaction nodes:** `button`, `input`, `select`
**Assessment nodes:** `challenge`, `feedback`, `hint`

#### Challenge shorthand

A `scene` step with a `challenge` field expands into an
ask-evaluate-feedback loop with attempt tracking and progressive hints:

```json
{
  "id": "q1",
  "kind": "scene",
  "name": "quiz",
  "steps": [],
  "challenge": {
    "type": "multiple-choice",
    "prompt": "Which layer handles routing?",
    "options": ["Transport", "Network", "Data Link"],
    "checkpoint": "routing-q",
    "schemaId": "v1",
    "evaluatorKey": "networking",
    "maxAttempts": 3,
    "hints": [
      { "content": "Think about Layer 3", "revealAfterAttempts": 1 }
    ]
  },
  "result": "quiz-result"
}
```

Challenge types: `multiple-choice`, `multi-select`, `free-text`,
`code-input`, `numeric`.

### 3.4 Runtime architecture

`ScrimRuntime<THost>` is a thin orchestrator that delegates to focused
collaborators:

| Collaborator | Responsibility |
|---|---|
| `CancellationController` | Abort signal, generator stack, pending-promise rejection |
| `InteractionController` | Respond/reject promise lifecycle for ask effects |
| `ReplayController` | Replay mode state, cache-miss detection, flush decisions |
| `ProgressTracker` | Checkpoint counting, progress snapshots |

The runtime constructor receives `RuntimeOptions<THost>`:

```typescript
interface RuntimeOptions<THost> {
  scene: SceneDefinition;
  renderer: Renderer<THost>;
  host: THost;
  replayLog?: InteractionLog;
  evaluator?: Evaluator;
  seed?: number;
  fetchAdapter?: FetchAdapter;
  onSchemaMismatch?: (key, oldSchema, newSchema) => void;
}
```

The `Evaluator` type:

```typescript
type Evaluator = (
  response: unknown,
  evaluatorKey: string,
  signal?: AbortSignal,
) => Promise<EvaluationResult>;

interface EvaluationResult {
  correct: boolean;
  score?: number;
  feedback?: string;
  metadata?: Record<string, unknown>;
}
```

### 3.5 Interaction log

Every interaction is recorded to a serializable log:

```typescript
interface InteractionLog {
  header: {
    sceneSchemaVersion: string;
    seed: number;
    startedAt: number;             // epoch ms
  };
  entries: InteractionLogEntry[];
}

interface InteractionLogEntry {
  checkpointKey: string;           // scoped path, e.g. "root/quiz#0"
  kind: "show" | "ask" | "fetch" | "evaluate" | "scene" | "context";
  schemaId?: string;
  timestamp: number;
  duration?: number;
  payload: LogPayload;             // discriminated by kind
}
```

Payloads per kind: `ShowLogPayload` (nodeSnapshot), `AskLogPayload`
(response), `FetchLogPayload` (url, responseBody),
`EvaluateLogPayload` (result), `SceneLogPayload` (enter/exit marker),
`ContextLogPayload` (op, result).

### 3.6 Replay

When `replayLog` is provided in `RuntimeOptions`, the runtime replays all
previously recorded interactions silently:

- Show effects update the scene tree without calling the renderer.
- Ask effects resolve from cached responses.
- When the log is exhausted or a cache miss occurs, the runtime
  transitions to live mode and flushes the accumulated tree to the
  renderer.

This gives learners continuity: they see their previous answers
rendered and continue from where they stopped.

### 3.7 Web renderer

`WebRenderer` implements `Renderer<HTMLElement>`. It creates DOM elements
using a `NodeFactoryRegistry` with 17 built-in factories. CSS classes
are prefixed `scrim-` to avoid collisions.

The interaction bridge: DOM event listeners in factories emit
`"interaction"` events via an `EventBus`. The engine registers
`renderer.on("interaction", ...)` during `run()`. DOM click ->
EventBus -> engine -> `InteractionController.respond()` -> ask effect
unblocks.

---

## 4. The AI Agent (Claude)

### 4.1 Connection

Claude connects to ALE via the MCP protocol over stdio transport.

```bash
# Start the MCP server
cd src && deno run -A --unstable-kv mcp/main.ts
```

The MCP server exposes tools in three categories: **observe** (read
learner state), **generate** (write content and feedback), and **steer**
(adjust progress and scheduling).

### 4.2 MCP tool catalog

#### Observe tools (read-only)

| Tool | Input | Returns |
|------|-------|---------|
| `get_dashboard` | none | currentWeek, overallProgress, pendingQuestions, retentionDue |
| `get_progress` | `domainId?` | competence levels for all or one domain |
| `get_pending_answers` | none | questions without answers |
| `get_recent_answers` | `since?` | answers without feedback |
| `get_week_overview` | `weekNumber` | plan + all days for that week |
| `get_retention_due` | none | domains due for spaced repetition today |
| `get_scene_document` | `dayContentId` | SceneDocument + interaction log for a day |

#### Generate tools (write content)

| Tool | Input | Effect |
|------|-------|--------|
| `create_week_plan` | weekNumber, domainId, isStretchWeek, summary | creates WeekPlan |
| `create_day_content` | weekNumber, dayOfWeek, type, domainId, title, body, sceneDocument?, basedOn? | creates DayContent (validates SceneDocument if present) |
| `create_questions` | dayContentId, questions[] (with optional scrimCheckpoint) | creates Question entities |
| `create_feedback` | answerId, questionId, score, explanation, suggestedLevel, applyLevel, improvements | creates Feedback, optionally updates Progress |

#### Steer tools (modify progress)

| Tool | Input | Effect |
|------|-------|--------|
| `update_progress` | domainId, level, source, notes? | updates competence level |
| `update_retention` | domainId, result | updates SM-2 schedule after retention test |
| `add_retrospective` | weekNumber, retrospective | adds end-of-week reflection to WeekPlan |

#### Intake tools

| Tool | Input | Effect |
|------|-------|--------|
| `start_intake` | none | creates or resumes IntakeSession, returns session + config context |
| `send_intake_message` | content, phase? | sends agent message, optionally advances intake phase |
| `complete_intake` | gapAnalysis, baselineResults | finalizes intake, sets baseline Progress, marks completed |

### 4.3 Agent behavioral instructions

The AI agent's behavioral contract is defined in `CLAUDE.md` at the
project root. Key principles:

- **Coach, not instructor.** Conceptual questions are answered with
  counter-questions. Factual questions are answered directly.
- **Bridge-based teaching.** Strategy is selected based on the gap
  between what the learner knows and what they need to learn.
- **Three-component feedback.** Every piece of feedback has: feed-up
  (where is the learner heading), feed-back (how did they do),
  feed-forward (what should they do next).
- **No gamification.** Progress is communicated in terms of the
  learner's own goals, not points or streaks.
- **Wellbeing awareness.** When `wellbeing.status` is "paused",
  the agent generates nothing. On return, it starts with a soft
  intake, not assessment.

### 4.4 Content generation with SceneDocuments

The MCP server's instructions include the full Scrim language reference.
This gives the agent the vocabulary to generate valid SceneDocuments.

The agent's content generation flow:

1. Read the dashboard and progress via observe tools.
2. Read unevaluated answers from the previous day.
3. Evaluate those answers (create_feedback).
4. Generate the next day's content as a SceneDocument:
   - Use `show` steps for theory content (headings, text, code,
     callouts, diagrams).
   - Use `scene` steps with `challenge` config for interactive
     questions.
   - Use `$ref` for dataflow between steps (pass an ask response
     to an evaluate step).
5. Call `create_day_content` with both `body` (text summary) and
   `sceneDocument` (the full scene JSON).
6. Call `create_questions` for each challenge in the scene, setting
   `scrimCheckpoint` to the challenge's `evaluatorKey`.

The `body` field is always required alongside `sceneDocument`. It serves
as a text-only summary for search, dashboards, and fallback rendering.

SceneDocuments are validated server-side using `@scrim/validate` before
storage. If validation fails, the tool returns the errors and nothing is
stored.

**When to use SceneDocuments vs plain text:**

| Day type | Format |
|----------|--------|
| theory | SceneDocument (rich content with callouts, code, diagrams) |
| practice_guided | SceneDocument (challenges with hints) |
| practice_open | SceneDocument (open scenario + challenge) |
| practice_troubleshoot | SceneDocument (broken scenario + diagnostic challenge) |
| assessment | SceneDocument (multiple challenges with strict evaluation) |
| retention | Plain text + separate Question entities (quick recall) |
| review | Either (depends on content complexity) |

### 4.5 Example: agent generates a theory day

The agent calls `create_day_content` with:

```json
{
  "weekNumber": 1,
  "dayOfWeek": 1,
  "type": "theory",
  "domainId": "container-fundamentals",
  "title": "Container Fundamentals",
  "body": "Introductie tot containers en pods. Vergelijking met Lambda functies.",
  "sceneDocument": {
    "protocolVersion": "1.0",
    "scene": { "name": "container-basics", "schemaVersion": "1" },
    "steps": [
      {
        "id": "intro",
        "kind": "show",
        "node": {
          "type": "stack",
          "properties": { "gap": "16px" },
          "children": [
            { "type": "heading", "properties": { "content": "Container Fundamentals", "level": 1 } },
            { "type": "text", "properties": { "content": "Je kent Lambda functies als isolated units of execution. Containers volgen hetzelfde principe, maar met meer controle over de runtime." } },
            { "type": "callout", "properties": { "content": "Een container is vergelijkbaar met een Lambda functie die je zelf verpakt: je kiest de runtime, de dependencies, en de configuratie.", "variant": "info" } }
          ]
        }
      },
      {
        "id": "provocation",
        "kind": "ask",
        "node": { "type": "input", "properties": { "placeholder": "Wat zou het voordeel zijn van zelf je runtime te beheren vs. Lambda?" } },
        "checkpoint": "provocation-q",
        "schemaId": "v1",
        "result": "provocation-answer"
      },
      {
        "id": "concepts",
        "kind": "show",
        "node": {
          "type": "stack",
          "properties": { "gap": "12px" },
          "children": [
            { "type": "heading", "properties": { "content": "Van Lambda naar Pods", "level": 2 } },
            { "type": "code", "properties": { "content": "Lambda function  ->  Container  ->  Pod\n(managed runtime)    (own runtime)   (K8s scheduling unit)", "language": "text" } },
            { "type": "text", "properties": { "content": "Een Pod is de kleinste deployable unit in Kubernetes. Het bevat een of meer containers die resources delen." } }
          ]
        }
      },
      {
        "id": "quiz",
        "kind": "scene",
        "name": "concept-check",
        "steps": [],
        "challenge": {
          "type": "multiple-choice",
          "prompt": "Wat is het belangrijkste verschil tussen een Lambda functie en een container?",
          "options": [
            "Containers zijn altijd sneller",
            "Je beheert zelf de runtime en dependencies",
            "Containers kunnen alleen op AWS draaien",
            "Lambda functies kunnen geen netwerk gebruiken"
          ],
          "checkpoint": "concept-q",
          "schemaId": "v1",
          "evaluatorKey": "concept-q",
          "maxAttempts": 2,
          "hints": [
            { "content": "Denk aan wat je zelf kiest bij een container vs wat AWS voor je regelt.", "revealAfterAttempts": 1 }
          ]
        },
        "result": "quiz-result"
      },
      {
        "id": "summary",
        "kind": "show",
        "node": { "type": "callout", "properties": { "content": "Key takeaway: containers geven je controle over de runtime. Pods groeperen containers als scheduling unit. Kubernetes orchestreert pods net zoals AWS Lambda functies managed.", "variant": "tip" } }
      }
    ]
  }
}
```

Then creates the linked question:

```json
{
  "dayContentId": "<returned-id>",
  "questions": [{
    "domainId": "container-fundamentals",
    "sequence": 1,
    "type": "multiple_choice",
    "body": "Wat is het belangrijkste verschil tussen een Lambda functie en een container?",
    "options": [
      { "key": "A", "text": "Containers zijn altijd sneller", "isOptimal": false },
      { "key": "B", "text": "Je beheert zelf de runtime en dependencies", "isOptimal": true },
      { "key": "C", "text": "Containers kunnen alleen op AWS draaien", "isOptimal": false },
      { "key": "D", "text": "Lambda functies kunnen geen netwerk gebruiken", "isOptimal": false }
    ],
    "maxLevel": 1,
    "deadline": "2026-04-14T20:00:00Z",
    "scrimCheckpoint": "concept-q"
  }]
}
```

The `scrimCheckpoint: "concept-q"` links the ALE Question to the
challenge's `evaluatorKey: "concept-q"` in the SceneDocument. When the
learner answers the challenge in the browser, the evaluator bridge looks
up the question by checkpoint to grade it.

---

## 5. Integration: how the components connect

### 5.1 Content flow (AI -> ALE -> Scrim -> Learner)

```
1. AI agent reads learner state via MCP observe tools
2. AI generates SceneDocument JSON + text summary
3. AI calls create_day_content (MCP) with both body and sceneDocument
4. ALE validates the SceneDocument using @scrim/validate
5. ALE stores DayContent in Deno KV

6. Learner visits /today
7. ALE route handler loads DayContent from KV
8. If sceneDocument exists: loads interaction log from KV (for replay)
9. Renders ScrimPlayer island with sceneDocument + interactionLog props

10. ScrimPlayer (client-side):
    a. Dynamically imports @scrim/core, @scrim/web, @scrim/assessment
    b. interpret(sceneDocument) -> SceneDefinition
    c. new WebRenderer() -> DOM renderer
    d. new ScrimRuntime({ scene, renderer, host, replayLog, evaluator })
    e. runtime.run() -> steps through the scene
```

### 5.2 Evaluator bridge (Scrim -> ALE -> Feedback)

When the learner hits a challenge step, Scrim's runtime calls the
injected evaluator function. The evaluator lives in the browser
(ScrimPlayer island) and makes an HTTP call to ALE:

```
Scrim evaluate effect
  -> evaluator(response, evaluatorKey, signal)
  -> POST /api/evaluate { response, evaluatorKey, dayContentId }
  -> ALE looks up Question by scrimCheckpoint = evaluatorKey
  -> ALE creates Answer record
  -> For multiple-choice: evaluates locally, creates Feedback
  -> For free-text: stores answer, returns preliminary result
     (AI agent evaluates async via create_feedback MCP tool)
  -> Returns EvaluationResult to Scrim
  -> Scrim renders feedback node based on result
```

**Evaluation result mapping (Scrim -> ALE):**

| Scrim EvaluationResult | ALE Feedback.score |
|---|---|
| `correct: true` | `"correct"` |
| `correct: false, score > 0.3` | `"partial"` |
| `correct: false, score <= 0.3` | `"incorrect"` |

### 5.3 Interaction log persistence (Scrim -> ALE -> KV)

```
Scrim runtime records every interaction to InteractionLog
  -> On scene complete or page unload:
     ScrimPlayer calls PUT /api/days/:id/interaction-log
  -> ALE stores log in KV at ["interaction_logs", dayContentId]

On revisit:
  -> ALE loads log from KV
  -> Passes as replayLog prop to ScrimPlayer
  -> Scrim replays silently, then transitions to live mode
```

### 5.4 AI reading interaction data

The AI agent calls `get_scene_document` to retrieve both the
SceneDocument and the interaction log for a day. From the interaction
log, it can determine:

- Which challenges the learner attempted
- How many attempts per challenge
- Which hints were revealed
- Learner responses to ask steps
- Time spent per interaction

This informs next-day content generation and difficulty calibration.

---

## 5.5 Intake flow (AI <-> Learner via ALE)

Before any learning content is generated, the AI agent conducts an
intake conversation. The intake validates the learner's goal, verifies
their background, runs a baseline measurement, performs gap analysis,
and presents honest feasibility advice.

**Data model:**

`LearnerState` (KV singleton) -- mutable runtime overlay on static YAML:
- `intake.completed`, `intake.completedAt`
- `wellbeing.status` ("active" | "paused" | "returning")

`IntakeSession` (KV singleton) -- tracks conversation state:
- `status`: goal_validation -> profile_validation -> baseline ->
  gap_analysis -> confirmation -> completed
- `baselineResults[]`: per-phase baseline assessment results
- `gapAnalysis`: feasibility, risk factors, accelerators, per-phase
  strategy recommendations

`IntakeMessage` (KV, ordered by timestamp) -- conversation history:
- `role`: "agent" | "learner"
- `content`: message text
- `phase`: which intake phase this message belongs to

**MCP tools:**

| Tool | Input | Effect |
|------|-------|--------|
| `start_intake` | none | Creates IntakeSession, returns session + learner config + curriculum bridge |
| `send_intake_message` | content, phase? | Agent sends a message, optionally advances the phase |
| `complete_intake` | gapAnalysis, baselineResults | Finalizes: stores results, sets Progress levels, marks LearnerState.intake.completed |

**UI:** `/intake` shows a conversational interface (IntakeChat island).
The learner reads agent messages and responds via text input. The island
polls for new agent messages. The dashboard shows an intake banner when
`LearnerState.intake.completed` is false.

**Flow:**
```
1. Agent calls start_intake -> gets config context
2. Agent sends goal validation questions via send_intake_message
3. Learner responds via POST /api/intake/messages
4. Agent reads responses, validates profile, runs baseline questions
5. Agent advances phases as appropriate
6. Agent calls complete_intake with gap analysis + baseline results
7. ALE sets initial Progress levels and marks intake completed
8. First week plan can now be generated
```

---

## 6. REST API

All endpoints return JSON. Error responses use RFC 7807 Problem Details.

### Content

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/weeks` | List or create week plans |
| GET | `/api/weeks/:weekNumber` | Get specific week |
| GET | `/api/weeks/:weekNumber/days` | Get all days in week |
| GET/POST | `/api/weeks/:weekNumber/days/:dayOfWeek` | Get/create day content |
| GET | `/api/days/today` | Get today's content |
| GET | `/api/days/:dayContentId/questions` | Questions for a day |

### Assessment

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questions/pending` | Unanswered questions |
| GET | `/api/questions/:questionId` | Get question |
| GET/POST | `/api/questions/:questionId/answer` | Get/submit answer |
| GET | `/api/answers/recent` | Answers without feedback |
| GET | `/api/answers/:answerId/feedback` | Feedback for answer |
| GET | `/api/feedback/recent` | Recent feedback |

### Progress

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/progress` | All domain progress |
| GET | `/api/progress/:domainId` | Specific domain |

### Retention

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/retention` | All retention schedules |
| GET | `/api/retention/due` | Domains due today |
| GET | `/api/retention/:domainId` | Specific domain schedule |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary` | Dashboard stats |
| GET | `/api/dashboard/week/:weekNumber` | Week details |

### Intake

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/intake` | Current IntakeSession |
| GET | `/api/intake/messages?since=` | Intake messages (optional timestamp filter) |
| POST | `/api/intake/messages` | Learner sends a message |

### Scrim integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/evaluate` | Evaluator bridge for Scrim challenges |
| GET/PUT | `/api/days/:dayContentId/interaction-log` | Interaction log persistence |

---

## 7. Frontend rendering

### 7.1 Dashboard (server-rendered)

The dashboard at `/` shows overall progress, current week, open
questions, retention due count, curriculum bridge visualization, and
a knowledge graph organized by phase with domain cards color-coded by
competence level. Fully server-rendered, no islands.

### 7.2 Today view (server-rendered + island)

The today view at `/today` branches:

- **SceneDocument present:** renders the `ScrimPlayer` island. The
  scene document and interaction log are passed as serialized props.
  The island hydrates client-side and mounts the Scrim runtime.
- **No SceneDocument:** renders `body` as plain text in a `pre-wrap`
  section, followed by static question/answer/feedback cards.

### 7.3 ScrimPlayer island

Located at `src/islands/ScrimPlayer.tsx`. A Preact component that:

1. Receives `sceneDocument`, `interactionLog?`, `dayContentId` as
   props.
2. In `useEffect`, creates a container div ref and dynamically imports
   all `@scrim/*` packages (client-side only).
3. Constructs the runtime with the evaluator bridge:
   - The evaluator calls `POST /api/evaluate` with the response,
     evaluatorKey, and dayContentId.
4. Calls `runtime.run()`.
5. On completion or unmount: persists the interaction log via
   `PUT /api/days/:id/interaction-log`.
6. On unmount: calls `runtime.cancel()` for cleanup.

Scrim's WebRenderer manipulates the DOM directly inside the container
div. Preact does not reconcile its children since the container is
managed via a ref inside `useEffect`. This is the standard pattern for
integrating imperative DOM libraries with React/Preact.

---

## 8. Setting up with Claude as the AI agent

### 8.1 Prerequisites

- Deno installed
- The `scrim` repo cloned adjacent to the `adaptive-learning-engine` repo:
  ```
  Developer/
    adaptive-learning-engine/
    scrim/
  ```

### 8.2 Starting the web app

```bash
cd adaptive-learning-engine/src
deno task dev        # development (Vite, port 5188)
deno task build && deno task start   # production (port 8000)
```

### 8.3 Starting the MCP server

```bash
cd adaptive-learning-engine/src
deno task mcp        # stdio transport
```

### 8.4 Connecting Claude

In Claude Desktop or Claude Code, configure the MCP server:

```json
{
  "mcpServers": {
    "adaptive-learning-engine": {
      "command": "deno",
      "args": ["run", "-A", "--unstable-kv", "mcp/main.ts"],
      "cwd": "/path/to/adaptive-learning-engine/src"
    }
  }
}
```

Claude will see all observe/generate/steer tools plus the Scrim language
reference in the server instructions.

### 8.5 Configuration

Edit the YAML files in `config/examples/k8s-hybrid-cloud/` (or create
a new config set and point `ALE_CONFIG_DIR` to it):

- `curriculum.config.yaml` -- what to learn
- `learner.config.yaml` -- who is learning
- `system.config.yaml` -- how the system operates

### 8.6 The agent's daily workflow

1. At generation time (default 22:00), connect and call `get_dashboard`.
2. Call `get_recent_answers` to find unevaluated answers.
3. Evaluate each answer via `create_feedback`.
4. Determine tomorrow's domain and day type from the schedule.
5. Read the domain's bridge config to select teaching strategy.
6. Generate a SceneDocument for tomorrow's content.
7. Call `create_day_content` with the scene + text summary.
8. Call `create_questions` for any challenges in the scene.
9. If Sunday: write retrospective via `add_retrospective`, create
   next week's plan via `create_week_plan`.

---

## 9. Key design decisions

| Decision | Rationale |
|---|---|
| ALE is AI-agnostic | Any MCP-compatible AI can be the coaching agent |
| SceneDocument is optional on DayContent | Full backward compatibility with existing plain-text content |
| Scrim runs client-side only | No server-side DOM dependency; Fresh SSR is unaffected |
| Evaluator bridge via HTTP | Clean separation; Scrim doesn't need ALE imports |
| Questions still exist alongside SceneDocuments | Preserves the existing answer/feedback pipeline; AI can evaluate async |
| Interaction logs stored as opaque JSON | ALE doesn't need to understand Scrim's log format |
| Language reference embedded in MCP instructions | Agent always has the vocabulary without extra tool calls |
| Config-first (YAML, no domain logic in code) | Same codebase deploys to any curriculum by swapping config |
