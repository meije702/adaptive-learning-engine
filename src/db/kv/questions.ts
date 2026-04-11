import type { Question } from "../types.ts";
import type { CreateQuestion, QuestionRepository } from "../repositories.ts";

export class KvQuestionRepository implements QuestionRepository {
  constructor(private kv: Deno.Kv) {}

  async getByDay(dayContentId: string): Promise<Question[]> {
    const results: Question[] = [];
    const iter = this.kv.list<string>({
      prefix: ["questions_by_day", dayContentId],
    });
    for await (const entry of iter) {
      const questionId = entry.value;
      const q = await this.kv.get<Question>(["questions", questionId]);
      if (q.value) results.push(q.value);
    }
    return results;
  }

  async get(questionId: string): Promise<Question | null> {
    const result = await this.kv.get<Question>(["questions", questionId]);
    return result.value;
  }

  async getByCheckpoint(checkpoint: string): Promise<Question | null> {
    const result = await this.kv.get<string>([
      "questions_by_checkpoint",
      checkpoint,
    ]);
    if (!result.value) return null;
    return this.get(result.value);
  }

  async getPending(): Promise<Question[]> {
    const pending: Question[] = [];
    const iter = this.kv.list<Question>({ prefix: ["questions"] });
    for await (const entry of iter) {
      const question = entry.value;
      const answer = await this.kv.get(["answers_by_question", question.id]);
      if (answer.value === null) {
        pending.push(question);
      }
    }
    return pending;
  }

  async create(inputs: CreateQuestion[]): Promise<Question[]> {
    const questions: Question[] = [];

    for (const input of inputs) {
      const id = crypto.randomUUID();
      const question: Question = { ...input, id };
      questions.push(question);

      const atomic = this.kv.atomic();
      atomic.set(["questions", id], question);
      atomic.set(
        ["questions_by_day", input.dayContentId, input.sequence],
        id,
      );
      if (input.scrimCheckpoint) {
        atomic.set(["questions_by_checkpoint", input.scrimCheckpoint], id);
      }
      await atomic.commit();
    }

    return questions;
  }
}
