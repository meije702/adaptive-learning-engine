import type { InteractionLogRepository } from "../repositories.ts";

export class KvInteractionLogRepository implements InteractionLogRepository {
  constructor(private kv: Deno.Kv) {}

  async get(dayContentId: string): Promise<unknown | null> {
    const result = await this.kv.get(["interaction_logs", dayContentId]);
    return result.value;
  }

  async put(dayContentId: string, log: unknown): Promise<void> {
    await this.kv.set(["interaction_logs", dayContentId], log);
  }
}
