import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import ScrimPlayer from "../islands/ScrimPlayer.tsx";
import AnswerForm from "../islands/AnswerForm.tsx";
import { FeedbackCard } from "../components/FeedbackCard.tsx";

export default define.page(async function TodayView(ctx) {
  const { repos, config } = ctx.state;
  const { schedule } = config.learner;

  // Respect pause: show nothing when paused
  const learnerState = await repos.learnerState.get();
  if (learnerState?.wellbeing?.status === "paused") {
    return (
      <div style="max-width: 960px; margin: 0 auto; padding: 2rem 1rem;">
        <Head>
          <title>Vandaag</title>
        </Head>
        <h1 style="font-size: 1.75rem; font-weight: 700; margin-top: 0.5rem;">
          Vandaag
        </h1>
        <div style="padding: 1.5rem; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 0.5rem; margin-top: 1rem; color: #0c4a6e;">
          <strong>Leertraject gepauzeerd.</strong>{" "}
          Er is geen content gepland. Neem de tijd die je nodig hebt.
        </div>
      </div>
    );
  }

  const today = await repos.days.getToday(
    schedule.active_days,
    schedule.day_plan,
  );

  if (!today) {
    const dayOfWeek = new Date().getDay();
    const isRestDay = dayOfWeek === schedule.rest_day;

    return (
      <div style="max-width: 960px; margin: 0 auto; padding: 2rem 1rem;">
        <Head>
          <title>Vandaag</title>
        </Head>
        <h1 style="font-size: 1.75rem; font-weight: 700; margin-top: 0.5rem;">
          Vandaag
        </h1>
        <p style="color: #6b7280; margin-top: 1rem;">
          {isRestDay
            ? "Rustdag. De AI bereidt de volgende week voor."
            : "Nog geen content voor vandaag. De AI genereert dit om " +
              schedule.generation_time + "."}
        </p>
      </div>
    );
  }

  // Feedback visibility gating: on assessment days, don't show feedback before the configured time
  const now = new Date();
  const feedbackDay = schedule.feedback_available_day;
  const feedbackTime = schedule.feedback_available_time;
  const isAssessmentDay = today.type === "assessment";
  let feedbackVisible = true;
  if (isAssessmentDay && feedbackDay !== undefined && feedbackTime) {
    const currentDay = now.getDay();
    if (
      currentDay < feedbackDay ||
      (currentDay === feedbackDay &&
        now.toTimeString().slice(0, 5) < feedbackTime)
    ) {
      feedbackVisible = false;
    }
  }

  const questions = await repos.questions.getByDay(today.id);
  const questionsWithAnswers = await Promise.all(
    questions.map(async (q) => {
      const answer = await repos.answers.getByQuestion(q.id);
      const feedback = (answer && feedbackVisible)
        ? await repos.feedback.getByAnswer(answer.id)
        : null;
      return { question: q, answer, feedback };
    }),
  );

  const domain = config.curriculum.domains.find((d) => d.id === today.domainId);

  // Load interaction log for Scrim replay
  const interactionLog = today.sceneDocument
    ? await repos.interactionLogs.get(today.id)
    : null;

  return (
    <div style="max-width: 960px; margin: 0 auto; padding: 2rem 1rem;">
      <Head>
        <title>{today.title}</title>
      </Head>

      <h1 style="font-size: 1.75rem; font-weight: 700; margin-top: 0.5rem;">
        {today.title}
      </h1>
      <p style="color: #6b7280; margin-bottom: 1.5rem;">
        {domain?.name ?? today.domainId} — Dag {today.dayOfWeek}
      </p>

      {/* Content body */}
      {today.sceneDocument
        ? (
          <section style="margin-bottom: 1.5rem;">
            <ScrimPlayer
              sceneDocument={today.sceneDocument}
              interactionLog={interactionLog ?? undefined}
              dayContentId={today.id}
            />
          </section>
        )
        : (
          <section style="padding: 1.5rem; background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; margin-bottom: 1.5rem; white-space: pre-wrap; font-size: 0.875rem; line-height: 1.75;">
            {today.body}
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

                {/* Multiple choice options display */}
                {question.options && answer && (
                  <div style="margin-bottom: 0.5rem;">
                    {question.options.map((opt) => (
                      <div
                        key={opt.key}
                        style={`padding: 0.375rem 0.625rem; font-size: 0.8125rem; ${
                          answer.body === opt.key
                            ? "font-weight: 600;"
                            : "color: #6b7280;"
                        }`}
                      >
                        {opt.key}. {opt.text}
                        {answer.body === opt.key ? " ✓" : ""}
                      </div>
                    ))}
                  </div>
                )}

                {answer
                  ? (
                    !question.options && (
                      <div style="padding: 0.75rem; background: #f0fdf4; border-radius: 0.375rem; font-size: 0.875rem; margin-bottom: 0.5rem;">
                        <strong>Antwoord:</strong> {answer.body}
                      </div>
                    )
                  )
                  : (
                    <AnswerForm
                      questionId={question.id}
                      questionType={question.type}
                      options={question.options?.map((o) => ({
                        key: o.key,
                        text: o.text,
                      }))}
                    />
                  )}

                {feedback && <FeedbackCard feedback={feedback} />}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
});
