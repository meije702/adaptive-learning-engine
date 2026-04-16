# ADR-003: Bridge als kernprincipe & intake-fase

**Status:** Proposed **Date:** 2026-04-03 **Author:** Sander + Claude
**Extends:** ADR-001, ADR-002

## Context

De `bridge` structuur in ADR-002 was gedefinieerd als metadata op een domein:
een statische mapping van bestaande kennis naar nieuwe kennis. Bij nadere
analyse is de bridge niet slechts metadata — het is het fundamentele
leerprincipe van het hele systeem.

Elke stap in het leerproces is een transformatie van een `from`-state naar een
`to`-state. Dit geldt op elk niveau: curriculum, fase, domein, week, dag. Het
systeem moet dit patroon consistent toepassen en in staat zijn om te werken met
lege `from`-states (blank slate) en met onevenredig grote gaps.

Daarnaast ontbreekt er een intake-fase: een moment waarop het systeem de
haalbaarheid van het traject beoordeelt en adviseert voordat de cursus begint.

## Decision

### 1. Bridge is een first-class concept op elk niveau

```typescript
/**
 * Een Bridge beschrijft een transformatie van een bekende state naar
 * een gewenste state. Het is het kernprincipe van het leersysteem.
 *
 * - `from` kan leeg zijn (blank slate)
 * - `to` is altijd gedefinieerd
 * - `gap` wordt berekend door het systeem of de AI
 * - `strategy` wordt bepaald door de AI op basis van de gap
 */
interface Bridge {
  from: BridgeState | null; // null = blank slate
  to: BridgeState;
  gap: GapAssessment; // door AI ingevuld tijdens intake
  strategy: LearningStrategy; // door AI bepaald op basis van gap
}

interface BridgeState {
  label: string; // menselijk leesbaar
  concepts: string[]; // kernconcepten in deze state
  proficiency: "none" | "beginner" | "intermediate" | "advanced" | "expert";
}

interface GapAssessment {
  size: "small" | "moderate" | "large" | "very_large";
  estimated_weeks: number; // AI-schatting
  risk_factors: string[]; // bijv. "geen netwerk-ervaring"
  accelerators: string[]; // bijv. "sterke IaC-achtergrond"
  feasible: boolean; // is dit traject haalbaar in de geplande tijd?
  recommendation?: string; // AI-advies als feasible=false
}

type LearningStrategy =
  | "analogy" // from is sterk → bouw voort op analogieën
  | "first_principles" // from is leeg → bouw op vanaf de basis
  | "contrast" // from is verwant maar anders → vergelijk
  | "scaffolded" // gap is groot → bouw tussenstappen in
  | "accelerated"; // from is sterk én verwant → snel doorpakken
```

### 2. Bridges in de configuratie (herzien)

De curriculum config krijgt bridges op meerdere niveaus:

```yaml
# ── Curriculum-level bridge ─────────────────
# De grote transformatie van het hele traject.
bridge:
  from:
    label: "AWS serverless specialist"
    concepts: ["Lambda", "API Gateway", "CDK", "DynamoDB", "EventBridge"]
    proficiency: "expert"
  to:
    label: "K8s & hybrid cloud engineer"
    concepts: ["Kubernetes", "containers", "hybrid cloud", "CKA"]
    proficiency: "advanced"

# ── Phase-level bridges ─────────────────────
phases:
  - id: 1
    name: "Fundamenten"
    bridge:
      from:
        label: "Kent cloud-native concepten in AWS"
        concepts: ["managed services", "serverless", "IaC"]
        proficiency: "expert"
      to:
        label: "Begrijpt container-orchestratie fundamenten"
        concepts: ["containers", "pods", "control plane", "services"]
        proficiency: "intermediate"

  - id: 2
    name: "Productie-skills"
    bridge:
      from:
        label: "Begrijpt K8s fundamenten"
        concepts: ["pods", "deployments", "services"]
        proficiency: "intermediate"
      to:
        label: "Kan workloads veilig in productie draaien"
        concepts: ["RBAC", "storage", "ingress", "helm"]
        proficiency: "advanced"

# ── Domain-level bridges (zoals eerder, maar met volledige structuur) ──
domains:
  - id: "container-fundamentals"
    bridge:
      from:
        label: "Lambda functions"
        concepts: ["function as deployment unit", "managed runtime"]
        proficiency: "expert"
      to:
        label: "Containers & Pods"
        concepts: ["OCI images", "container runtime", "pod lifecycle"]
        proficiency: "intermediate"
```

### 3. Blank slate support

Wanneer `from` leeg is:

```yaml
# Voorbeeld: iemand zonder cloud-ervaring die K8s wil leren
bridge:
  from: null # blank slate
  to:
    label: "K8s & hybrid cloud engineer"
    concepts: ["Kubernetes", "containers", "hybrid cloud"]
    proficiency: "advanced"
```

Het systeem reageert hierop:

1. De AI detecteert `from: null` en schakelt over op `first_principles` strategy
2. Geen analogieën worden aangeboden (er is niets om mee te vergelijken)
3. Het tempo wordt lager — meer weken per fase
4. De intake-fase (zie onder) wordt extra belangrijk

### 4. Intake-fase

Voordat de cursus begint, draait er een **intake** die het traject valideert.

```yaml
# In learner.config.yaml
intake:
  completed: false # wordt true na de intake
  completed_at: null
  result: null # wordt ingevuld door de AI
```

De intake is een gestructureerd gesprek:

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTAKE FLOW                             │
│                                                                 │
│  1. PROFIEL VALIDEREN                                           │
│     AI leest learner.config.yaml                                │
│     → "Klopt het dat je achtergrond X is?"                      │
│     → Eventueel bijstellen                                      │
│                                                                 │
│  2. NULMETING                                                   │
│     AI stelt 2-3 vragen per fase om het startniveau te peilen   │
│     → Niet om te beoordelen, maar om de from-state te ijken     │
│     → Resultaat: initiële levels in de kennisgraaf              │
│                                                                 │
│  3. GAP ANALYSE                                                 │
│     AI berekent de gap per fase en voor het totaal               │
│     → Hoeveel weken is realistisch?                             │
│     → Welke fases kunnen versneld, welke hebben extra tijd?     │
│     → Zijn er missende prerequisites?                           │
│                                                                 │
│  4. ADVIES                                                      │
│     AI presenteert een eerlijke beoordeling:                    │
│                                                                 │
│     Scenario A: "Je plan is haalbaar. 16 weken past."           │
│                                                                 │
│     Scenario B: "De gap is groot. Ik zou 24 weken adviseren,    │
│                  of eerst fase 1-2 doen en dan herijken."       │
│                                                                 │
│     Scenario C: "Je mist fundamentele voorkennis in X.           │
│                  Overweeg eerst een korter traject voor X."      │
│                                                                 │
│  5. PLAN BEVESTIGEN                                             │
│     Leerling akkoord → intake.completed = true                  │
│     → Weekplanning wordt gegenereerd                            │
│     → Eerste module wordt klaargezet                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Gap-detectie tijdens het traject

De intake is niet eenmalig. Het bridge-patroon werkt ook _tijdens_ het traject:

- **Voor elke week**: de AI vergelijkt je huidige level (from) met het doel van
  de module (to). Als de gap groter is dan verwacht (bijv. je scoorde laag op
  een prerequisite), past de AI het weekplan aan.

- **Na elke assessment**: de AI herberekent de gap voor de resterende domeinen.
  Als je sneller gaat dan gepland, kan het tempo omhoog. Als je achterloopt,
  signaleert het systeem dit eerlijk.

- **Bij stretch-modules**: de gap is opzettelijk groot. Het systeem communiceert
  dit expliciet: "Dit is een stretch — het doel is blootstelling, niet
  beheersing."

### 6. MCP tools voor intake en gap-analyse

Uitbreiding op ADR-001:

```yaml
# ── Intake tools ────────────────────────────

run_intake:
  description: "Start de intake-fase. Leest configs, valideert profiel, en begint de nulmeting."
  params:
    curriculum_config: string # pad naar curriculum.config.yaml
    learner_config: string # pad naar learner.config.yaml
  returns: IntakeSession

submit_intake_answer:
  description: "Verwerk een antwoord tijdens de intake-nulmeting"
  params:
    questionId: string
    answer: string
  returns: IntakeProgress

complete_intake:
  description: "Rond de intake af, genereer gap-analyse en advies"
  returns: IntakeResult

# ── Gap analyse tools ───────────────────────

get_gap_analysis:
  description: "Haal de huidige gap-analyse op: waar staat de leerling t.o.v. het doel?"
  returns: GapAnalysis

recalculate_gaps:
  description: "Herbereken gaps na een assessment. Draai na elke vrijdag."
  params:
    weekNumber: number
  returns: GapAnalysis
```

## Consequences

- De bridge is niet langer metadata maar het kernprincipe van het hele systeem
- Elke transformatie (curriculum, fase, domein, week, dag) volgt hetzelfde
  patroon
- Blank slate leerlingen worden ondersteund met first-principles strategie
- Het systeem is eerlijk over haalbaarheid via de intake en continue gap-analyse
- De AI kiest automatisch de juiste didactische strategie op basis van de gap
- Andere curricula kunnen dezelfde bridge-structuur gebruiken ongeacht het
  onderwerp
