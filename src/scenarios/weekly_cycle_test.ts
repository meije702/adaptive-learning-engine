import { assertEquals, assertExists } from "jsr:@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "@/mcp/server.ts";
import { createTestConfig, createTestKv } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

const config = createTestConfig();

// deno-lint-ignore no-explicit-any
function parse(result: any): any {
  return JSON.parse(result.content[0].text);
}

describe("Scenario: Weekly content generation cycle", () => {
  let kv: Deno.Kv;
  let repos: Repositories;
  let client: Client;
  // deno-lint-ignore no-explicit-any
  let server: any;

  beforeEach(async () => {
    const t = await createTestKv();
    kv = t.kv;
    repos = t.repos;

    server = await createMcpServer(repos, config);
    const [clientTransport, serverTransport] = InMemoryTransport
      .createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    kv.close();
  });

  it("creates week plan -> theory day -> questions -> answer -> feedback -> progress updated", async () => {
    // Step 1: Create week plan via MCP
    const planResult = await client.callTool({
      name: "create_week_plan",
      arguments: {
        weekNumber: 1,
        domainId: "domain-a",
        isStretchWeek: false,
        summary: "Introduction to Domain A fundamentals",
      },
    });
    const plan = parse(planResult);
    assertEquals(plan.weekNumber, 1);
    assertEquals(plan.domainId, "domain-a");

    // Verify via get_week_overview
    const overviewResult = await client.callTool({
      name: "get_week_overview",
      arguments: { weekNumber: 1 },
    });
    const overview = parse(overviewResult);
    assertExists(overview.plan);
    assertEquals(overview.plan.weekNumber, 1);

    // Step 2: Create theory day with SceneDocument via MCP
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

    const dayResult = await client.callTool({
      name: "create_day_content",
      arguments: {
        weekNumber: 1,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-a",
        title: "Domain A Theory",
        body: "Introduction to core concepts of Domain A.",
        sceneDocument: scene,
      },
    });
    const day = parse(dayResult);
    assertExists(day.id);
    assertExists(day.sceneDocument);

    // Verify scene document stored correctly via get_scene_document
    const sceneResult = await client.callTool({
      name: "get_scene_document",
      arguments: { dayContentId: day.id },
    });
    const sceneData = parse(sceneResult);
    assertExists(sceneData.sceneDocument);

    // Step 3: Create questions linked to day, with scrimCheckpoint
    const questionsResult = await client.callTool({
      name: "create_questions",
      arguments: {
        dayContentId: day.id,
        questions: [
          {
            domainId: "domain-a",
            sequence: 1,
            type: "scenario",
            body: "Given a scenario where X, what would you do?",
            maxLevel: 3,
            deadline: new Date(Date.now() + 86400000).toISOString(),
            scrimCheckpoint: "scenario-checkpoint-1",
          },
          {
            domainId: "domain-a",
            sequence: 2,
            type: "multiple_choice",
            body: "Which approach is best for Y?",
            maxLevel: 2,
            deadline: new Date(Date.now() + 86400000).toISOString(),
            scrimCheckpoint: "mc-checkpoint-1",
            options: [
              { key: "A", text: "Approach 1", isOptimal: false },
              { key: "B", text: "Approach 2", isOptimal: true },
              { key: "C", text: "Approach 3", isOptimal: false },
              { key: "D", text: "Approach 4", isOptimal: false },
            ],
          },
        ],
      },
    });
    const questions = parse(questionsResult);
    assertEquals(questions.length, 2);
    assertEquals(questions[0].dayContentId, day.id);

    // Verify questions appear as pending via get_pending_answers
    const pendingResult = await client.callTool({
      name: "get_pending_answers",
      arguments: {},
    });
    const pending = parse(pendingResult);
    assertEquals(pending.length, 2);

    // Step 4: Submit answer via API route handler (answers come from learner UI)
    const { handler: evaluateHandler } = await import(
      "@/routes/api/evaluate.ts"
    );
    const evalReq = new Request("http://localhost/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response:
          "I would analyze the constraints first and then apply pattern X",
        evaluatorKey: "scenario-checkpoint-1",
        dayContentId: day.id,
      }),
    });
    const evalResponse = await evaluateHandler.POST!({
      req: evalReq,
      state: { repos, config },
      params: {},
      url: new URL(evalReq.url),
      // deno-lint-ignore no-explicit-any
    } as any);
    const evalData = await evalResponse.json();
    assertEquals(evalData.metadata.pending, true); // free-text -> pending

    // Step 5: Create feedback with applyLevel=true via MCP
    const answerId = evalData.metadata.answerId;
    const feedbackResult = await client.callTool({
      name: "create_feedback",
      arguments: {
        answerId,
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
      },
    });
    const feedback = parse(feedbackResult);
    assertEquals(feedback.score, "correct");
    assertEquals(feedback.suggestedLevel, 3);
    assertEquals(
      feedback.feedUp,
      "This brings you closer to independent CKA competency.",
    );

    // Step 6: Verify progress updated via get_progress MCP tool
    const progressResult = await client.callTool({
      name: "get_progress",
      arguments: { domainId: "domain-a" },
    });
    const progress = parse(progressResult);
    assertExists(progress);
    assertEquals(progress.level, 3);
    assertEquals(progress.assessmentCount, 1);
    assertEquals(progress.history.length, 1);
    assertEquals(progress.history[0].source, "assessment");
  });
});
