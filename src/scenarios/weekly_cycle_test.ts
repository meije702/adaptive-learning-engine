import { assertEquals, assertExists } from "jsr:@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { createTestKv } from "@/test_helpers.ts";
import { validateSceneDocument } from "@/scrim/validate.ts";
import type { Repositories } from "@/db/repositories.ts";

describe("Scenario: Weekly content generation cycle", () => {
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

  it("creates week plan → theory day → questions → answer → feedback → progress updated", async () => {
    // Step 1: Create week plan
    const plan = await repos.weeks.create({
      weekNumber: 1,
      domainId: "domain-a",
      isStretchWeek: false,
      summary: "Introduction to Domain A fundamentals",
    });
    assertEquals(plan.weekNumber, 1);
    assertEquals(plan.domainId, "domain-a");

    // Step 2: Create theory day with SceneDocument
    const scene = {
      protocolVersion: "1.0",
      scene: { name: "domain-a-theory", schemaVersion: "1" },
      steps: [
        {
          id: "intro",
          kind: "show",
          node: {
            type: "text",
            properties: { content: "Welcome to Domain A" },
          },
        },
        {
          id: "concept",
          kind: "show",
          node: {
            type: "text",
            properties: { content: "Key concepts explained here" },
          },
        },
      ],
    };

    const validation = validateSceneDocument(scene);
    assertEquals(validation.valid, true);

    const day = await repos.days.create({
      weekNumber: 1,
      dayOfWeek: 1,
      type: "theory",
      domainId: "domain-a",
      title: "Domain A Theory",
      body: "Introduction to core concepts of Domain A.",
      sceneDocument: scene,
    });

    assertExists(day.id);
    assertExists(day.sceneDocument);

    // Step 3: Create questions linked to day
    const questions = await repos.questions.create([
      {
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 1,
        type: "scenario",
        body: "Given a scenario where X, what would you do?",
        maxLevel: 3,
        deadline: new Date(Date.now() + 86400000).toISOString(),
      },
      {
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 2,
        type: "multiple_choice",
        body: "Which approach is best for Y?",
        maxLevel: 2,
        deadline: new Date(Date.now() + 86400000).toISOString(),
        options: [
          { key: "A", text: "Approach 1", isOptimal: false },
          { key: "B", text: "Approach 2", isOptimal: true },
          { key: "C", text: "Approach 3", isOptimal: false },
          { key: "D", text: "Approach 4", isOptimal: false },
        ],
      },
    ]);

    assertEquals(questions.length, 2);
    assertEquals(questions[0].dayContentId, day.id);

    // Step 4: Submit answer
    const answer = await repos.answers.create({
      questionId: questions[0].id,
      body: "I would analyze the constraints first and then apply pattern X",
    });

    assertExists(answer.id);
    assertEquals(answer.questionId, questions[0].id);

    // Step 5: Create feedback with applyLevel=true
    const feedback = await repos.feedback.create({
      answerId: answer.id,
      questionId: questions[0].id,
      score: "correct",
      explanation: "Excellent analysis of the problem",
      suggestedLevel: 3,
      applyLevel: true,
      improvements: [],
      feedUp: "This brings you closer to independent CKA competency.",
      feedBack: "You correctly identified the constraint analysis approach.",
      feedForward: "Try applying this to multi-resource scenarios next.",
      feedbackLevel: "process",
    });

    assertEquals(feedback.score, "correct");
    assertEquals(feedback.suggestedLevel, 3);

    // Apply the level (replicating MCP create_feedback logic)
    const question = await repos.questions.get(questions[0].id);
    assertExists(question);
    await repos.progress.put(question.domainId, {
      level: 3,
      source: "assessment",
      notes: feedback.explanation,
    });

    // Step 6: Verify progress updated
    const progress = await repos.progress.get("domain-a");
    assertExists(progress);
    assertEquals(progress.level, 3);
    assertEquals(progress.assessmentCount, 1);
    assertEquals(progress.history.length, 1);
    assertEquals(progress.history[0].source, "assessment");
  });
});
