import { Head } from "fresh/runtime";
import { define } from "../../utils.ts";
import ScrimPlayer from "../../islands/ScrimPlayer.tsx";
import AnswerForm from "../../islands/AnswerForm.tsx";

export default define.page(async function DayView(ctx) {
  const { repos, config } = ctx.state;
  const { dayId } = ctx.params;

  const day = await repos.days.getById(dayId);
  if (!day) {
    return (
      <div style="max-width: 960px; margin: 0 auto; padding: 2rem 1rem;">
        <Head><title>Dag niet gevonden</title></Head>
        <h1 style="font-size: 1.75rem; font-weight: 700;">Dag niet gevonden</h1>
        <p style="color: #6b7280; margin-top: 1rem;">
          <a href="/" style="color: #3b82f6;">Terug naar dashboard</a>
        </p>
      </div>
    );
  }

  const questions = await repos.questions.getByDay(day.id);
  const questionsWithAnswers = await Promise.all(
    questions.map(async (q) => {
      const answer = await repos.answers.getByQuestion(q.id);
      const feedback = answer
        ? await repos.feedback.getByAnswer(answer.id)
        : null;
      return { question: q, answer, feedback };
    }),
  );

  const domain = config.curriculum.domains.find((d) => d.id === day.domainId);
  const interactionLog = day.sceneDocument
    ? await repos.interactionLogs.get(day.id)
    : null;

  return (
    <div style="max-width: 960px; margin: 0 auto; padding: 2rem 1rem;">
      <Head>
        <title>{day.title}</title>
      </Head>

      <a href={`/week/${day.weekNumber}`} style="color: #3b82f6; font-size: 0.875rem;">
        ← Week {day.weekNumber}
      </a>

      <h1 style="font-size: 1.75rem; font-weight: 700; margin-top: 0.5rem;">
        {day.title}
      </h1>
      <p style="color: #6b7280; margin-bottom: 1.5rem;">
        {domain?.name ?? day.domainId} — Week {day.weekNumber}, Dag {day.dayOfWeek}
      </p>

      {/* Content body */}
      {day.sceneDocument ? (
        <section style="margin-bottom: 1.5rem;">
          <ScrimPlayer
            sceneDocument={day.sceneDocument}
            interactionLog={interactionLog ?? undefined}
            dayContentId={day.id}
          />
        </section>
      ) : (
        <section style="padding: 1.5rem; background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; margin-bottom: 1.5rem; white-space: pre-wrap; font-size: 0.875rem; line-height: 1.75;">
          {day.body}
        </section>
      )}

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
                  Vraag {question.sequence}
                  <span style="font-weight: 400; color: #6b7280; margin-left: 0.5rem;">
                    {question.type}
                  </span>
                </div>
                <p style="font-size: 0.875rem; white-space: pre-wrap; margin-bottom: 0.75rem;">
                  {question.body}
                </p>

                {question.options && answer && (
                  <div style="margin-bottom: 0.5rem;">
                    {question.options.map((opt) => (
                      <div
                        key={opt.key}
                        style={`padding: 0.375rem 0.625rem; font-size: 0.8125rem; ${answer.body === opt.key ? "font-weight: 600;" : "color: #6b7280;"}`}
                      >
                        {opt.key}. {opt.text}{answer.body === opt.key ? " ✓" : ""}
                      </div>
                    ))}
                  </div>
                )}

                {answer
                  ? (!question.options && (
                      <div style="padding: 0.75rem; background: #f0fdf4; border-radius: 0.375rem; font-size: 0.875rem; margin-bottom: 0.5rem;">
                        <strong>Antwoord:</strong> {answer.body}
                      </div>
                    ))
                  : (
                    <AnswerForm
                      questionId={question.id}
                      questionType={question.type}
                      options={question.options?.map((o) => ({ key: o.key, text: o.text }))}
                    />
                  )}

                {feedback && (
                  <div
                    style={`padding: 0.75rem; border-radius: 0.375rem; font-size: 0.875rem; margin-top: 0.5rem; background: ${
                      feedback.score === "correct" ? "#f0fdf4"
                      : feedback.score === "partial" ? "#fef9c3"
                      : "#fef2f2"
                    };`}
                  >
                    <strong>Feedback ({feedback.score}):</strong>{" "}
                    {feedback.explanation}
                    {feedback.improvements.length > 0 && (
                      <ul style="margin-top: 0.5rem; padding-left: 1.25rem;">
                        {feedback.improvements.map((imp, i) => (
                          <li key={i} style="font-size: 0.8125rem;">{imp}</li>
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
