import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assertNotEquals } from "@std/assert";
import { createTestKv } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

describe("KvAnswerRepository", () => {
  let kv: Deno.Kv;
  let repos: Repositories;
  let questionId: string;

  beforeEach(async () => {
    const t = await createTestKv();
    kv = t.kv;
    repos = t.repos;

    // Create a day and question to link answers to
    const day = await repos.days.create({
      weekNumber: 1,
      dayOfWeek: 1,
      type: "theory",
      domainId: "domain-a",
      title: "Day 1",
      body: "Content",
    });

    const [question] = await repos.questions.create([
      {
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 1,
        type: "open",
        body: "Explain containers",
        maxLevel: 3,
        deadline: new Date(Date.now() + 86400000).toISOString(),
      },
    ]);
    questionId = question.id;
  });

  afterEach(() => {
    kv.close();
  });

  describe("create", () => {
    it("should create an answer with generated id and submittedAt", async () => {
      const answer = await repos.answers.create({
        questionId,
        body: "Containers are isolated processes...",
      });

      assertNotEquals(answer.id, undefined);
      assertEquals(answer.questionId, questionId);
      assertEquals(answer.body, "Containers are isolated processes...");
      assertNotEquals(answer.submittedAt, undefined);
    });
  });

  describe("getByQuestion", () => {
    it("should return null when no answer exists for the question", async () => {
      const result = await repos.answers.getByQuestion(questionId);
      assertEquals(result, null);
    });

    it("should return the answer for a given question", async () => {
      await repos.answers.create({
        questionId,
        body: "My answer",
      });

      const fetched = await repos.answers.getByQuestion(questionId);
      assertNotEquals(fetched, null);
      assertEquals(fetched!.questionId, questionId);
      assertEquals(fetched!.body, "My answer");
    });
  });

  describe("getRecent", () => {
    it("should return answers submitted after the given timestamp", async () => {
      const before = new Date(Date.now() - 1000).toISOString();

      await repos.answers.create({
        questionId,
        body: "Recent answer",
      });

      const recent = await repos.answers.getRecent(before);
      assertEquals(recent.length, 1);
      assertEquals(recent[0].body, "Recent answer");
    });

    it("should return an empty array when no answers exist after the timestamp", async () => {
      await repos.answers.create({
        questionId,
        body: "Old answer",
      });

      // Use a future timestamp
      const future = new Date(Date.now() + 60000).toISOString();
      const recent = await repos.answers.getRecent(future);
      assertEquals(recent.length, 0);
    });
  });

  describe("timeSpentSeconds", () => {
    it("should persist timeSpentSeconds when provided", async () => {
      const answer = await repos.answers.create({
        questionId,
        body: "Thoughtful answer",
        timeSpentSeconds: 245,
      });

      assertEquals(answer.timeSpentSeconds, 245);

      const fetched = await repos.answers.get(answer.id);
      assertNotEquals(fetched, null);
      assertEquals(fetched!.timeSpentSeconds, 245);
    });

    it("should leave timeSpentSeconds undefined when not provided", async () => {
      const answer = await repos.answers.create({
        questionId,
        body: "Quick answer",
      });

      assertEquals(answer.timeSpentSeconds, undefined);
    });
  });
});
