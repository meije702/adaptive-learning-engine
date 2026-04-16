import type { RetentionSchedule } from "../types.ts";
import type { RetentionRepository } from "../repositories.ts";
import {
  decayAfterPause,
  initialSchedule,
  nextScheduleAfterReview,
  type RetentionConfig,
  retentionConfigFromSystem,
} from "../../domain/spaced_repetition.ts";

/**
 * Thin KV-backed repository. All scheduling math lives in
 * src/domain/spaced_repetition.ts; this class only reads and writes.
 */
export class KvRetentionRepository implements RetentionRepository {
  private config: RetentionConfig;

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
    this.config = retentionConfigFromSystem(retentionConfig);
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
    const prev = existing.value ?? initialSchedule(domainId, this.config);
    const updated = nextScheduleAfterReview(prev, result, this.config);
    await this.kv.set(["retention", domainId], updated);
    return updated;
  }

  /**
   * Recalculate all retention schedules after a pause.
   * Returns the number of schedules updated.
   */
  async recalculateAfterPause(pauseDays: number): Promise<number> {
    const all = await this.getAll();
    const now = new Date();
    let updated = 0;
    for (const schedule of all) {
      const recalculated = decayAfterPause(
        schedule,
        pauseDays,
        this.config,
        now,
      );
      await this.kv.set(["retention", schedule.domainId], recalculated);
      updated++;
    }
    return updated;
  }
}
