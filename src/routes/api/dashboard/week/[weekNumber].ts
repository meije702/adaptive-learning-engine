import { define } from "../../../../utils.ts";
import { jsonResponse } from "../../../../api/helpers.ts";
import { notFound } from "../../../../api/error.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const weekNumber = Number(ctx.params.weekNumber);
    const { repos } = ctx.state;

    const plan = await repos.weeks.get(weekNumber);
    if (!plan) {
      return notFound(
        `No week plan found for week ${weekNumber}`,
        `/api/dashboard/week/${weekNumber}`,
      );
    }

    const days = await repos.days.getByWeek(weekNumber);

    let questionCount = 0;
    let answerCount = 0;
    let totalScore = 0;
    let scoredCount = 0;

    for (const day of days) {
      const questions = await repos.questions.getByDay(day.id);
      questionCount += questions.length;

      for (const q of questions) {
        const answer = await repos.answers.getByQuestion(q.id);
        if (answer) {
          answerCount++;
          const feedback = await repos.feedback.getByAnswer(answer.id);
          if (feedback) {
            scoredCount++;
            totalScore += feedback.score === "correct"
              ? 1
              : feedback.score === "partial"
              ? 0.5
              : 0;
          }
        }
      }
    }

    return jsonResponse({
      plan,
      days,
      questionCount,
      answerCount,
      avgScore: scoredCount > 0
        ? Math.round((totalScore / scoredCount) * 100) / 100
        : null,
    });
  },
});
