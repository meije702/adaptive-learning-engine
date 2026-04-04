import { define } from "../../../utils.ts";
import { jsonResponse } from "../../../api/helpers.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const { repos, config } = ctx.state;

    const [progress, weeks, pending, retentionDue] = await Promise.all([
      repos.progress.getAll(),
      repos.weeks.getAll(),
      repos.questions.getPending(),
      repos.retention.getDue(),
    ]);

    const currentWeek = weeks.length > 0
      ? Math.max(...weeks.map((w) => w.weekNumber))
      : 0;

    const totalDomains = config.curriculum.domains.length;
    const domainsStarted = progress.filter((p) => p.level > 0).length;
    const avgLevel = progress.length > 0
      ? progress.reduce((sum, p) => sum + p.level, 0) / progress.length
      : 0;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const dayPlan = config.learner.schedule.day_plan;
    const todayType = dayPlan[String(dayOfWeek)] ?? null;

    const summary = {
      currentWeek,
      overallProgress: {
        totalDomains,
        domainsStarted,
        averageLevel: Math.round(avgLevel * 10) / 10,
      },
      activeDomains: progress
        .filter((p) => p.level > 0)
        .map((p) => ({ domainId: p.domainId, level: p.level })),
      pendingQuestions: pending.length,
      retentionDue: retentionDue.length,
      todayType,
    };

    return jsonResponse(summary);
  },
});
