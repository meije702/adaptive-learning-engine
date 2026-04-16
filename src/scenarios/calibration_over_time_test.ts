import { assertEquals } from "jsr:@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { createTestKv } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

describe("Scenario: Calibration tracking over time", () => {
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

  it("tracks calibrated, overestimate, and underestimate deltas and computes summary", async () => {
    // Create 3 questions with answers and feedback
    const day = await repos.days.create({
      weekNumber: 1,
      dayOfWeek: 5,
      type: "assessment",
      domainId: "domain-a",
      title: "Assessment",
      body: "Assessment body",
    });

    const questions = await repos.questions.create([
      { dayContentId: day.id, domainId: "domain-a", sequence: 1, type: "open", body: "Q1?", maxLevel: 3, deadline: new Date(Date.now() + 86400000).toISOString() },
      { dayContentId: day.id, domainId: "domain-a", sequence: 2, type: "open", body: "Q2?", maxLevel: 3, deadline: new Date(Date.now() + 86400000).toISOString() },
      { dayContentId: day.id, domainId: "domain-a", sequence: 3, type: "open", body: "Q3?", maxLevel: 3, deadline: new Date(Date.now() + 86400000).toISOString() },
    ]);

    // Create answers and feedback for each
    const a1 = await repos.answers.create({ questionId: questions[0].id, body: "A1" });
    await repos.feedback.create({
      answerId: a1.id, questionId: questions[0].id,
      score: "correct", explanation: "Good", suggestedLevel: 3,
      applyLevel: false, improvements: [],
    });

    const a2 = await repos.answers.create({ questionId: questions[1].id, body: "A2" });
    await repos.feedback.create({
      answerId: a2.id, questionId: questions[1].id,
      score: "incorrect", explanation: "Wrong", suggestedLevel: 1,
      applyLevel: false, improvements: ["Review concepts"],
    });

    const a3 = await repos.answers.create({ questionId: questions[2].id, body: "A3" });
    await repos.feedback.create({
      answerId: a3.id, questionId: questions[2].id,
      score: "correct", explanation: "Great", suggestedLevel: 3,
      applyLevel: false, improvements: [],
    });

    // Record predictions:
    // Q1: predict correct, actual correct → delta = 0 (calibrated)
    await repos.calibration.create({
      questionId: questions[0].id,
      domainId: "domain-a",
      predictedScore: "correct",
      actualScore: "correct",
      delta: 0,
    });

    // Q2: predict correct, actual incorrect → delta = -1 (overestimate)
    await repos.calibration.create({
      questionId: questions[1].id,
      domainId: "domain-a",
      predictedScore: "correct",
      actualScore: "incorrect",
      delta: -1,
    });

    // Q3: predict incorrect, actual correct → delta = 1 (underestimate)
    await repos.calibration.create({
      questionId: questions[2].id,
      domainId: "domain-a",
      predictedScore: "incorrect",
      actualScore: "correct",
      delta: 1,
    });

    // Get summary and verify
    const summary = await repos.calibration.getSummary();
    assertEquals(summary.length, 1);
    assertEquals(summary[0].domainId, "domain-a");
    assertEquals(summary[0].count, 3);

    // avg delta = (0 + (-1) + 1) / 3 = 0
    assertEquals(summary[0].avgDelta, 0);
  });

  it("shows overestimation pattern across multiple domains", async () => {
    // Two overestimates on domain-a
    await repos.calibration.create({
      questionId: "q1",
      domainId: "domain-a",
      predictedScore: "correct",
      actualScore: "incorrect",
      delta: -1,
    });
    await repos.calibration.create({
      questionId: "q2",
      domainId: "domain-a",
      predictedScore: "correct",
      actualScore: "partial",
      delta: -1,
    });

    // One calibrated on domain-b
    await repos.calibration.create({
      questionId: "q3",
      domainId: "domain-b",
      predictedScore: "correct",
      actualScore: "correct",
      delta: 0,
    });

    const summary = await repos.calibration.getSummary();
    assertEquals(summary.length, 2);

    const domA = summary.find((s) => s.domainId === "domain-a");
    const domB = summary.find((s) => s.domainId === "domain-b");

    assertEquals(domA?.avgDelta, -1); // Consistent overestimation
    assertEquals(domA?.count, 2);
    assertEquals(domB?.avgDelta, 0); // Calibrated
    assertEquals(domB?.count, 1);
  });
});
