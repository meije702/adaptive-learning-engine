import { Head } from "fresh/runtime";
import { define } from "../utils.ts";

/**
 * Competency-level → token. 6 slots (levels 0..5). These map to existing
 * --ale-* tokens; a dedicated level-color ramp is deferred until two
 * consecutive chrome migrations ask for the same palette
 * (docs/design-system.md § Deferred).
 */
const LEVEL_TOKENS = [
  "var(--ale-color-border)", // 0 — not assessed
  "var(--ale-color-primary-light)", // 1 — conceptual
  "var(--ale-color-info)", // 2 — understanding
  "var(--ale-color-success)", // 3 — application
  "var(--ale-color-warning)", // 4 — independent
  "var(--ale-color-primary)", // 5 — expert
];

const LEVEL_LABELS = [
  "Onbekend",
  "Conceptueel",
  "Begrip",
  "Toepassing",
  "Zelfstandig",
  "Expert",
];

/** Neutral-tint surface: bg blended with a small amount of border color. */
const SURFACE_TINT =
  "color-mix(in srgb, var(--ale-color-border) 30%, var(--ale-color-bg))";

/** Status-tinted surface: status color blended into bg at low ratio. */
function statusTint(token: string): string {
  return `color-mix(in srgb, ${token} 15%, var(--ale-color-bg))`;
}

export default define.page(async function Dashboard(ctx) {
  const { repos, config } = ctx.state;
  const { curriculum, learner } = config;

  const [progress, weeks, pending, retentionDue, learnerState] = await Promise
    .all([
      repos.progress.getAll(),
      repos.weeks.getAll(),
      repos.questions.getPending(),
      repos.retention.getDue(),
      repos.learnerState.get(),
    ]);

  const intakeCompleted = learnerState?.intake?.completed ?? false;

  const progressMap = new Map(progress.map((p) => [p.domainId, p]));
  const currentWeek = weeks.length > 0
    ? Math.max(...weeks.map((w) => w.weekNumber))
    : 0;
  const currentPlan = weeks.find((w) => w.weekNumber === currentWeek);

  const totalLevels = progress.reduce((s, p) => s + p.level, 0);
  const maxLevels = progress.length * 5;
  const overallPct = maxLevels > 0
    ? Math.round((totalLevels / maxLevels) * 100)
    : 0;

  return (
    <div style="max-width: 960px; margin: 0 auto; padding: 2rem 1rem;">
      <Head>
        <title>{curriculum.meta.name} — Dashboard</title>
      </Head>

      {/* Header */}
      <header style="margin-bottom: 2rem;">
        <h1 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem;">
          {curriculum.meta.name}
        </h1>
        <p style="color: var(--ale-color-muted);">
          {learner.profile.name} — {curriculum.meta.description}
        </p>
      </header>

      {/* Intake banner */}
      {!intakeCompleted && (
        <a
          href="/intake"
          style={`display: block; padding: 1rem; margin-bottom: 1.5rem; background: ${
            statusTint("var(--ale-color-warning)")
          }; border: 1px solid var(--ale-color-warning); border-radius: var(--ale-radius); color: var(--ale-color-warning); text-decoration: none;`}
        >
          <strong>Intake vereist</strong>{" "}
          — Voordat het leertraject kan beginnen moet de intake worden
          doorlopen. Klik hier om te starten.
        </a>
      )}

      {/* Wellbeing banners */}
      {learnerState?.wellbeing?.status === "paused" && (
        <div
          style={`padding: 1rem; margin-bottom: 1.5rem; background: ${
            statusTint("var(--ale-color-info)")
          }; border: 1px solid var(--ale-color-info); border-radius: var(--ale-radius); color: var(--ale-color-info);`}
        >
          <strong>Leertraject gepauzeerd</strong>{" "}
          — Neem de tijd die je nodig hebt. Wanneer je klaar bent om terug te
          komen, laat het de AI coach weten.
        </div>
      )}
      {learnerState?.wellbeing?.status === "returning" && (
        <div
          style={`padding: 1rem; margin-bottom: 1.5rem; background: ${
            statusTint("var(--ale-color-success)")
          }; border: 1px solid var(--ale-color-success); border-radius: var(--ale-radius); color: var(--ale-color-success);`}
        >
          <strong>Welkom terug</strong>{" "}
          — We beginnen rustig. De AI coach helpt je om te herijken waar je
          gebleven was.
        </div>
      )}

      {/* Today CTA */}
      <a
        href="/today"
        style="display: block; padding: 1rem; margin-bottom: 1.5rem; background: var(--ale-color-primary); color: var(--ale-color-bg); text-decoration: none; border-radius: var(--ale-radius); font-weight: 600; text-align: center;"
      >
        Naar vandaag →
      </a>

      {/* Stats row */}
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
        <StatCard label="Voortgang" value={`${overallPct}%`} />
        <a
          href={currentWeek > 0 ? `/week/${currentWeek}` : "#"}
          style="text-decoration: none; color: inherit;"
        >
          <StatCard
            label="Huidige week"
            value={currentWeek > 0 ? `${currentWeek}` : "—"}
          />
        </a>
        <a href="/today" style="text-decoration: none; color: inherit;">
          <StatCard label="Open vragen" value={`${pending.length}`} />
        </a>
        <a href="/retention" style="text-decoration: none; color: inherit;">
          <StatCard label="Retentie due" value={`${retentionDue.length}`} />
        </a>
      </div>

      {/* Current week plan */}
      {currentPlan && (
        <a
          href={`/week/${currentPlan.weekNumber}`}
          style="display: block; text-decoration: none; color: inherit; margin-bottom: 2rem; padding: 1rem; border: 1px solid var(--ale-color-border); border-radius: var(--ale-radius);"
        >
          <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">
            Week {currentPlan.weekNumber}:{" "}
            {curriculum.domains.find((d) => d.id === currentPlan.domainId)
              ?.name ?? currentPlan.domainId}
          </h2>
          <p style="color: var(--ale-color-muted);">{currentPlan.summary}</p>
        </a>
      )}

      {/* Bridge visualization */}
      <section style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">
          Curriculum Bridge
        </h2>
        <div
          style={`display: flex; align-items: center; gap: 1rem; padding: 1rem; background: ${SURFACE_TINT}; border-radius: var(--ale-radius);`}
        >
          <BridgeEnd
            label={curriculum.bridge.from?.label ?? "Blank slate"}
            proficiency={curriculum.bridge.from?.proficiency ?? "none"}
          />
          <span style="font-size: 1.5rem; color: var(--ale-color-muted);">
            →
          </span>
          <BridgeEnd
            label={curriculum.bridge.to.label}
            proficiency={curriculum.bridge.to.proficiency}
          />
        </div>
      </section>

      {/* Knowledge graph: domains by phase */}
      <section>
        <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">
          Kennisgraaf
        </h2>
        {curriculum.phases.map((phase) => {
          const phaseDomains = curriculum.domains.filter(
            (d) => d.phase === phase.id,
          );
          return (
            <div key={phase.id} style="margin-bottom: 1.5rem;">
              <h3 style="font-size: 0.875rem; font-weight: 600; color: var(--ale-color-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                Fase {phase.id}: {phase.name}
              </h3>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem;">
                {phaseDomains.map((domain) => {
                  const p = progressMap.get(domain.id);
                  const level = p?.level ?? 0;
                  return (
                    <DomainCard
                      key={domain.id}
                      name={domain.name}
                      week={domain.week}
                      level={level}
                      fromLabel={domain.bridge.from?.label}
                      toLabel={domain.bridge.to.label}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
});

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={`padding: 1rem; background: ${SURFACE_TINT}; border-radius: var(--ale-radius); text-align: center;`}
    >
      <div style="font-size: 1.5rem; font-weight: 700;">{value}</div>
      <div style="font-size: 0.75rem; color: var(--ale-color-muted);">
        {label}
      </div>
    </div>
  );
}

function BridgeEnd(
  { label, proficiency }: { label: string; proficiency: string },
) {
  return (
    <div style="flex: 1; padding: 0.75rem; background: var(--ale-color-bg); border-radius: var(--ale-radius); border: 1px solid var(--ale-color-border);">
      <div style="font-weight: 600;">{label}</div>
      <div style="font-size: 0.75rem; color: var(--ale-color-muted);">
        {proficiency}
      </div>
    </div>
  );
}

function DomainCard(
  { name, week, level, fromLabel, toLabel }: {
    name: string;
    week: number;
    level: number;
    fromLabel?: string;
    toLabel: string;
  },
) {
  return (
    <a
      href={`/week/${week}`}
      style={`display: block; text-decoration: none; color: inherit; padding: 0.75rem; border-radius: var(--ale-radius); border: 1px solid var(--ale-color-border); border-left: 4px solid ${
        LEVEL_TOKENS[level]
      }; background: var(--ale-color-bg);`}
    >
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.25rem;">
        <span style="font-weight: 600; font-size: 0.875rem;">{name}</span>
        <span style="font-size: 0.75rem; color: var(--ale-color-muted);">
          W{week}
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span
          style={`font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 9999px; background: ${
            LEVEL_TOKENS[level]
          };`}
        >
          {LEVEL_LABELS[level]}
        </span>
      </div>
      {fromLabel && (
        <div style="font-size: 0.6875rem; color: var(--ale-color-muted); margin-top: 0.375rem;">
          {fromLabel} → {toLabel}
        </div>
      )}
    </a>
  );
}
