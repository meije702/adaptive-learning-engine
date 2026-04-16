import type { CalibrationEntry } from "../types.ts";
import type { CalibrationRepository } from "../repositories.ts";

export class KvCalibrationRepository implements CalibrationRepository {
  constructor(private kv: Deno.Kv) {}

  async getByDomain(domainId: string): Promise<CalibrationEntry[]> {
    const results: CalibrationEntry[] = [];
    const iter = this.kv.list<CalibrationEntry>({
      prefix: ["calibration_by_domain", domainId],
    });
    for await (const entry of iter) {
      results.push(entry.value);
    }
    return results;
  }

  async getRecent(limit: number): Promise<CalibrationEntry[]> {
    const results: CalibrationEntry[] = [];
    const iter = this.kv.list<CalibrationEntry>({
      prefix: ["calibration"],
    });
    for await (const entry of iter) {
      results.push(entry.value);
    }
    // KV list is ordered by key; sort by createdAt desc and take limit
    return results
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async create(
    input: Omit<CalibrationEntry, "id" | "createdAt">,
  ): Promise<CalibrationEntry> {
    const id = crypto.randomUUID();
    const entry: CalibrationEntry = {
      ...input,
      id,
      createdAt: new Date().toISOString(),
    };

    const atomic = this.kv.atomic();
    atomic.set(["calibration", id], entry);
    atomic.set(
      ["calibration_by_domain", input.domainId, id],
      entry,
    );
    await atomic.commit();

    return entry;
  }

  async getSummary(): Promise<
    { domainId: string; avgDelta: number; count: number }[]
  > {
    const byDomain = new Map<string, number[]>();
    const iter = this.kv.list<CalibrationEntry>({
      prefix: ["calibration"],
    });
    for await (const entry of iter) {
      const e = entry.value;
      const deltas = byDomain.get(e.domainId) ?? [];
      deltas.push(e.delta);
      byDomain.set(e.domainId, deltas);
    }

    return Array.from(byDomain.entries()).map(([domainId, deltas]) => ({
      domainId,
      avgDelta: deltas.reduce((s, d) => s + d, 0) / deltas.length,
      count: deltas.length,
    }));
  }
}
