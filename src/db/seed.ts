import type { CurriculumConfig } from "../config/schemas/index.ts";
import type { SystemConfig } from "../config/schemas/index.ts";
import type { Progress, RetentionSchedule } from "./types.ts";

export async function seedDomains(
  kv: Deno.Kv,
  curriculum: CurriculumConfig,
  system: SystemConfig,
): Promise<void> {
  const now = new Date().toISOString();
  const allDomainIds = [
    ...curriculum.domains.map((d) => d.id),
    ...curriculum.stretch.domains.map((d) => d.id),
  ];

  for (const domainId of allDomainIds) {
    const progressKey = ["progress", domainId];
    const retentionKey = ["retention", domainId];

    const [existingProgress, existingRetention] = await Promise.all([
      kv.get<Progress>(progressKey),
      kv.get<RetentionSchedule>(retentionKey),
    ]);

    const atomic = kv.atomic();

    if (existingProgress.value === null) {
      const progress: Progress = {
        domainId,
        level: 0,
        lastAssessedAt: now,
        assessmentCount: 0,
        history: [],
      };
      atomic.check(existingProgress).set(progressKey, progress);
    }

    if (existingRetention.value === null) {
      const retention: RetentionSchedule = {
        domainId,
        nextDue: now,
        interval: system.retention.initial_interval_days,
        streak: 0,
        lastResult: "incorrect",
      };
      atomic.check(existingRetention).set(retentionKey, retention);
    }

    await atomic.commit();
  }
}
