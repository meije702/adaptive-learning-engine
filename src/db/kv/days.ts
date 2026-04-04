import type { DayContent } from "../types.ts";
import type { CreateDayContent, DayRepository } from "../repositories.ts";

export class KvDayRepository implements DayRepository {
  constructor(private kv: Deno.Kv) {}

  async getByWeek(weekNumber: number): Promise<DayContent[]> {
    const results: DayContent[] = [];
    const iter = this.kv.list<DayContent>({ prefix: ["days", weekNumber] });
    for await (const entry of iter) {
      results.push(entry.value);
    }
    return results;
  }

  async get(
    weekNumber: number,
    dayOfWeek: number,
  ): Promise<DayContent | null> {
    const result = await this.kv.get<DayContent>([
      "days",
      weekNumber,
      dayOfWeek,
    ]);
    return result.value;
  }

  async getById(id: string): Promise<DayContent | null> {
    const result = await this.kv.get<DayContent>(["days_by_id", id]);
    return result.value;
  }

  async getToday(
    activeDays: number[],
    _dayPlan: Record<string, string>,
  ): Promise<DayContent | null> {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, etc.
    if (!activeDays.includes(dayOfWeek)) return null;

    // Find the current week's content for today
    // Iterate weeks in reverse to find the latest
    const weeks: number[] = [];
    const iter = this.kv.list<unknown>({ prefix: ["weeks"] });
    for await (const entry of iter) {
      weeks.push(entry.key[1] as number);
    }
    if (weeks.length === 0) return null;

    const currentWeek = Math.max(...weeks);
    return this.get(currentWeek, dayOfWeek);
  }

  async create(content: CreateDayContent): Promise<DayContent> {
    const id = crypto.randomUUID();
    const dayContent: DayContent = {
      ...content,
      id,
      createdAt: new Date().toISOString(),
    };

    const atomic = this.kv.atomic();
    atomic.set(["days", content.weekNumber, content.dayOfWeek], dayContent);
    atomic.set(["days_by_id", id], dayContent);
    await atomic.commit();

    return dayContent;
  }
}
