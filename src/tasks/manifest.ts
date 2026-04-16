/**
 * Scheduled task manifest — defines what the AI agent should do and when.
 *
 * ALE itself does not run a scheduler. This manifest describes the tasks
 * and their timing so external schedulers (Deno.cron, GitHub Actions,
 * Claude Code scheduled tasks) can trigger the agent at the right times.
 *
 * The `get_scheduled_tasks` MCP tool exposes this manifest so the agent
 * knows what's expected of it.
 */

export interface ScheduledTask {
  id: string;
  description: string;
  trigger: string;
  mcpTools: string[];
  instructions: string;
}

export const SCHEDULED_TASKS: ScheduledTask[] = [
  {
    id: "generate-daily-content",
    description: "Generate next day's content after evaluating today's answers",
    trigger: "daily at learner.schedule.generation_time",
    mcpTools: [
      "get_dashboard",
      "get_recent_answers",
      "create_feedback",
      "get_gap_analysis",
      "create_day_content",
      "create_questions",
    ],
    instructions: `1. Call get_dashboard to see the current state.
2. Call get_recent_answers to find unevaluated answers.
3. Evaluate each answer with create_feedback (use three-component structure).
4. Call get_gap_analysis to check if trajectory adjustments are needed.
5. Generate tomorrow's SceneDocument based on the day type from the schedule.
6. Call create_day_content with body + sceneDocument.
7. Call create_questions for each challenge, linking scrimCheckpoint.
8. Respect cognitive_budget and scaffolding_profile.`,
  },
  {
    id: "weekly-retrospective",
    description:
      "Write week retrospective and create next week's plan on rest day",
    trigger: "weekly on learner.schedule.rest_day",
    mcpTools: [
      "get_week_overview",
      "get_gap_analysis",
      "recalculate_gaps",
      "add_retrospective",
      "create_week_plan",
      "create_day_content",
      "create_questions",
    ],
    instructions: `1. Call get_week_overview for the current week.
2. Call recalculate_gaps to compare trajectory against intake estimate.
3. Write a retrospective via add_retrospective.
4. Determine next week's domain from curriculum sequence.
5. Create the week plan via create_week_plan.
6. Generate Monday's theory content (SceneDocument) via create_day_content.
7. Create linked questions via create_questions.`,
  },
  {
    id: "generate-retention-questions",
    description: "Generate daily retention questions from due domains",
    trigger: "daily on learner.schedule.retention.days",
    mcpTools: [
      "get_retention_due",
      "create_day_content",
      "create_questions",
    ],
    instructions: `1. Call get_retention_due to find domains needing review.
2. Select min_domains_per_session domains for interleaving.
3. Generate retention questions (plain text, no SceneDocument needed).
4. Create a retention-type day content and questions.
5. Respect questions_per_day min/max from retention config.`,
  },
];
