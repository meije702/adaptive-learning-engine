import { assertEquals, assertExists } from "jsr:@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "@/mcp/server.ts";
import {
  buildGapAnalysis,
  createTestConfig,
  createTestKv,
} from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

const config = createTestConfig();

// deno-lint-ignore no-explicit-any
function parse(result: any): any {
  return JSON.parse(result.content[0].text);
}

describe("Scenario: Full intake journey", () => {
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
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    kv.close();
  });

  it("completes intake end-to-end: start -> messages -> complete", async () => {
    // Step 1: Start intake — creates session at goal_validation
    const startResult = await client.callTool({ name: "start_intake", arguments: {} });
    const startData = parse(startResult);
    assertExists(startData.session);
    assertEquals(startData.session.status, "goal_validation");
    assertExists(startData.learner);
    assertExists(startData.curriculum);

    // Step 2: Agent sends messages advancing through phases
    const msg1 = await client.callTool({
      name: "send_intake_message",
      arguments: { content: "What is your learning goal?", phase: "goal_validation" },
    });
    assertEquals(parse(msg1).phase, "goal_validation");

    const msg2 = await client.callTool({
      name: "send_intake_message",
      arguments: { content: "Tell me about your background.", phase: "profile_validation" },
    });
    assertEquals(parse(msg2).phase, "profile_validation");

    const msg3 = await client.callTool({
      name: "send_intake_message",
      arguments: { content: "Let me assess your current level.", phase: "baseline" },
    });
    assertEquals(parse(msg3).phase, "baseline");

    const msg4 = await client.callTool({
      name: "send_intake_message",
      arguments: { content: "Here is the gap analysis.", phase: "gap_analysis" },
    });
    assertEquals(parse(msg4).phase, "gap_analysis");

    const msg5 = await client.callTool({
      name: "send_intake_message",
      arguments: { content: "Ready to begin?", phase: "confirmation" },
    });
    assertEquals(parse(msg5).phase, "confirmation");

    const messages = await repos.intake.getMessages();
    assertEquals(messages.length, 5);

    // Step 3: Complete intake with baseline results and gap analysis
    const completeResult = await client.callTool({
      name: "complete_intake",
      arguments: {
        gapAnalysis: buildGapAnalysis({
          overallFeasible: true,
          estimatedWeeks: 8,
          phaseGaps: [
            { phaseId: 1, phaseName: "Fundamentals", gapSize: "moderate", estimatedWeeks: 4, strategy: "analogy" },
            { phaseId: 2, phaseName: "Advanced", gapSize: "large", estimatedWeeks: 4, strategy: "first_principles" },
          ],
        }),
        baselineResults: [
          { phaseId: 1, questionId: "q1", question: "Fundamentals Q", answer: "A1", suggestedLevel: 2 },
          { phaseId: 2, questionId: "q2", question: "Advanced Q", answer: "A2", suggestedLevel: 1 },
        ],
      },
    });
    const completeData = parse(completeResult);
    assertEquals(completeData.status, "completed");
    assertExists(completeData.completedAt);

    // Step 4: Verify all state
    const finalSession = await repos.intake.getSession();
    assertExists(finalSession);
    assertEquals(finalSession.status, "completed");
    assertExists(finalSession.completedAt);

    // Progress levels set from baseline
    const progA = await repos.progress.get("domain-a");
    assertEquals(progA?.level, 2); // Phase 1 -> level 2
    const progB = await repos.progress.get("domain-b");
    assertEquals(progB?.level, 2); // Phase 1 -> level 2
    const progC = await repos.progress.get("domain-c");
    assertEquals(progC?.level, 1); // Phase 2 -> level 1
    const progD = await repos.progress.get("domain-d");
    assertEquals(progD?.level, 1); // Phase 2 -> level 1

    // LearnerState.intake.completed = true
    const state = await repos.learnerState.get();
    assertExists(state);
    assertEquals(state.intake.completed, true);
    assertExists(state.intake.completedAt);

    // Messages include completion message added by complete_intake
    const allMessages = await repos.intake.getMessages();
    assertEquals(allMessages.length, 6); // 5 phase messages + 1 completion message
  });
});
