import { Head } from "fresh/runtime";
import { define } from "../../../utils.ts";

const DAY_LABELS: Record<string, string> = {
  theory: "Theorie",
  practice_guided: "Praktijk (begeleid)",
  practice_open: "Praktijk (open)",
  practice_troubleshoot: "Troubleshoot",
  assessment: "Assessment",
  review: "Review",
  retention: "Retentie",
};

export default define.page(async function WeekView(ctx) {
  const weekNumber = Number(ctx.params.weekNumber);
  const { repos, config } = ctx.state;

  const plan = await repos.weeks.get(weekNumber);
  const days = await repos.days.getByWeek(weekNumber);
  const domain = config.curriculum.domains.find(
    (d) => d.id === plan?.domainId,
  );

  if (!plan) {
    return (
      <div style="max-width: 960px; margin: 0 auto; padding: 2rem 1rem;">
        <Head>
          <title>Week {weekNumber} — Niet gevonden</title>
        </Head>
        <h1 style="font-size: 1.75rem; font-weight: 700;">
          Week {weekNumber}
        </h1>
        <p style="color: #6b7280; margin-top: 1rem;">
          Geen weekplan gevonden.{" "}
          <a href="/" style="color: #3b82f6;">Terug naar dashboard</a>
        </p>
      </div>
    );
  }

  // Build day details with question/answer counts
  const dayDetails = await Promise.all(
    days.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(async (day) => {
      const questions = await repos.questions.getByDay(day.id);
      let answered = 0;
      for (const q of questions) {
        const answer = await repos.answers.getByQuestion(q.id);
        if (answer) answered++;
      }
      return { day, questionCount: questions.length, answeredCount: answered };
    }),
  );

  return (
    <div style="max-width: 960px; margin: 0 auto; padding: 2rem 1rem;">
      <Head>
        <title>
          Week {weekNumber}: {domain?.name ?? plan.domainId}
        </title>
      </Head>

      <a href="/" style="color: #3b82f6; font-size: 0.875rem;">
        ← Dashboard
      </a>

      <h1 style="font-size: 1.75rem; font-weight: 700; margin-top: 0.5rem;">
        Week {weekNumber}: {domain?.name ?? plan.domainId}
      </h1>
      <p style="color: #6b7280; margin-bottom: 1.5rem;">{plan.summary}</p>

      {/* Bridge */}
      {domain?.bridge && (
        <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: #f9fafb; border-radius: 0.5rem; margin-bottom: 1.5rem;">
          <div style="flex: 1; padding: 0.75rem; background: white; border-radius: 0.375rem; border: 1px solid #e5e7eb;">
            <div style="font-weight: 600; font-size: 0.875rem;">
              {domain.bridge.from?.label ?? "Blank slate"}
            </div>
          </div>
          <span style="font-size: 1.5rem; color: #9ca3af;">→</span>
          <div style="flex: 1; padding: 0.75rem; background: white; border-radius: 0.375rem; border: 1px solid #e5e7eb;">
            <div style="font-weight: 600; font-size: 0.875rem;">
              {domain.bridge.to.label}
            </div>
          </div>
        </div>
      )}

      {/* Days */}
      <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem;">
        Dagprogramma
      </h2>
      {dayDetails.length === 0
        ? (
          <p style="color: #9ca3af;">
            Nog geen dagcontent gegenereerd voor deze week.
          </p>
        )
        : (
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            {dayDetails.map(({ day, questionCount, answeredCount }) => (
              <a
                key={day.id}
                href={`/day/${day.id}`}
                style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; background: white; text-decoration: none; color: inherit; transition: border-color 0.15s;"
              >
                <div>
                  <div style="font-weight: 600; font-size: 0.875rem;">
                    Dag {day.dayOfWeek}: {day.title}
                  </div>
                  <div style="font-size: 0.75rem; color: #6b7280;">
                    {DAY_LABELS[day.type] ?? day.type}
                  </div>
                </div>
                <div style="text-align: right; font-size: 0.75rem; color: #6b7280;">
                  {questionCount > 0
                    ? `${answeredCount}/${questionCount} beantwoord`
                    : "Geen vragen"}
                </div>
              </a>
            ))}
          </div>
        )}

      {/* Retrospective */}
      {plan.retrospective && (
        <section style="margin-top: 1.5rem; padding: 1rem; background: #f0fdf4; border-radius: 0.5rem; border: 1px solid #bbf7d0;">
          <h2 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem;">
            Retrospective
          </h2>
          <p style="font-size: 0.875rem; color: #374151;">
            {plan.retrospective}
          </p>
        </section>
      )}
    </div>
  );
});
