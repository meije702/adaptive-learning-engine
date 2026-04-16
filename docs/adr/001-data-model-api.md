# ADR-001: K8s Learning System — Data Model & API Specification

**Status:** Proposed **Date:** 2026-04-03 **Author:** Sander + Claude
**Deciders:** Sander

## Context

We bouwen een adaptief leersysteem bestaande uit twee onafhankelijke
componenten:

1. **Web app** (Fresh on Deno Deploy) — het system of record voor alle leerdata,
   en de UI voor de gebruiker
2. **AI agent** (Claude via MCP) — de intelligentie die content genereert,
   antwoorden beoordeelt, en het leerpad stuurt

De MCP server is het contract tussen beide. De web app is AI-agnostisch: het
werkt als statische tracker zonder agent, en accepteert elke AI die het
MCP-contract respecteert.

## Decision

### Principes

- **App bezit de data, agent bezit de intelligentie** — geen content of
  voortgang leeft alleen in de AI
- **Elke gegenereerde content is immutable na creatie** — de AI schrijft, de app
  bewaart, niets wordt overschreven
- **Antwoorden en feedback zijn apart** — een antwoord bestaat onafhankelijk van
  de beoordeling
- **Tijdlijn is heilig** — elke entiteit heeft timestamps, de weekloop is de
  hartslag van het systeem

---

## 1. Entiteiten

### 1.1 Domain

De 16 kennisdomeinen. Statisch gedefinieerd, niet door de AI gegenereerd.

```typescript
interface Domain {
  id: string; // "container-fundamentals"
  name: string; // "Container fundamentals"
  phase: 1 | 2 | 3 | 4;
  weekNumber: number; // 1-16, de geplande week
  bridge: string; // "Lambda → Pod: unit of deployment"
  prerequisites: string[]; // domain ids die eerst level >= 2 moeten zijn
  tags: string[]; // ["docker", "oci", "runtime", "images"]
}
```

### 1.2 Progress

Het competentieniveau per domein. Wordt bijgewerkt door de AI na evaluatie.

```typescript
interface Progress {
  domainId: string;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  lastAssessedAt: string; // ISO 8601
  assessmentCount: number;
  history: ProgressEntry[];
}

interface ProgressEntry {
  level: number;
  assessedAt: string; // ISO 8601
  source: "assessment" | "retention" | "manual";
  notes?: string; // AI-gegenereerde notitie over de beoordeling
}
```

**Competentieniveaus:**

| Level | Label       | Omschrijving                               |
| ----- | ----------- | ------------------------------------------ |
| 0     | Onbekend    | Nog niet behandeld                         |
| 1     | Conceptueel | Kan uitleggen wat het is en waarom         |
| 2     | Begrip      | Kan relateren aan bestaande kennis         |
| 3     | Toepassing  | Kan configureren met begeleiding           |
| 4     | Zelfstandig | Kan zelfstandig opzetten en troubleshooten |
| 5     | Expert      | Kan in productie ontwerpen en uitleggen    |

### 1.3 WeekPlan

De planning voor één week. Gegenereerd door de AI op zondag.

```typescript
interface WeekPlan {
  weekNumber: number; // 1-16+
  domainId: string; // het hoofddomein van deze week
  isStretchWeek: boolean; // elke 3-4 weken een onderwerp buiten comfort zone
  createdAt: string; // ISO 8601
  summary: string; // AI-samenvatting van de weekdoelen
  retrospective?: string; // AI-analyse na afloop (geschreven volgende zondag)
}
```

### 1.4 DayContent

De content voor één dag. Gegenereerd door de AI, typisch de nacht ervoor.

```typescript
interface DayContent {
  id: string; // uuid
  weekNumber: number;
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6; // ma=1 t/m za=6, zo=0 is rustdag
  type: DayType;
  domainId: string;
  title: string;
  body: string; // markdown content
  createdAt: string; // ISO 8601, wanneer de AI het genereerde
  basedOn?: string[]; // ids van Answers die als input dienden
}

type DayType =
  | "theory" // maandag
  | "practice_guided" // dinsdag
  | "practice_open" // woensdag
  | "practice_troubleshoot" // donderdag
  | "assessment" // vrijdag (gegenereerd na donderdagantwoord)
  | "review" // zaterdag (optioneel)
  | "retention"; // dagelijkse retentievragen (ma-za)
```

### 1.5 Question

Een individuele vraag, onderdeel van DayContent.

```typescript
interface Question {
  id: string; // uuid
  dayContentId: string; // parent DayContent
  domainId: string; // kan afwijken van DayContent bij retentievragen
  sequence: number; // volgorde binnen de dag
  type: "scenario" | "open" | "multiple_choice" | "troubleshoot";
  body: string; // markdown, de vraagstelling
  options?: QuestionOption[]; // alleen bij multiple_choice
  hints?: string[]; // progressieve hints
  maxLevel: number; // het competentieniveau dat deze vraag toetst
  deadline: string; // ISO 8601, wanneer het antwoord verwacht wordt
}

interface QuestionOption {
  key: "A" | "B" | "C" | "D";
  text: string;
  isOptimal: boolean; // niet zichtbaar in de app, alleen voor AI-evaluatie
}
```

### 1.6 Answer

Het antwoord van de gebruiker op een vraag.

```typescript
interface Answer {
  id: string; // uuid
  questionId: string;
  body: string; // het antwoord (vrije tekst of "A"/"B"/"C"/"D")
  submittedAt: string; // ISO 8601
  timeSpentSeconds?: number; // optioneel, voor CKA-tijddruk training
}
```

### 1.7 Feedback

De AI-beoordeling van een antwoord. Geschreven na het lezen van het Answer.

```typescript
interface Feedback {
  id: string; // uuid
  answerId: string;
  questionId: string;
  score: "correct" | "partial" | "incorrect";
  explanation: string; // markdown, waarom dit het oordeel is
  suggestedLevel: number; // 0-5, het niveau dat dit antwoord demonstreert
  levelApplied: boolean; // of de Progress daadwerkelijk is bijgewerkt
  improvements: string[]; // concrete verbeterpunten
  createdAt: string; // ISO 8601
}
```

### 1.8 RetentionSchedule

Spaced repetition planning per domein.

```typescript
interface RetentionSchedule {
  domainId: string;
  nextDue: string; // ISO 8601
  interval: number; // dagen tot volgende herhaling
  streak: number; // aantal keer achtereen correct
  lastResult: "correct" | "partial" | "incorrect";
}
```

**Spaced repetition intervallen:**

- Na correct: interval × 2.5 (1 → 3 → 7 → 17 → 42 dagen)
- Na deels correct: interval × 1.2
- Na incorrect: reset naar 1 dag

---

## 2. REST API

Base URL: `https://{app}.deno.dev/api`

Volgt Zalando API Guidelines waar van toepassing (kebab-case URLs, RFC 9457
errors, pagination via cursor).

### 2.1 Progress

```
GET    /api/progress                    → Progress[]
GET    /api/progress/{domainId}         → Progress
PUT    /api/progress/{domainId}         → Progress
```

**PUT body:**

```json
{
  "level": 3,
  "source": "assessment",
  "notes": "Goed begrip van Pod lifecycle, moeite met init containers"
}
```

### 2.2 Week Plans

```
GET    /api/weeks                       → WeekPlan[]
GET    /api/weeks/{weekNumber}          → WeekPlan
POST   /api/weeks                       → WeekPlan (AI genereert)
PATCH  /api/weeks/{weekNumber}          → WeekPlan (retrospective toevoegen)
```

### 2.3 Day Content

```
GET    /api/weeks/{weekNumber}/days                    → DayContent[]
GET    /api/weeks/{weekNumber}/days/{dayOfWeek}        → DayContent
POST   /api/weeks/{weekNumber}/days                    → DayContent (AI schrijft)
GET    /api/days/today                                 → DayContent (convenience)
```

### 2.4 Questions

```
GET    /api/days/{dayContentId}/questions               → Question[]
GET    /api/questions/{questionId}                      → Question
POST   /api/days/{dayContentId}/questions               → Question (AI genereert)
GET    /api/questions/pending                           → Question[] (onbeantwoorde vragen)
```

### 2.5 Answers

```
GET    /api/questions/{questionId}/answer               → Answer | 404
POST   /api/questions/{questionId}/answer               → Answer
GET    /api/answers/recent?since={ISO8601}              → Answer[] (voor AI evaluatie)
```

### 2.6 Feedback

```
GET    /api/answers/{answerId}/feedback                 → Feedback | 404
POST   /api/answers/{answerId}/feedback                 → Feedback (AI schrijft)
GET    /api/feedback/recent?since={ISO8601}             → Feedback[]
```

### 2.7 Retention

```
GET    /api/retention/due                               → RetentionSchedule[] (vandaag due)
GET    /api/retention                                   → RetentionSchedule[]
PUT    /api/retention/{domainId}                        → RetentionSchedule
```

### 2.8 Dashboard (read-only aggregaties)

```
GET    /api/dashboard/summary           → { currentWeek, overallProgress,
                                            activeDomains, pendingQuestions,
                                            todayType, streakDays }
GET    /api/dashboard/week/{weekNumber} → { plan, days[], questionCount,
                                            answerCount, avgScore }
```

### Error format (RFC 9457)

```json
{
  "type": "https://learning.app/errors/not-found",
  "title": "Resource not found",
  "status": 404,
  "detail": "No answer found for question abc-123",
  "instance": "/api/questions/abc-123/answer"
}
```

---

## 3. MCP Server — Tool Definitions

De MCP server vertaalt de REST API naar tools die een AI-agent kan gebruiken.
Gegroepeerd naar de taken die de agent uitvoert.

### 3.1 Lezen (observeren)

```yaml
get_dashboard:
  description: "Haal het complete overzicht op: huidige week, voortgang, openstaande vragen, vandaag's activiteit"
  returns: DashboardSummary

get_progress:
  description: "Haal competentieniveaus op voor alle domeinen of één specifiek domein"
  params:
    domainId?: string
  returns: Progress | Progress[]

get_pending_answers:
  description: "Haal alle onbeantwoorde vragen op"
  returns: Question[]

get_recent_answers:
  description: "Haal antwoorden op die nog geen feedback hebben"
  params:
    since?: string # ISO 8601, default: 24 uur geleden
  returns: Answer[]

get_week_overview:
  description: "Haal alle content, vragen, antwoorden en feedback op voor een specifieke week"
  params:
    weekNumber: number
  returns: WeekOverview

get_retention_due:
  description: "Welke domeinen zijn toe aan herhaling vandaag?"
  returns: RetentionSchedule[]
```

### 3.2 Schrijven (genereren)

```yaml
create_week_plan:
  description: "Maak het weekplan aan voor de komende week. Draai op zondag."
  params:
    weekNumber: number
    domainId: string
    isStretchWeek: boolean
    summary: string
  returns: WeekPlan

create_day_content:
  description: "Genereer en sla de content op voor een specifieke dag"
  params:
    weekNumber: number
    dayOfWeek: 1-6
    type: DayType
    domainId: string
    title: string
    body: string          # markdown
    basedOn?: string[]    # answer ids die als input dienden
  returns: DayContent

create_questions:
  description: "Voeg vragen toe aan een dagcontent"
  params:
    dayContentId: string
    questions: QuestionInput[]
  returns: Question[]

create_feedback:
  description: "Schrijf feedback op een antwoord en update optioneel het competentieniveau"
  params:
    answerId: string
    score: "correct" | "partial" | "incorrect"
    explanation: string
    suggestedLevel: number
    applyLevel: boolean
    improvements: string[]
  returns: Feedback
```

### 3.3 Bijwerken (sturen)

```yaml
update_progress:
  description: "Werk het competentieniveau bij voor een domein"
  params:
    domainId: string
    level: 0-5
    source: "assessment" | "retention" | "manual"
    notes?: string
  returns: Progress

update_retention:
  description: "Werk de spaced repetition planning bij na een retentietoets"
  params:
    domainId: string
    result: "correct" | "partial" | "incorrect"
  returns: RetentionSchedule

add_retrospective:
  description: "Voeg een weekretrospective toe. Draai op zondag voor de vorige week."
  params:
    weekNumber: number
    retrospective: string
  returns: WeekPlan
```

---

## 4. Weekloop — Trigger Sequence

Scheduled tasks die de AI activeren op de juiste momenten.

```
Zondag    22:00  →  agent: get_week_overview(vorige week)
                    agent: add_retrospective(vorige week)
                    agent: get_progress()
                    agent: get_retention_due()
                    agent: create_week_plan(nieuwe week)
                    agent: create_day_content(maandag, theory)
                    agent: create_questions(retentie maandag)

Maandag   22:00  →  agent: get_recent_answers()
                    agent: create_feedback(voor elk antwoord)
                    agent: create_day_content(dinsdag, practice_guided)
                    agent: create_questions(retentie dinsdag)

Dinsdag   22:00  →  (zelfde patroon)
                    agent: create_day_content(woensdag, practice_open)

Woensdag  22:00  →  agent: create_day_content(donderdag, practice_troubleshoot)

Donderdag 22:00  →  agent: get_recent_answers()
                    agent: create_feedback(...)
                    agent: create_day_content(vrijdag, assessment)
                    ↑ assessment is gebaseerd op de hele week

Vrijdag   22:00  →  agent: create_questions(retentie zaterdag)
                    (assessment feedback pas na inlevering)

Zaterdag  22:00  →  agent: get_recent_answers()  # assessment antwoord
                    agent: create_feedback(assessment)
                    agent: update_progress(op basis van assessment)
                    agent: update_retention(...)
```

---

## 5. Storage: Deno KV

Deno Deploy biedt Deno KV als built-in key-value store. Structuur:

```
["domains", domainId]                           → Domain
["progress", domainId]                          → Progress
["weeks", weekNumber]                           → WeekPlan
["days", weekNumber, dayOfWeek]                 → DayContent
["questions", questionId]                       → Question
["questions_by_day", dayContentId, sequence]    → questionId
["answers", answerId]                           → Answer
["answers_by_question", questionId]             → answerId
["feedback", feedbackId]                        → Feedback
["feedback_by_answer", answerId]                → feedbackId
["retention", domainId]                         → RetentionSchedule
```

Secondary indexes via dubbele writes voor efficiente queries.

---

## 6. Niet-functionele beslissingen

| Beslissing     | Keuze                    | Rationale                                                |
| -------------- | ------------------------ | -------------------------------------------------------- |
| Runtime        | Deno + Fresh             | Native TypeScript, Deno Deploy hosting, Deno KV storage  |
| Auth           | Simpele bearer token     | Single-user systeem, geen complexe auth nodig            |
| MCP transport  | SSE (Server-Sent Events) | Standaard MCP transport, werkt met Claude connectors     |
| Content format | Markdown                 | Universeel, renderbaar in Fresh, leesbaar als plain text |
| API style      | REST + RFC 9457          | Bekend terrein, Zalando-compatible                       |
| Timezone       | Europe/Amsterdam         | Alle timestamps UTC, display in lokale tijd              |

---

## 7. Open vragen

1. **Notificaties**: push notifications in de app vs. alleen email via Gmail
   connector?
2. **Multi-device**: alleen browser of ook mobile-optimized?
3. **Export**: wil je periodieke exports van je voortgang (bijv. als markdown of
   JSON)?
4. **Versioning**: moeten we content-versies bijhouden (als de AI iets
   hergenerereert)?

## Consequences

- De web app kan volledig onafhankelijk van Claude worden gebouwd en getest
- Een andere AI kan dezelfde MCP server gebruiken zonder app-wijzigingen
- Alle data is auditeerbaar en exporteerbaar
- De scheduled task cadans is het enige wat Claude-specifiek is
