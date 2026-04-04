import { Head } from "fresh/runtime";
import { define } from "../utils.ts";

export default define.page(async function TodayView(ctx) {
  const { repos, config } = ctx.state;
  const { schedule } = config.learner;

  const today = await repos.days.getToday(schedule.active_days, schedule.day_plan);

  if (!today) {
    const dayOfWeek = new Date().getDay();
    const isRestDay = dayOfWeek === schedule.rest_day;

    return (
      <div style="max-width: 960px; margin: 0 auto; padding: 2rem 1rem;">
        <Head>
          <title>Vandaag</title>
        </Head>
        <a href="/" style="color: #3b82f6; font-size: 0.875rem;">← Dashboard</a>
        <h1 style="font-size: 1.75rem; font-weight: 700; margin-top: 0.5rem;">Vandaag</h1>
        <p style="color: #6b7280; margin-top: 1rem;">
          {isRestDay
            ? "Rustdag. De AI bereidt de volgende week voor."
            : "Nog geen content voor vandaag. De AI genereert dit om " + schedule.generation_time + "."}
        </p>
      </div>
    );
  }

  const questions = await repos.questions.getByDay(today.id);
  const questionsWithAnswers = await Promise.all(
    questions.map(async (q) => {
      const answer = await repos.answers.getByQuestion(q.id);
      const feedback = answer
        ? await repos.feedback.getByAnswer(answer.id)
        : null;
      return { question: q, answer, feedback };
    }),
  );

  const domain = config.curriculum.domains.find((d) => d.id === today.domainId);

  return (
    <div style="max-width: 960px; margin: 0 auto; padding: 2rem 1rem;">
      <Head>
        <title>{today.title}</title>
      </Head>

      <a href="/" style="color: #3b82f6; font-size: 0.875rem;">← Dashboard</a>

      <h1 style="font-size: 1.75rem; font-weight: 700; margin-top: 0.5rem;">
        {today.title}
      </h1>
      <p style="color: #6b7280; margin-bottom: 1.5rem;">
        {domain?.name ?? today.domainId} — Dag {today.dayOfWeek}
      </p>

      {/* Content body */}
      <section style="padding: 1.5rem; background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; margin-bottom: 1.5rem; white-space: pre-wrap; font-size: 0.875rem; line-height: 1.75;">
        {today.body}
      </section>

      {/* Questions */}
      {questionsWithAnswers.length > 0 && (
        <section>
          <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem;">
            Vragen ({questionsWithAnswers.length})
          </h2>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            {questionsWithAnswers.map(({ question, answer, feedback }) => (
              <div
                key={question.id}
                style="padding: 1rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; background: white;"
              >
                <div style="font-weight: 600; font-size: 0.875rem; margin-bottom: 0.5rem;">
                  Vraag {question.sequence}: {question.type}
                </div>
                <p style="font-size: 0.875rem; white-space: pre-wrap; margin-bottom: 0.75rem;">
                  {question.body}
                </p>

                {answer
                  ? (
                    <div style="padding: 0.75rem; background: #f0fdf4; border-radius: 0.375rem; font-size: 0.875rem; margin-bottom: 0.5rem;">
                      <strong>Antwoord:</strong> {answer.body}
                    </div>
                  )
                  : (
                    <div style="padding: 0.75rem; background: #fef3c7; border-radius: 0.375rem; font-size: 0.75rem; color: #92400e;">
                      Nog niet beantwoord
                    </div>
                  )}

                {feedback && (
                  <div
                    style={`padding: 0.75rem; border-radius: 0.375rem; font-size: 0.875rem; background: ${
                      feedback.score === "correct"
                        ? "#f0fdf4"
                        : feedback.score === "partial"
                        ? "#fef9c3"
                        : "#fef2f2"
                    };`}
                  >
                    <strong>
                      Feedback ({feedback.score}):
                    </strong>{" "}
                    {feedback.explanation}
                    {feedback.improvements.length > 0 && (
                      <ul style="margin-top: 0.5rem; padding-left: 1.25rem;">
                        {feedback.improvements.map((imp, i) => (
                          <li key={i} style="font-size: 0.8125rem;">
                            {imp}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
});
