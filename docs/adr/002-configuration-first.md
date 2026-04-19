# ADR-002: Configuration-First Design

**Status:** Proposed **Date:** 2026-04-03 **Author:** Sander + Claude
**Supersedes:** Hardcoded values in ADR-001

## Context

Het systeem moet open-source deelbaar zijn zodat anderen hun eigen leertraject
kunnen opzetten. Dit betekent dat alle domein-specifieke, persoonlijke, en
operationele keuzes in configuratie moeten leven — niet in code.

Iemand die Rust wil leren vanuit een Java-achtergrond, of cybersecurity vanuit
een netwerk-achtergrond, moet hetzelfde platform kunnen gebruiken door alleen
configuratiebestanden aan te passen.

## Decision

**Alles wat varieert tussen leertrajecten leeft in config. Code is generiek.**

Drie configuratiebestanden:

| Bestand                  | Beschrijving                                               | Wie beheert het              |
| ------------------------ | ---------------------------------------------------------- | ---------------------------- |
| `curriculum.config.yaml` | Het leertraject: domeinen, fases, volgorde, bruggen        | De ontwerper van het traject |
| `learner.config.yaml`    | Het profiel: achtergrond, planning, voorkeuren             | De leerling                  |
| `system.config.yaml`     | Technische instellingen: AI, scheduling, spaced repetition | De beheerder                 |

---

## 1. curriculum.config.yaml

Definieert _wat_ er geleerd wordt.

```yaml
# ──────────────────────────────────────────────
# Curriculum Configuration
# ──────────────────────────────────────────────

meta:
  id: "k8s-hybrid-cloud"
  name: "Kubernetes & Hybrid Cloud"
  version: "1.0.0"
  description: "Van serverless specialist naar K8s & hybrid cloud engineer"
  target_certification: "CKA" # optioneel
  estimated_weeks: 16
  language: "nl" # primaire taal van gegenereerde content

# ── Competentieniveaus ──────────────────────
# Aanpasbaar per curriculum. Min 3, max 7.
levels:
  - id: 0
    label: "Onbekend"
    description: "Nog niet behandeld"
    assessment_type: null

  - id: 1
    label: "Conceptueel"
    description: "Kan uitleggen wat het is en waarom het bestaat"
    assessment_type: "theory"

  - id: 2
    label: "Begrip"
    description: "Kan relateren aan bestaande kennis"
    assessment_type: "comparison"

  - id: 3
    label: "Toepassing"
    description: "Kan configureren met begeleiding"
    assessment_type: "guided_practice"

  - id: 4
    label: "Zelfstandig"
    description: "Kan zelfstandig opzetten en troubleshooten"
    assessment_type: "open_scenario"

  - id: 5
    label: "Expert"
    description: "Kan in productie ontwerpen en aan anderen uitleggen"
    assessment_type: "architecture_challenge"

# ── Fases ───────────────────────────────────
phases:
  - id: 1
    name: "Fundamenten"
    description: "De basisconcepten en architectuur"

  - id: 2
    name: "Productie-skills"
    description: "Wat je nodig hebt om workloads in productie te draaien"

  - id: 3
    name: "Operations"
    description: "Beheer, monitoring, en troubleshooting"

  - id: 4
    name: "Hybrid & Certificering"
    description: "Multi-cloud architectuur en examenvoorbereiding"

# ── Domeinen ────────────────────────────────
# Elk domein is één leermodule, typisch één week.
domains:
  - id: "container-fundamentals"
    name: "Container fundamentals"
    phase: 1
    week: 1
    tags: ["docker", "oci", "runtime", "images", "layers"]
    prerequisites: []
    bridge:
      from: "Lambda functions"
      to: "Pods"
      explanation: "Beide zijn de kleinste eenheid van deployment"
    key_concepts:
      - "Container vs VM"
      - "OCI image spec"
      - "Layers en caching"
      - "Container runtime (containerd, CRI-O)"
    resources: [] # optionele links naar extern materiaal

  - id: "k8s-architecture"
    name: "K8s architecture"
    phase: 1
    week: 2
    tags: ["control-plane", "etcd", "kubelet", "api-server"]
    prerequisites: ["container-fundamentals"]
    bridge:
      from: "AWS account met managed services"
      to: "Kubernetes control plane"
      explanation: "Beide zijn de management-laag die resources orkestreert"
    key_concepts:
      - "Control plane componenten"
      - "etcd als state store"
      - "kubelet en container runtime"
      - "kube-proxy en networking basis"
    resources: []

  - id: "workloads"
    name: "Workloads & scheduling"
    phase: 1
    week: 3
    tags: [
      "pods",
      "deployments",
      "replicasets",
      "statefulsets",
      "daemonsets",
      "jobs",
    ]
    prerequisites: ["k8s-architecture"]
    bridge:
      from: "Auto Scaling Groups"
      to: "ReplicaSets & Deployments"
      explanation: "Beide beheren het gewenste aantal actieve instances"
    key_concepts:
      - "Pod lifecycle"
      - "Deployment strategieën"
      - "StatefulSet vs Deployment"
      - "Jobs en CronJobs"
    resources: []

  - id: "networking-basis"
    name: "Networking basis"
    phase: 1
    week: 4
    tags: ["services", "clusterip", "nodeport", "loadbalancer", "dns", "cni"]
    prerequisites: ["workloads"]
    bridge:
      from: "ALB + API Gateway"
      to: "Services + kube-proxy"
      explanation: "Beide routeren verkeer naar de juiste workload"
    key_concepts:
      - "Service types"
      - "kube-dns / CoreDNS"
      - "CNI plugins"
      - "Network model (flat network)"
    resources: []

  - id: "storage"
    name: "Storage"
    phase: 2
    week: 5
    tags: ["volumes", "pv", "pvc", "storageclasses", "csi"]
    prerequisites: ["workloads"]
    bridge:
      from: "EBS / EFS"
      to: "PersistentVolumes & PVCs"
      explanation: "Beide abstraheren block/file storage van de compute-laag"
    key_concepts:
      - "Volume types"
      - "PV/PVC lifecycle"
      - "StorageClasses en dynamic provisioning"
      - "CSI drivers"
    resources: []

  - id: "security"
    name: "Security & RBAC"
    phase: 2
    week: 6
    tags: [
      "rbac",
      "serviceaccounts",
      "networkpolicies",
      "podsecurity",
      "secrets",
    ]
    prerequisites: ["networking-basis"]
    bridge:
      from: "IAM policies & roles"
      to: "RBAC roles & bindings"
      explanation: "Beide definiëren wie wat mag doen op welke resources"
    key_concepts:
      - "RBAC model (Role, ClusterRole, Binding)"
      - "ServiceAccounts"
      - "NetworkPolicies"
      - "Pod Security Standards"
    resources: []

  - id: "configuration"
    name: "Config & packaging"
    phase: 2
    week: 7
    tags: ["configmaps", "secrets", "helm", "kustomize"]
    prerequisites: ["workloads", "security"]
    bridge:
      from: "SSM Parameter Store + CDK Constructs"
      to: "ConfigMaps + Helm Charts"
      explanation: "Beide scheiden configuratie van code en maken hergebruik mogelijk"
    key_concepts:
      - "ConfigMaps vs Secrets"
      - "Helm chart structuur"
      - "Kustomize overlays"
      - "GitOps-ready configuratie"
    resources: []

  - id: "ingress-traffic"
    name: "Ingress & traffic"
    phase: 2
    week: 8
    tags: ["ingress", "gateway-api", "tls", "traffic-routing"]
    prerequisites: ["networking-basis", "security"]
    bridge:
      from: "CloudFront + API Gateway routing"
      to: "Ingress controllers + Gateway API"
      explanation: "Beide beheren extern verkeer naar interne services"
    key_concepts:
      - "Ingress controllers (nginx, traefik)"
      - "Gateway API (de opvolger)"
      - "TLS termination"
      - "Path en host-based routing"
    resources: []

  - id: "observability"
    name: "Observability"
    phase: 3
    week: 9
    tags: ["prometheus", "grafana", "logging", "fluentd", "loki", "tracing"]
    prerequisites: ["workloads", "networking-basis"]
    bridge:
      from: "CloudWatch metrics + logs"
      to: "Prometheus + Grafana + Loki"
      explanation: "Beide bieden metrics, logs en dashboards maar met verschillende modellen"
    key_concepts:
      - "Prometheus scraping model"
      - "Grafana dashboards"
      - "Log aggregatie (Fluentd/Loki)"
      - "Distributed tracing basics"
    resources: []

  - id: "cicd-gitops"
    name: "CI/CD & GitOps"
    phase: 3
    week: 10
    tags: ["argocd", "flux", "github-actions", "gitops"]
    prerequisites: ["configuration"]
    bridge:
      from: "CDK Pipelines + GitHub Actions"
      to: "ArgoCD / Flux"
      explanation: "Push-based CI/CD vs pull-based GitOps"
    key_concepts:
      - "GitOps principes"
      - "ArgoCD setup en sync"
      - "Flux vs ArgoCD"
      - "Integratie met bestaande CI (GitHub Actions)"
    resources: []

  - id: "cluster-mgmt"
    name: "Cluster management"
    phase: 3
    week: 11
    tags: ["upgrades", "backup", "etcd", "node-management"]
    prerequisites: ["k8s-architecture", "security"]
    bridge:
      from: "AWS managed upgrades"
      to: "Handmatig cluster lifecycle beheer"
      explanation: "Van fully managed naar self-managed operations"
    key_concepts:
      - "Cluster upgrade strategie"
      - "etcd backup en restore"
      - "Node drain en cordon"
      - "Certificate management"
    resources: []

  - id: "troubleshooting"
    name: "Troubleshooting"
    phase: 3
    week: 12
    tags: ["debugging", "kubectl", "logs", "events", "resource-constraints"]
    prerequisites: ["workloads", "networking-basis", "observability"]
    bridge:
      from: "CloudWatch Logs + X-Ray"
      to: "kubectl debug + logs + events"
      explanation: "Andere tools, zelfde systematische aanpak"
    key_concepts:
      - "kubectl debug workflow"
      - "Pod failure modes"
      - "Networking troubleshooting"
      - "Resource constraints en OOM"
    resources: []

  - id: "multi-cloud"
    name: "Multi-cloud K8s"
    phase: 4
    week: 13
    tags: ["eks", "aks", "gke", "managed-k8s"]
    prerequisites: ["cluster-mgmt"]
    bridge:
      from: "EKS (bekend)"
      to: "AKS en GKE"
      explanation: "Zelfde K8s, andere managed service implementaties"
    key_concepts:
      - "EKS vs AKS vs GKE vergelijking"
      - "Cloud-specifieke integraties"
      - "Vendor lock-in vs portabiliteit"
      - "Cost optimization per cloud"
    resources: []

  - id: "hybrid-arch"
    name: "Hybrid architecture"
    phase: 4
    week: 14
    tags: ["multi-cluster", "federation", "service-mesh"]
    prerequisites: ["multi-cloud", "networking-basis"]
    bridge:
      from: "Multi-account AWS strategie"
      to: "Multi-cluster K8s strategie"
      explanation: "Zelfde governance-uitdagingen, ander platform"
    key_concepts:
      - "Multi-cluster patterns"
      - "Service mesh basics (Istio/Linkerd)"
      - "Federation concepts"
      - "Hybrid connectivity"
    resources: []

  - id: "iac-k8s"
    name: "IaC for K8s"
    phase: 4
    week: 15
    tags: ["terraform", "pulumi", "crossplane"]
    prerequisites: ["cluster-mgmt", "multi-cloud"]
    bridge:
      from: "AWS CDK"
      to: "Terraform / Pulumi / Crossplane"
      explanation: "CDK-achtig denken maar dan voor multi-cloud K8s infra"
    key_concepts:
      - "Terraform voor cluster provisioning"
      - "Pulumi (TypeScript, dichter bij CDK)"
      - "Crossplane (K8s-native IaC)"
      - "State management vergelijking"
    resources: []

  - id: "cka-prep"
    name: "CKA exam prep"
    phase: 4
    week: 16
    tags: ["cka", "exam", "time-management", "kubectl-mastery"]
    prerequisites: ["troubleshooting", "cluster-mgmt", "security"]
    bridge:
      from: "Alles hiervoor"
      to: "Examen-specifieke drills"
      explanation: "Kennis omzetten in snelheid en precisie onder tijdsdruk"
    key_concepts:
      - "Exam environment en regels"
      - "kubectl productivity (aliases, completions)"
      - "Tijdmanagement per vraagtype"
      - "Top failure areas"
    resources: []

# ── Stretch modules ─────────────────────────
# Optionele modules die elke N weken worden ingevoegd.
stretch:
  frequency: 4 # elke N weken
  domains:
    - id: "service-mesh-deep-dive"
      name: "Service mesh deep dive"
      tags: ["istio", "linkerd", "envoy"]
      bridge:
        from: "API Gateway patterns"
        to: "Sidecar proxy mesh"
        explanation: "Van centraal naar gedistribueerd traffic management"
      key_concepts:
        - "Sidecar pattern"
        - "mTLS automatisch"
        - "Traffic splitting"
        - "Observability via mesh"
```

---

## 2. learner.config.yaml

Definieert _wie_ er leert en _hoe_ het schema eruitziet.

```yaml
# ──────────────────────────────────────────────
# Learner Configuration
# ──────────────────────────────────────────────

profile:
  name: "Sander"
  language: "nl" # UI en interactie taal
  timezone: "Europe/Amsterdam"

# ── Bestaande kennis ────────────────────────
# De AI gebruikt dit om analogieën te maken.
background:
  summary: "Senior/Lead Engineer, 20+ jaar backend, AWS serverless specialist"
  technologies:
    - name: "AWS Lambda"
      proficiency: "expert"
    - name: "AWS CDK"
      proficiency: "expert"
    - name: "TypeScript"
      proficiency: "expert"
    - name: "GitHub Actions"
      proficiency: "advanced"
    - name: "API Gateway"
      proficiency: "expert"
    - name: "Docker"
      proficiency: "intermediate"

# ── Planning ────────────────────────────────
schedule:
  rest_day: 0 # 0=zondag, 6=zaterdag
  active_days: [1, 2, 3, 4, 5, 6] # ma t/m za

  # Wat gebeurt er op elke actieve dag?
  # day_of_week: type uit day_types
  day_plan:
    1: "theory"
    2: "practice_guided"
    3: "practice_open"
    4: "practice_troubleshoot"
    5: "assessment"
    6: "review"

  # Wanneer genereert de AI nieuwe content?
  generation_time: "22:00"

  # Assessment inleverdeadline
  assessment_deadline_day: 6 # zaterdag
  assessment_deadline_time: "20:00"

  # Feedback beschikbaar na assessment
  feedback_available_day: 6
  feedback_available_time: "22:00"

  # Retentievragen
  retention:
    enabled: true
    days: [1, 2, 3, 4, 5, 6] # elke actieve dag
    questions_per_day:
      min: 1
      max: 3

# ── Voorkeuren ──────────────────────────────
preferences:
  content_length: "concise" # "concise" | "standard" | "detailed"
  tone: "collegial" # "formal" | "collegial" | "casual"
  show_bridges: true # toon AWS ↔ K8s analogieën
  hints_enabled: true # progressieve hints bij oefeningen
  time_tracking: false # tijdregistratie bij antwoorden
```

---

## 3. system.config.yaml

Definieert _hoe_ het systeem technisch werkt.

```yaml
# ──────────────────────────────────────────────
# System Configuration
# ──────────────────────────────────────────────

server:
  port: 8000
  base_url: "https://learn.deno.dev" # production URL

auth:
  type: "bearer" # "bearer" | "none" (voor lokaal dev)
# Token wordt via environment variable gezet, niet in config

storage:
  type: "deno-kv" # "deno-kv" | "sqlite" | "postgres"

# ── AI Agent ────────────────────────────────
ai:
  provider: "anthropic" # "anthropic" | "openai" | "local"
  model: "claude-sonnet-4-20250514"
  system_prompt_template: |
    Je bent een {curriculum.meta.name} trainer voor een ervaren engineer.
    Achtergrond van de leerling: {learner.background.summary}
    Communiceer in het {learner.language}.
    Technische termen in het Engels.
    Toon: {learner.preferences.tone}.
    {if learner.preferences.show_bridges}
    Gebruik actief analogieën tussen de bestaande kennis en nieuwe concepten.
    {/if}

# ── MCP Server ──────────────────────────────
mcp:
  transport: "stdio" # only "stdio" is implemented (SSE was specced but never shipped; schema now rejects "sse")
  path: "/mcp" # endpoint path

# ── Spaced Repetition ──────────────────────
retention:
  initial_interval_days: 1
  multiplier_correct: 2.5
  multiplier_partial: 1.2
  multiplier_incorrect: 0.0 # reset naar initial
  max_interval_days: 60

# ── Content Generation ──────────────────────
content:
  # Maximale lengtes voor gegenereerde content (in woorden)
  max_length:
    theory: 600
    practice: 400
    assessment: 500
    retention_question: 50
    feedback: 300

  # Assessment configuratie
  assessment:
    question_types: ["scenario", "open", "multiple_choice", "troubleshoot"]
    options_count: 4 # bij multiple choice
    passing_score: "partial" # minimum om als voldoende te tellen

# ── Logging & Export ────────────────────────
export:
  enabled: true
  format: "json" # "json" | "markdown"
  schedule: "weekly" # "daily" | "weekly" | "manual"
```

---

## Consequences

- **Geen enkele domein-specifieke waarde staat in code** — alles komt uit config
- **Nieuwe curricula** worden gemaakt door alleen YAML-bestanden te schrijven
- **Persoonlijke voorkeuren** (rustdag, taal, toon, tijden) zijn volledig
  aanpasbaar
- **AI-provider is verwisselbaar** via `system.config.yaml`
- **Spaced repetition parameters** zijn tunebaar zonder code-wijziging
- **Open source ready** — fork, pas config aan, deploy, klaar
