import { assertEquals, assertExists } from "jsr:@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import {
  buildGapAnalysis,
  createTestConfig,
  createTestKv,
} from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";
import type { IntakeSession } from "@/db/types.ts";

const config = createTestConfig();

describe("Scenario: Full intake journey", () => {
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

  it("completes intake end-to-end: start → messages → complete", async () => {
    // Step 1: Start intake (creates session at goal_validation)
    const session: IntakeSession = {
      id: crypto.randomUUID(),
      status: "goal_validation",
      startedAt: new Date().toISOString(),
      baselineResults: [],
    };
    await repos.intake.putSession(session);

    const fetched = await repos.intake.getSession();
    assertExists(fetched);
    assertEquals(fetched.status, "goal_validation");

    // Step 2: Agent sends messages advancing through phases
    await repos.intake.addMessage({
      role: "agent",
      content: "What is your learning goal?",
      phase: "goal_validation",
    });

    session.status = "profile_validation";
    await repos.intake.putSession(session);
    await repos.intake.addMessage({
      role: "agent",
      content: "Tell me about your background.",
      phase: "profile_validation",
    });

    session.status = "baseline";
    await repos.intake.putSession(session);
    await repos.intake.addMessage({
      role: "agent",
      content: "Let me assess your current level.",
      phase: "baseline",
    });

    session.status = "gap_analysis";
    await repos.intake.putSession(session);
    await repos.intake.addMessage({
      role: "agent",
      content: "Here is the gap analysis.",
      phase: "gap_analysis",
    });

    session.status = "confirmation";
    await repos.intake.putSession(session);
    await repos.intake.addMessage({
      role: "agent",
      content: "Ready to begin?",
      phase: "confirmation",
    });

    const messages = await repos.intake.getMessages();
    assertEquals(messages.length, 5);

    // Step 3: Complete intake with baseline results and gap analysis
    session.status = "completed";
    session.completedAt = new Date().toISOString();
    session.gapAnalysis = buildGapAnalysis({
      overallFeasible: true,
      estimatedWeeks: 8,
    });
    session.baselineResults = [
      { phaseId: 1, questionId: "q1", question: "Fundamentals Q", answer: "A1", suggestedLevel: 2 },
      { phaseId: 2, questionId: "q2", question: "Advanced Q", answer: "A2", suggestedLevel: 1 },
    ];
    await repos.intake.putSession(session);

    // Set initial progress from baseline
    for (const result of session.baselineResults) {
      const phaseDomains = config.curriculum.domains.filter(
        (d) => d.phase === result.phaseId,
      );
      for (const domain of phaseDomains) {
        await repos.progress.put(domain.id, {
          level: result.suggestedLevel as 0 | 1 | 2 | 3 | 4 | 5,
          source: "manual",
          notes: `Intake baseline: ${result.question}`,
        });
      }
    }

    // Update learner state
    await repos.learnerState.put({
      intake: { completed: true, completedAt: session.completedAt },
      wellbeing: { status: "active" },
    });

    // Completion message
    await repos.intake.addMessage({
      role: "agent",
      content: "Intake complete.",
      phase: "completed",
    });

    // Step 4: Verify all state
    const finalSession = await repos.intake.getSession();
    assertExists(finalSession);
    assertEquals(finalSession.status, "completed");
    assertExists(finalSession.completedAt);

    // Progress levels set from baseline
    const progA = await repos.progress.get("domain-a");
    assertEquals(progA?.level, 2); // Phase 1 → level 2
    const progB = await repos.progress.get("domain-b");
    assertEquals(progB?.level, 2); // Phase 1 → level 2
    const progC = await repos.progress.get("domain-c");
    assertEquals(progC?.level, 1); // Phase 2 → level 1
    const progD = await repos.progress.get("domain-d");
    assertEquals(progD?.level, 1); // Phase 2 → level 1

    // LearnerState.intake.completed = true
    const state = await repos.learnerState.get();
    assertExists(state);
    assertEquals(state.intake.completed, true);
    assertExists(state.intake.completedAt);

    // Session status = completed
    assertEquals(finalSession.status, "completed");
  });
});
