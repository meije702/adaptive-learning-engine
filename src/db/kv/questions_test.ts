import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { createTestKv } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

describe("KvQuestionRepository", () => {
  let kv: Deno.Kv;
  let repos: Repositories;
  let dayContentId: string;

  beforeEach(async () => {
    const t = await createTestKv();
    kv = t.kv;
    repos = t.repos;

    // Create a day to link questions to
    const day = await repos.days.create({
      weekNumber: 1,
      dayOfWeek: 1,
      type: "theory",
      domainId: "domain-a",
      title: "Theory Day",
      body: "Theory content",
    });
    dayContentId = day.id;
  });

  afterEach(() => {
    kv.close();
  });

  describe("create batch", () => {
    it("should create multiple questions and return them with generated ids", async () => {
      const questions = await repos.questions.create([
        {
          dayContentId,
          domainId: "domain-a",
          sequence: 1,
          type: "scenario",
          body: "Given a pod that keeps crashing, what would you check first?",
          maxLevel: 3,
          deadline: new Date(Date.now() + 86400000).toISOString(),
        },
        {
          dayContentId,
          domainId: "domain-a",
          sequence: 2,
          type: "open",
          body: "Explain the difference between a Deployment and a StatefulSet.",
          maxLevel: 4,
          deadline: new Date(Date.now() + 86400000).toISOString(),
        },
      ]);

      assertEquals(questions.length, 2);
      assertNotEquals(questions[0].id, undefined);
      assertNotEquals(questions[1].id, undefined);
      assertNotEquals(questions[0].id, questions[1].id);
      assertEquals(questions[0].sequence, 1);
      assertEquals(questions[1].sequence, 2);
    });
  });

  describe("getByDay", () => {
    it("should return all questions for a given day content id", async () => {
      await repos.questions.create([
        {
          dayContentId,
          domainId: "domain-a",
          sequence: 1,
          type: "open",
          body: "Question 1",
          maxLevel: 2,
          deadline: new Date(Date.now() + 86400000).toISOString(),
        },
        {
          dayContentId,
          domainId: "domain-a",
          sequence: 2,
          type: "open",
          body: "Question 2",
          maxLevel: 3,
          deadline: new Date(Date.now() + 86400000).toISOString(),
        },
      ]);

      const questions = await repos.questions.getByDay(dayContentId);
      assertEquals(questions.length, 2);
    });

    it("should return an empty array for a day with no questions", async () => {
      const questions = await repos.questions.getByDay("nonexistent-day");
      assertEquals(questions.length, 0);
    });
  });

  describe("getByCheckpoint", () => {
    it("should return a question by its scrim checkpoint", async () => {
      const [created] = await repos.questions.create([
        {
          dayContentId,
          domainId: "domain-a",
          sequence: 1,
          type: "scenario",
          body: "Complete the deployment config",
          maxLevel: 3,
          deadline: new Date(Date.now() + 86400000).toISOString(),
          scrimCheckpoint: "checkpoint-deploy-1",
        },
      ]);

      const found = await repos.questions.getByCheckpoint("checkpoint-deploy-1");
      assertNotEquals(found, null);
      assertEquals(found!.id, created.id);
      assertEquals(found!.scrimCheckpoint, "checkpoint-deploy-1");
    });

    it("should return null for a non-existent checkpoint", async () => {
      const result = await repos.questions.getByCheckpoint("no-such-checkpoint");
      assertEquals(result, null);
    });
  });

  describe("getPending", () => {
    it("should return questions that have no answers", async () => {
      const questions = await repos.questions.create([
        {
          dayContentId,
          domainId: "domain-a",
          sequence: 1,
          type: "open",
          body: "Unanswered question",
          maxLevel: 2,
          deadline: new Date(Date.now() + 86400000).toISOString(),
        },
      ]);

      const pending = await repos.questions.getPending();
      assertEquals(pending.length, 1);
      assertEquals(pending[0].id, questions[0].id);
    });

    it("should not return questions that have been answered", async () => {
      const [question] = await repos.questions.create([
        {
          dayContentId,
          domainId: "domain-a",
          sequence: 1,
          type: "open",
          body: "Answered question",
          maxLevel: 2,
          deadline: new Date(Date.now() + 86400000).toISOString(),
        },
      ]);

      // Create an answer for this question
      await repos.answers.create({
        questionId: question.id,
        body: "My answer",
      });

      const pending = await repos.questions.getPending();
      assertEquals(pending.length, 0);
    });
  });

  describe("metacognitiveType preservation", () => {
    it("should store and return the metacognitiveType field", async () => {
      const [forethought] = await repos.questions.create([
        {
          dayContentId,
          domainId: "domain-a",
          sequence: 1,
          type: "open",
          body: "What is your goal for this session?",
          maxLevel: 2,
          deadline: new Date(Date.now() + 86400000).toISOString(),
          metacognitiveType: "forethought",
        },
      ]);

      assertEquals(forethought.metacognitiveType, "forethought");

      // Verify persistence through get
      const fetched = await repos.questions.get(forethought.id);
      assertNotEquals(fetched, null);
      assertEquals(fetched!.metacognitiveType, "forethought");
    });

    it("should allow questions without a metacognitiveType", async () => {
      const [plain] = await repos.questions.create([
        {
          dayContentId,
          domainId: "domain-a",
          sequence: 1,
          type: "scenario",
          body: "A regular question",
          maxLevel: 3,
          deadline: new Date(Date.now() + 86400000).toISOString(),
        },
      ]);

      assertEquals(plain.metacognitiveType, undefined);
    });
  });
});
