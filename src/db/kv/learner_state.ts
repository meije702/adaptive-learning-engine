import type { LearnerState } from "../types.ts";
import type { LearnerStateRepository } from "../repositories.ts";

export class KvLearnerStateRepository implements LearnerStateRepository {
  constructor(private kv: Deno.Kv) {}

  async get(): Promise<LearnerState | null> {
    const result = await this.kv.get<LearnerState>(["learner_state"]);
    return result.value;
  }

  async put(state: LearnerState): Promise<void> {
    await this.kv.set(["learner_state"], state);
  }
}
