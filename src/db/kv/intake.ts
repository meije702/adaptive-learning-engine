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

    // Use start with a key after the since timestamp to exclude it and
    // everything before it. The \uffff suffix ensures we skip all entries
    // at the since timestamp (regardless of message id).
    const selector = since
      ? {
        prefix: ["intake_messages"] as Deno.KvKey,
        start: ["intake_messages", since, "\uffff"] as Deno.KvKey,
      }
      : { prefix: ["intake_messages"] as Deno.KvKey };

    const iter = this.kv.list<IntakeMessage>(selector);
    for await (const entry of iter) {
      messages.push(entry.value);
    }

    return messages;
  }
}
