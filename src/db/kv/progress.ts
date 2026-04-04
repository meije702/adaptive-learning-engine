import type { Progress } from "../types.ts";
import type { ProgressRepository, ProgressUpdate } from "../repositories.ts";

export class KvProgressRepository implements ProgressRepository {
  constructor(private kv: Deno.Kv) {}

  async getAll(): Promise<Progress[]> {
    const results: Progress[] = [];
    const iter = this.kv.list<Progress>({ prefix: ["progress"] });
    for await (const entry of iter) {
      results.push(entry.value);
    }
    return results;
  }

  async get(domainId: string): Promise<Progress | null> {
    const result = await this.kv.get<Progress>(["progress", domainId]);
    return result.value;
  }

  async put(domainId: string, update: ProgressUpdate): Promise<Progress> {
    const now = new Date().toISOString();
    const existing = await this.kv.get<Progress>(["progress", domainId]);

    const current = existing.value ?? {
      domainId,
      level: 0 as const,
      lastAssessedAt: now,
      assessmentCount: 0,
      history: [],
    };

    const updated: Progress = {
      ...current,
      level: update.level,
      lastAssessedAt: now,
      assessmentCount: current.assessmentCount + 1,
      history: [
        ...current.history,
        {
          level: update.level,
          assessedAt: now,
          source: update.source,
          ...(update.notes ? { notes: update.notes } : {}),
        },
      ],
    };

    await this.kv.set(["progress", domainId], updated);
    return updated;
  }
}
