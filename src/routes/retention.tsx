import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import AnswerForm from "../islands/AnswerForm.tsx";

export default define.page(async function RetentionPage(ctx) {
  const { repos, config } = ctx.state;

  const due = await repos.retention.getDue();
  const allSchedules = await repos.retention.getAll();

  // Find pending retention questions (questions from retention-type days that haven't been answered)
  const pendingQuestions = await repos.questions.getPending();
  const retentionQuestions = [];

  for (const q of pendingQuestions) {
    // Check if this is a retention-related question by looking up its day type
    const day = await repos.days.getById(q.dayContentId);
    if (day?.type === "retention") {
      retentionQuestions.push(q);
    }
  }

  const domainMap = new Map(
    config.curriculum.domains.map((d) => [d.id, d.name]),
  );

  return (
    <div style="max-width: 960px; margin: 0 auto; padding: 2rem 1rem;">
      <Head>
        <title>Retentie — Spaced Repetition</title>
      </Head>

      <h1 style="font-size: 1.75rem; font-weight: 700; margin-top: 0.5rem;">
        Retentie
      </h1>
      <p style="color: #6b7280; margin-bottom: 1.5rem;">
        Spaced repetition houdt kennis actief. Beantwoord de vragen hieronder om
        je geheugen te versterken.
      </p>

      {/* Pending retention questions */}
      {retentionQuestions.length > 0 && (
        <section style="margin-bottom: 2rem;">
          <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem;">
            Open retentievragen ({retentionQuestions.length})
          </h2>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            {retentionQuestions.map((q) => (
              <div
                key={q.id}
                style="padding: 1rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; background: white;"
              >
                <div style="font-size: 0.75rem; color: #6b7280; margin-bottom: 0.375rem;">
                  {domainMap.get(q.domainId) ?? q.domainId}
                </div>
                <p style="font-size: 0.875rem; white-space: pre-wrap; margin-bottom: 0.75rem;">
                  {q.body}
                </p>
                <AnswerForm
                  questionId={q.id}
                  questionType={q.type}
                  options={q.options?.map((o) => ({
                    key: o.key,
                    text: o.text,
                  }))}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Due domains */}
      <section style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem;">
          Domeinen die herhaling nodig hebben ({due.length})
        </h2>
        {due.length === 0
          ? (
            <p style="color: #9ca3af; font-size: 0.875rem;">
              Geen domeinen hoeven vandaag herhaald te worden. Goed bijgehouden!
            </p>
          )
          : (
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              {due.map((r) => (
                <div
                  key={r.domainId}
                  style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border: 1px solid #fde68a; border-radius: 0.375rem; background: #fffbeb;"
                >
                  <div>
                    <div style="font-weight: 600; font-size: 0.875rem;">
                      {domainMap.get(r.domainId) ?? r.domainId}
                    </div>
                    <div style="font-size: 0.75rem; color: #6b7280;">
                      Streak: {r.streak} — Laatste: {r.lastResult}
                    </div>
                  </div>
                  <div style="font-size: 0.75rem; color: #92400e;">
                    Due
                  </div>
                </div>
              ))}
            </div>
          )}
      </section>

      {/* All schedules overview */}
      <section>
        <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem;">
          Alle retentieschema's
        </h2>
        <div style="display: flex; flex-direction: column; gap: 0.375rem;">
          {allSchedules
            .sort((a, b) => a.nextDue.localeCompare(b.nextDue))
            .map((r) => {
              const isDue = new Date(r.nextDue) <= new Date();
              return (
                <div
                  key={r.domainId}
                  style={`display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; border-radius: 0.375rem; font-size: 0.8125rem; ${
                    isDue ? "background: #fffbeb;" : "background: #f9fafb;"
                  }`}
                >
                  <span>{domainMap.get(r.domainId) ?? r.domainId}</span>
                  <span style="color: #6b7280;">
                    {isDue ? "Nu" : `over ${r.interval}d`} — streak {r.streak}
                  </span>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
});
