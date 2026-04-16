import { Head } from "fresh/runtime";
import { define } from "../utils.ts";

const LEVEL_COLORS = [
  "#e5e7eb", // 0 - gray
  "#bfdbfe", // 1 - blue
  "#bbf7d0", // 2 - green
  "#fde68a", // 3 - yellow
  "#fdba74", // 4 - orange
  "#c4b5fd", // 5 - purple
];

const LEVEL_LABELS = [
  "Onbekend",
  "Conceptueel",
  "Begrip",
  "Toepassing",
  "Zelfstandig",
  "Expert",
];

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
        <p style="color: #6b7280;">
          {learner.profile.name} — {curriculum.meta.description}
        </p>
      </header>

      {/* Intake banner */}
      {!intakeCompleted && (
        <a
          href="/intake"
          style="display: block; padding: 1rem; margin-bottom: 1.5rem; background: #fef3c7; border: 1px solid #fde68a; border-radius: 0.5rem; color: #92400e; text-decoration: none;"
        >
          <strong>Intake vereist</strong> — Voordat het leertraject kan beginnen
          moet de intake worden doorlopen. Klik hier om te starten.
        </a>
      )}

      {/* Today CTA */}
      <a
        href="/today"
        style="display: block; padding: 1rem; margin-bottom: 1.5rem; background: #3b82f6; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600; text-align: center;"
      >
        Naar vandaag →
      </a>

      {/* Stats row */}
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
        <StatCard label="Voortgang" value={`${overallPct}%`} />
        <a href={currentWeek > 0 ? `/week/${currentWeek}` : "#"} style="text-decoration: none; color: inherit;">
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
          style="display: block; text-decoration: none; color: inherit; margin-bottom: 2rem; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 0.5rem;"
        >
          <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">
            Week {currentPlan.weekNumber}: {
              curriculum.domains.find((d) => d.id === currentPlan.domainId)
                ?.name ?? currentPlan.domainId
            }
          </h2>
          <p style="color: #4b5563;">{currentPlan.summary}</p>
        </a>
      )}

      {/* Bridge visualization */}
      <section style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">
          Curriculum Bridge
        </h2>
        <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #f9fafb; border-radius: 0.5rem;">
          <BridgeEnd
            label={curriculum.bridge.from?.label ?? "Blank slate"}
            proficiency={curriculum.bridge.from?.proficiency ?? "none"}
          />
          <span style="font-size: 1.5rem; color: #9ca3af;">→</span>
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
              <h3 style="font-size: 0.875rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
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
    <div style="padding: 1rem; background: #f9fafb; border-radius: 0.5rem; text-align: center;">
      <div style="font-size: 1.5rem; font-weight: 700;">{value}</div>
      <div style="font-size: 0.75rem; color: #6b7280;">{label}</div>
    </div>
  );
}

function BridgeEnd(
  { label, proficiency }: { label: string; proficiency: string },
) {
  return (
    <div style="flex: 1; padding: 0.75rem; background: white; border-radius: 0.375rem; border: 1px solid #e5e7eb;">
      <div style="font-weight: 600;">{label}</div>
      <div style="font-size: 0.75rem; color: #6b7280;">{proficiency}</div>
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
      style={`display: block; text-decoration: none; color: inherit; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid #e5e7eb; border-left: 4px solid ${LEVEL_COLORS[level]}; background: white;`}
    >
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.25rem;">
        <span style="font-weight: 600; font-size: 0.875rem;">{name}</span>
        <span style="font-size: 0.75rem; color: #9ca3af;">W{week}</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style={`font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 9999px; background: ${LEVEL_COLORS[level]};`}>
          {LEVEL_LABELS[level]}
        </span>
      </div>
      {fromLabel && (
        <div style="font-size: 0.6875rem; color: #9ca3af; margin-top: 0.375rem;">
          {fromLabel} → {toLabel}
        </div>
      )}
    </a>
  );
}
