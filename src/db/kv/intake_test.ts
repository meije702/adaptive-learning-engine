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
    it("should return only messages created after the since timestamp", async () => {
      const first = await repos.intake.addMessage({
        role: "agent",
        content: "First message",
        phase: "goal_validation",
      });

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));

      const second = await repos.intake.addMessage({
        role: "learner",
        content: "Second message",
        phase: "goal_validation",
      });

      // since = first message's timestamp should return only second
      const messages = await repos.intake.getMessages(first.timestamp);
      assertEquals(messages.length, 1);
      assertEquals(messages[0].content, "Second message");
      assertEquals(messages[0].id, second.id);
    });

    it("should return empty array when no messages exist after since", async () => {
      const msg = await repos.intake.addMessage({
        role: "agent",
        content: "Only message",
        phase: "goal_validation",
      });

      const messages = await repos.intake.getMessages(msg.timestamp);
      assertEquals(messages.length, 0);
    });

    it("should not return the message at the exact since timestamp", async () => {
      const msg = await repos.intake.addMessage({
        role: "agent",
        content: "At cursor",
        phase: "goal_validation",
      });

      const result = await repos.intake.getMessages(msg.timestamp);
      // The cursor message itself must not be returned
      for (const m of result) {
        assertNotEquals(m.id, msg.id);
      }
    });
  });
});
