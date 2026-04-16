import type { IntakeMessage, IntakePhase, IntakeSession } from "../types.ts";
import type { IntakeRepository } from "../repositories.ts";

export class KvIntakeRepository implements IntakeRepository {
  constructor(private kv: Deno.Kv) {}

  async getSession(): Promise<IntakeSession | null> {
    const result = await this.kv.get<IntakeSession>(["intake"]);
    return result.value;
  }

  async putSession(session: IntakeSession): Promise<void> {
    await this.kv.set(["intake"], session);
  }

  async addMessage(
    msg: { role: "agent" | "learner"; content: string; phase: IntakePhase },
  ): Promise<IntakeMessage> {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const message: IntakeMessage = {
      id,
      role: msg.role,
      content: msg.content,
      timestamp,
      phase: msg.phase,
    };

    await this.kv.set(["intake_messages", timestamp, id], message);
    return message;
  }

  async getMessages(since?: string): Promise<IntakeMessage[]> {
    const messages: IntakeMessage[] = [];
    const prefix = since
      ? ["intake_messages", since]
      : ["intake_messages"];

    const iter = this.kv.list<IntakeMessage>({ prefix });
    for await (const entry of iter) {
      // When using `since`, skip the exact match (we want messages after it)
      if (since && entry.value.timestamp === since) continue;
      messages.push(entry.value);
    }

    return messages;
  }
}
