import type { Feedback } from "../types.ts";
import type { CreateFeedback, FeedbackRepository } from "../repositories.ts";

export class KvFeedbackRepository implements FeedbackRepository {
  constructor(private kv: Deno.Kv) {}

  async getByAnswer(answerId: string): Promise<Feedback | null> {
    const ref = await this.kv.get<string>(["feedback_by_answer", answerId]);
    if (!ref.value) return null;
    const result = await this.kv.get<Feedback>(["feedback", ref.value]);
    return result.value;
  }

  async get(feedbackId: string): Promise<Feedback | null> {
    const result = await this.kv.get<Feedback>(["feedback", feedbackId]);
    return result.value;
  }

  async getRecent(since: string): Promise<Feedback[]> {
    const results: Feedback[] = [];
    const iter = this.kv.list<string>({
      prefix: ["feedback_by_time"],
      start: ["feedback_by_time", since],
    });
    for await (const entry of iter) {
      const feedbackId = entry.value;
      const fb = await this.kv.get<Feedback>(["feedback", feedbackId]);
      if (fb.value) results.push(fb.value);
    }
    return results;
  }

  async create(input: CreateFeedback): Promise<Feedback> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const feedback: Feedback = {
      id,
      answerId: input.answerId,
      questionId: input.questionId,
      score: input.score,
      explanation: input.explanation,
      suggestedLevel: input.suggestedLevel,
      levelApplied: input.levelApplied,
      improvements: input.improvements,
      feedUp: input.feedUp,
      feedBack: input.feedBack,
      feedForward: input.feedForward,
      feedbackLevel: input.feedbackLevel,
      createdAt: now,
    };

    const atomic = this.kv.atomic();
    atomic.set(["feedback", id], feedback);
    atomic.set(["feedback_by_answer", input.answerId], id);
    atomic.set(["feedback_by_time", now, id], id);
    await atomic.commit();

    return feedback;
  }
}
