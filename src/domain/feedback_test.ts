import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assertNotEquals } from "@std/assert";
import { createTestKv } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";
import { recordFeedbackAndProgress } from "./feedback.ts";

describe("recordFeedbackAndProgress", () => {
  let kv: Deno.Kv;
  let repos: Repositories;

  beforeEach(async () => {
    const t = await createTestKv();
    kv = t.kv;
    repos = t.repos;
  });

  afterEach(() => kv.close());

  async function seedQuestionAndAnswer() {
    const [question] = await repos.questions.create([{
      dayContentId: "day-1",
      domainId: "domain-a",
      sequence: 1,
      type: "open",
      body: "What is K8s?",
      maxLevel: 4,
      deadline: new Date(Date.now() + 86400000).toISOString(),
    }]);
    const answer = await repos.answers.create({
      questionId: question.id,
      body: "A container orchestrator",
    });
    return { question, answer };
  }

  it("persists the feedback record", async () => {
    const { question, answer } = await seedQuestionAndAnswer();

    const fb = await recordFeedbackAndProgress(repos, {
      answerId: answer.id,
      questionId: question.id,
      score: "partial",
      explanation: "close",
      suggestedLevel: 2,
      applyLevel: false,
      improvements: ["add detail"],
    });

    assertNotEquals(fb.id, undefined);
    const fetched = await repos.feedback.getByAnswer(answer.id);
    assertEquals(fetched?.score, "partial");
  });

  it("does NOT update progress when applyLevel is false", async () => {
    const { question, answer } = await seedQuestionAndAnswer();

    await recordFeedbackAndProgress(repos, {
      answerId: answer.id,
      questionId: question.id,
      score: "correct",
      explanation: "ok",
      suggestedLevel: 4,
      applyLevel: false,
      improvements: [],
    });

    const progress = await repos.progress.get("domain-a");
    assertEquals(progress, null);
  });

  it("updates progress on the question's DOMAIN (not questionId) when applyLevel", async () => {
    const { question, answer } = await seedQuestionAndAnswer();

    await recordFeedbackAndProgress(repos, {
      answerId: answer.id,
      questionId: question.id,
      score: "correct",
      explanation: "solid",
      suggestedLevel: 4,
      applyLevel: true,
      improvements: [],
    });

    const byDomain = await repos.progress.get("domain-a");
    assertEquals(byDomain?.level, 4);
    assertEquals(byDomain?.history[0].source, "assessment");

    // Critical: must NOT have written to progress keyed on questionId.
    const byQuestion = await repos.progress.get(question.id);
    assertEquals(byQuestion, null);
  });
});
