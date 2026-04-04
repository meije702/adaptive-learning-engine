import type { WeekPlan } from "../types.ts";
import type { CreateWeekPlan, WeekRepository } from "../repositories.ts";

export class KvWeekRepository implements WeekRepository {
  constructor(private kv: Deno.Kv) {}

  async getAll(): Promise<WeekPlan[]> {
    const results: WeekPlan[] = [];
    const iter = this.kv.list<WeekPlan>({ prefix: ["weeks"] });
    for await (const entry of iter) {
      results.push(entry.value);
    }
    return results;
  }

  async get(weekNumber: number): Promise<WeekPlan | null> {
    const result = await this.kv.get<WeekPlan>(["weeks", weekNumber]);
    return result.value;
  }

  async create(plan: CreateWeekPlan): Promise<WeekPlan> {
    const weekPlan: WeekPlan = {
      ...plan,
      createdAt: new Date().toISOString(),
    };
    await this.kv.set(["weeks", plan.weekNumber], weekPlan);
    return weekPlan;
  }

  async addRetrospective(
    weekNumber: number,
    text: string,
  ): Promise<WeekPlan> {
    const existing = await this.kv.get<WeekPlan>(["weeks", weekNumber]);
    if (!existing.value) {
      throw new Error(`WeekPlan ${weekNumber} not found`);
    }
    const updated: WeekPlan = { ...existing.value, retrospective: text };
    await this.kv.set(["weeks", weekNumber], updated);
    return updated;
  }
}
