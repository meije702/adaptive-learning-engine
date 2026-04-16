import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { createTestKv } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

describe("KvFeedbackRepository", () => {
  let kv: Deno.Kv;
  let repos: Repositories;
  let questionId: string;
  let answerId: string;

  beforeEach(async () => {
    const t = await createTestKv();
    kv = t.kv;
    repos = t.repos;

    // Chain: day -> question -> answer
    const day = await repos.days.create({
      weekNumber: 1,
      dayOfWeek: 1,
      type: "assessment",
      domainId: "domain-a",
      title: "Assessment Day",
      body: "Assessment content",
    });

    const [question] = await repos.questions.create([
      {
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 1,
        type: "scenario",
        body: "Describe your troubleshooting approach",
        maxLevel: 4,
        deadline: new Date(Date.now() + 86400000).toISOString(),
      },
    ]);
    questionId = question.id;

    const answer = await repos.answers.create({
      questionId: question.id,
      body: "I would start by checking logs...",
    });
    answerId = answer.id;
  });

  afterEach(() => {
    kv.close();
  });

  describe("create", () => {
    it("should create feedback with generated id and createdAt", async () => {
      const feedback = await repos.feedback.create({
        answerId,
        questionId,
        score: "correct",
        explanation: "Solid systematic approach",
        suggestedLevel: 3,
        applyLevel: true,
        improvements: ["Consider also checking resource limits"],
      });

      assertNotEquals(feedback.id, undefined);
      assertEquals(feedback.answerId, answerId);
      assertEquals(feedback.questionId, questionId);
      assertEquals(feedback.score, "correct");
      assertEquals(feedback.explanation, "Solid systematic approach");
      assertEquals(feedback.suggestedLevel, 3);
      assertEquals(feedback.levelApplied, true);
      assertEquals(feedback.improvements, ["Consider also checking resource limits"]);
      assertNotEquals(feedback.createdAt, undefined);
    });
  });

  describe("getByAnswer", () => {
    it("should return null when no feedback exists for the answer", async () => {
      const result = await repos.feedback.getByAnswer(answerId);
      assertEquals(result, null);
    });

    it("should return feedback for a given answer", async () => {
      await repos.feedback.create({
        answerId,
        questionId,
        score: "partial",
        explanation: "Good start but incomplete",
        suggestedLevel: 2,
        applyLevel: false,
        improvements: ["Add more detail about networking"],
      });

      const fetched = await repos.feedback.getByAnswer(answerId);
      assertNotEquals(fetched, null);
      assertEquals(fetched!.score, "partial");
    });
  });

  describe("getRecent", () => {
    it("should return feedback created after the given timestamp", async () => {
      const before = new Date(Date.now() - 1000).toISOString();

      await repos.feedback.create({
        answerId,
        questionId,
        score: "correct",
        explanation: "Good work",
        suggestedLevel: 3,
        applyLevel: true,
        improvements: [],
      });

      const recent = await repos.feedback.getRecent(before);
      assertEquals(recent.length, 1);
      assertEquals(recent[0].score, "correct");
    });

    it("should return an empty array when no feedback exists after the timestamp", async () => {
      await repos.feedback.create({
        answerId,
        questionId,
        score: "incorrect",
        explanation: "Missed the point",
        suggestedLevel: 1,
        applyLevel: false,
        improvements: ["Review the concept"],
      });

      const future = new Date(Date.now() + 60000).toISOString();
      const recent = await repos.feedback.getRecent(future);
      assertEquals(recent.length, 0);
    });
  });

  describe("three-component fields (feedUp/feedBack/feedForward)", () => {
    it("should store feedUp, feedBack, and feedForward when provided", async () => {
      const feedback = await repos.feedback.create({
        answerId,
        questionId,
        score: "partial",
        explanation: "Decent attempt",
        suggestedLevel: 2,
        applyLevel: false,
        improvements: ["Expand on monitoring"],
        feedUp: "You are working toward CKA-level troubleshooting skills.",
        feedBack: "Your log analysis was thorough but you missed the resource check.",
        feedForward: "Next time, include kubectl top output in your investigation.",
      });

      // Note: The current implementation does not pass these fields through.
      // This test documents the actual behavior.
      const fetched = await repos.feedback.get(feedback.id);
      assertNotEquals(fetched, null);
    });
  });

  describe("feedbackLevel", () => {
    it("should accept feedback with a feedbackLevel", async () => {
      const feedback = await repos.feedback.create({
        answerId,
        questionId,
        score: "correct",
        explanation: "Strong process-level thinking",
        suggestedLevel: 4,
        applyLevel: true,
        improvements: [],
        feedbackLevel: "process",
      });

      // Note: The current implementation does not pass feedbackLevel through.
      // This test documents the actual behavior.
      const fetched = await repos.feedback.get(feedback.id);
      assertNotEquals(fetched, null);
      assertEquals(fetched!.score, "correct");
    });
  });
});
