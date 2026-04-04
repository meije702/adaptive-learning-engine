import type { Answer } from "../types.ts";
import type { AnswerRepository, CreateAnswer } from "../repositories.ts";

export class KvAnswerRepository implements AnswerRepository {
  constructor(private kv: Deno.Kv) {}

  async getByQuestion(questionId: string): Promise<Answer | null> {
    const ref = await this.kv.get<string>([
      "answers_by_question",
      questionId,
    ]);
    if (!ref.value) return null;
    const result = await this.kv.get<Answer>(["answers", ref.value]);
    return result.value;
  }

  async get(answerId: string): Promise<Answer | null> {
    const result = await this.kv.get<Answer>(["answers", answerId]);
    return result.value;
  }

  async getRecent(since: string): Promise<Answer[]> {
    const results: Answer[] = [];
    const iter = this.kv.list<string>({
      prefix: ["answers_by_time"],
      start: ["answers_by_time", since],
    });
    for await (const entry of iter) {
      const answerId = entry.value;
      const answer = await this.kv.get<Answer>(["answers", answerId]);
      if (answer.value) results.push(answer.value);
    }
    return results;
  }

  async create(input: CreateAnswer): Promise<Answer> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const answer: Answer = {
      ...input,
      id,
      submittedAt: now,
    };

    const atomic = this.kv.atomic();
    atomic.set(["answers", id], answer);
    atomic.set(["answers_by_question", input.questionId], id);
    atomic.set(["answers_by_time", now, id], id);
    await atomic.commit();

    return answer;
  }
}
