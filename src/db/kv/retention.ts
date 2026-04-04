import type { RetentionSchedule } from "../types.ts";
import type { RetentionRepository } from "../repositories.ts";

export class KvRetentionRepository implements RetentionRepository {
  private config = {
    initialIntervalDays: 1,
    multiplierCorrect: 2.5,
    multiplierPartial: 1.2,
    multiplierIncorrect: 0,
    maxIntervalDays: 60,
  };

  constructor(
    private kv: Deno.Kv,
    retentionConfig?: {
      initial_interval_days: number;
      multiplier_correct: number;
      multiplier_partial: number;
      multiplier_incorrect: number;
      max_interval_days: number;
    },
  ) {
    if (retentionConfig) {
      this.config = {
        initialIntervalDays: retentionConfig.initial_interval_days,
        multiplierCorrect: retentionConfig.multiplier_correct,
        multiplierPartial: retentionConfig.multiplier_partial,
        multiplierIncorrect: retentionConfig.multiplier_incorrect,
        maxIntervalDays: retentionConfig.max_interval_days,
      };
    }
  }

  async getAll(): Promise<RetentionSchedule[]> {
    const results: RetentionSchedule[] = [];
    const iter = this.kv.list<RetentionSchedule>({ prefix: ["retention"] });
    for await (const entry of iter) {
      results.push(entry.value);
    }
    return results;
  }

  async getDue(): Promise<RetentionSchedule[]> {
    const now = new Date().toISOString();
    const all = await this.getAll();
    return all.filter((r) => r.nextDue <= now);
  }

  async get(domainId: string): Promise<RetentionSchedule | null> {
    const result = await this.kv.get<RetentionSchedule>([
      "retention",
      domainId,
    ]);
    return result.value;
  }

  async put(
    domainId: string,
    result: "correct" | "partial" | "incorrect",
  ): Promise<RetentionSchedule> {
    const existing = await this.kv.get<RetentionSchedule>([
      "retention",
      domainId,
    ]);

    const current = existing.value ?? {
      domainId,
      nextDue: new Date().toISOString(),
      interval: this.config.initialIntervalDays,
      streak: 0,
      lastResult: "incorrect" as const,
    };

    let newInterval: number;
    let newStreak: number;

    switch (result) {
      case "correct":
        newInterval = Math.min(
          Math.round(current.interval * this.config.multiplierCorrect),
          this.config.maxIntervalDays,
        );
        newStreak = current.streak + 1;
        break;
      case "partial":
        newInterval = Math.round(
          current.interval * this.config.multiplierPartial,
        );
        newStreak = 0;
        break;
      case "incorrect":
        newInterval = this.config.initialIntervalDays;
        newStreak = 0;
        break;
    }

    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + newInterval);

    const updated: RetentionSchedule = {
      domainId,
      nextDue: nextDue.toISOString(),
      interval: newInterval,
      streak: newStreak,
      lastResult: result,
    };

    await this.kv.set(["retention", domainId], updated);
    return updated;
  }
}
