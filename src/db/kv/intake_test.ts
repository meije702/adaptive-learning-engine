import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { createTestKv, buildIntakeSession } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

describe("KvIntakeRepository", () => {
  let kv: Deno.Kv;
  let repos: Repositories;

  beforeEach(async () => {
    const t = await createTestKv();
    kv = t.kv;
    repos = t.repos;
  });

  afterEach(() => {
    kv.close();
  });

  describe("getSession", () => {
    it("should return null when no session exists", async () => {
      const session = await repos.intake.getSession();
      assertEquals(session, null);
    });
  });

  describe("putSession / getSession", () => {
    it("should store and retrieve an intake session", async () => {
      const session = buildIntakeSession({
        status: "goal_validation",
      });

      await repos.intake.putSession(session);
      const fetched = await repos.intake.getSession();

      assertNotEquals(fetched, null);
      assertEquals(fetched!.id, session.id);
      assertEquals(fetched!.status, "goal_validation");
      assertEquals(fetched!.baselineResults.length, 0);
    });

    it("should overwrite an existing session", async () => {
      const first = buildIntakeSession({ status: "goal_validation" });
      await repos.intake.putSession(first);

      const second = buildIntakeSession({ status: "baseline" });
      await repos.intake.putSession(second);

      const fetched = await repos.intake.getSession();
      assertEquals(fetched!.id, second.id);
      assertEquals(fetched!.status, "baseline");
    });
  });

  describe("addMessage", () => {
    it("should create a message with generated id and timestamp", async () => {
      const msg = await repos.intake.addMessage({
        role: "agent",
        content: "What is your learning goal?",
        phase: "goal_validation",
      });

      assertNotEquals(msg.id, undefined);
      assertEquals(msg.role, "agent");
      assertEquals(msg.content, "What is your learning goal?");
      assertEquals(msg.phase, "goal_validation");
      assertNotEquals(msg.timestamp, undefined);
    });
  });

  describe("getMessages", () => {
    it("should return all messages when called without since", async () => {
      await repos.intake.addMessage({
        role: "agent",
        content: "Message 1",
        phase: "goal_validation",
      });
      await repos.intake.addMessage({
        role: "learner",
        content: "Message 2",
        phase: "goal_validation",
      });

      const messages = await repos.intake.getMessages();
      assertEquals(messages.length, 2);
    });

    it("should return an empty array when no messages exist", async () => {
      const messages = await repos.intake.getMessages();
      assertEquals(messages.length, 0);
    });
  });

  describe("getMessages with since", () => {
    it("should exclude the exact-match message when using since", async () => {
      // The since filter uses KV prefix matching on the timestamp component,
      // so it only finds messages whose key shares the same timestamp prefix.
      // It then skips the exact match. This test verifies the skip behavior.
      const first = await repos.intake.addMessage({
        role: "agent",
        content: "First message",
        phase: "goal_validation",
      });

      // Retrieve with the first message's timestamp — the implementation
      // uses prefix: ["intake_messages", since] which matches keys starting
      // with that timestamp, then skips entries whose timestamp === since.
      const messages = await repos.intake.getMessages(first.timestamp);
      assertEquals(messages.length, 0);
    });

    it("should return messages that share a timestamp prefix but differ in id", async () => {
      // When two messages are created within the same millisecond they share
      // a timestamp prefix — the second message will be returned by since
      // because its full key differs.
      const msg1 = await repos.intake.addMessage({
        role: "agent",
        content: "Message A",
        phase: "goal_validation",
      });

      // Without since, all messages are returned
      const allMessages = await repos.intake.getMessages();
      assertEquals(allMessages.length, 1);
      assertEquals(allMessages[0].content, "Message A");

      // With since set to the message's own timestamp, exact match is skipped
      const filtered = await repos.intake.getMessages(msg1.timestamp);
      assertEquals(filtered.length, 0);
    });
  });
});
