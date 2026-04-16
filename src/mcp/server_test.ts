// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertExists } from "jsr:@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "@/mcp/server.ts";
import {
  buildGapAnalysis,
  buildIntakeSession,
  buildRetentionSchedule,
  createTestConfig,
  createTestKv,
} from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

const config = createTestConfig();

/** Parse the JSON text from an MCP tool result. */
// deno-lint-ignore no-explicit-any
function parse(result: any): any {
  return JSON.parse(result.content[0].text);
}

describe("MCP tool logic — Layer 2 integration (InMemoryTransport)", () => {
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

  // ── Observe ────────────────────────────────

  describe("Observe tools", () => {
    it("get_dashboard returns correct counts", async () => {
      await repos.progress.put("domain-a", { level: 2, source: "assessment" });
      await repos.weeks.create({
        weekNumber: 1,
        domainId: "domain-a",
        isStretchWeek: false,
        summary: "Week 1",
      });
      await repos.weeks.create({
        weekNumber: 2,
        domainId: "domain-b",
        isStretchWeek: false,
        summary: "Week 2",
      });

      const result = await client.callTool({
        name: "get_dashboard",
        arguments: {},
      });
      const data = parse(result);

      assertEquals(data.currentWeek, 2);
      assertEquals(data.overallProgress.domainsStarted, 1);
      assertEquals(data.pendingQuestions, 0);
      assertEquals(data.retentionDue, 0);
    });

    it("get_progress returns all entries", async () => {
      await repos.progress.put("domain-a", { level: 3, source: "assessment" });
      await repos.progress.put("domain-b", { level: 1, source: "manual" });

      const result = await client.callTool({
        name: "get_progress",
        arguments: {},
      });
      const data = parse(result);
      assertEquals(data.length, 2);
    });

    it("get_progress returns single entry by domainId", async () => {
      await repos.progress.put("domain-a", { level: 3, source: "assessment" });
      await repos.progress.put("domain-b", { level: 1, source: "manual" });

      const result = await client.callTool({
        name: "get_progress",
        arguments: { domainId: "domain-a" },
      });
      const data = parse(result);
      assertExists(data);
      assertEquals(data.level, 3);
    });

    it("get_pending_answers returns only unanswered questions", async () => {
      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-a",
        title: "Test",
        body: "Body",
      });
      const [q1, q2] = await repos.questions.create([
        {
          dayContentId: day.id,
          domainId: "domain-a",
          sequence: 1,
          type: "open",
          body: "Q1?",
          maxLevel: 3,
          deadline: new Date(Date.now() + 86400000).toISOString(),
        },
        {
          dayContentId: day.id,
          domainId: "domain-a",
          sequence: 2,
          type: "open",
          body: "Q2?",
          maxLevel: 3,
          deadline: new Date(Date.now() + 86400000).toISOString(),
        },
      ]);
      await repos.answers.create({ questionId: q1.id, body: "A1" });

      const result = await client.callTool({
        name: "get_pending_answers",
        arguments: {},
      });
      const data = parse(result);
      assertEquals(data.length, 1);
      assertEquals(data[0].id, q2.id);
    });

    it("get_retention_due returns only past-due schedules", async () => {
      await repos.retention.put("domain-a", "correct");
      const pastDue = buildRetentionSchedule({
        domainId: "domain-b",
        nextDue: new Date(Date.now() - 86400000).toISOString(),
      });
      await kv.set(["retention", "domain-b"], pastDue);

      const result = await client.callTool({
        name: "get_retention_due",
        arguments: {},
      });
      const data = parse(result);
      assertEquals(data.length, 1);
      assertEquals(data[0].domainId, "domain-b");
    });

    it("get_scene_document returns scene and interaction log", async () => {
      const scene = {
        protocolVersion: "1.0",
        scene: { name: "test", schemaVersion: "1" },
        steps: [{
          id: "s1",
          kind: "show",
          node: { type: "text", properties: { content: "Hello" } },
        }],
      };
      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-a",
        title: "T",
        body: "B",
        sceneDocument: scene,
      });

      const result = await client.callTool({
        name: "get_scene_document",
        arguments: { dayContentId: day.id },
      });
      const data = parse(result);
      assertExists(data.sceneDocument);
      assertEquals(data.sceneDocument.scene.name, "test");
    });
  });

  // ── Generate ───────────────────────────────

  describe("Generate tools", () => {
    it("create_week_plan persists", async () => {
      const result = await client.callTool({
        name: "create_week_plan",
        arguments: {
          weekNumber: 1,
          domainId: "domain-a",
          isStretchWeek: false,
          summary: "Intro week",
        },
      });
      const data = parse(result);
      assertEquals(data.weekNumber, 1);

      const fetched = await repos.weeks.get(1);
      assertExists(fetched);
      assertEquals(fetched.summary, "Intro week");
    });

    it("create_day_content with valid sceneDocument stores it", async () => {
      const scene = {
        protocolVersion: "1.0",
        scene: { name: "test", schemaVersion: "1" },
        steps: [{
          id: "s1",
          kind: "show",
          node: { type: "text", properties: { content: "Hello" } },
        }],
      };

      const result = await client.callTool({
        name: "create_day_content",
        arguments: {
          weekNumber: 1,
          dayOfWeek: 1,
          type: "theory",
          domainId: "domain-a",
          title: "Theory Day",
          body: "Summary text",
          sceneDocument: scene,
        },
      });
      const data = parse(result);
      assertExists(data.id);

      const fetched = await repos.days.getById(data.id);
      assertExists(fetched);
      assertExists(fetched.sceneDocument);
    });

    it("create_day_content with invalid sceneDocument returns validation errors", async () => {
      const invalidScene = { protocolVersion: "2.0" };

      const result = await client.callTool({
        name: "create_day_content",
        arguments: {
          weekNumber: 1,
          dayOfWeek: 1,
          type: "theory",
          domainId: "domain-a",
          title: "Bad",
          body: "Body",
          sceneDocument: invalidScene,
        },
      });
      const data = parse(result);
      assertExists(data.error);
      assertEquals(data.errors.length > 0, true);
    });

    it("create_questions creates linked entities", async () => {
      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "practice_guided",
        domainId: "domain-a",
        title: "Practice",
        body: "Body",
      });

      const result = await client.callTool({
        name: "create_questions",
        arguments: {
          dayContentId: day.id,
          questions: [
            {
              domainId: "domain-a",
              sequence: 1,
              type: "scenario",
              body: "Scenario Q?",
              maxLevel: 3,
              deadline: new Date(Date.now() + 86400000).toISOString(),
            },
            {
              domainId: "domain-a",
              sequence: 2,
              type: "multiple_choice",
              body: "MC Q?",
              maxLevel: 2,
              deadline: new Date(Date.now() + 86400000).toISOString(),
              options: [
                { key: "A", text: "Option A", isOptimal: true },
                { key: "B", text: "Option B", isOptimal: false },
              ],
            },
          ],
        },
      });
      const data = parse(result);
      assertEquals(data.length, 2);

      const byDay = await repos.questions.getByDay(day.id);
      assertEquals(byDay.length, 2);
    });

    it("create_feedback without applyLevel does not update progress", async () => {
      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 5,
        type: "assessment",
        domainId: "domain-a",
        title: "Assessment",
        body: "Body",
      });
      const [question] = await repos.questions.create([{
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 1,
        type: "open",
        body: "Open Q?",
        maxLevel: 4,
        deadline: new Date(Date.now() + 86400000).toISOString(),
      }]);
      const answer = await repos.answers.create({
        questionId: question.id,
        body: "My answer",
      });

      await client.callTool({
        name: "create_feedback",
        arguments: {
          answerId: answer.id,
          questionId: question.id,
          score: "correct",
          explanation: "Good",
          suggestedLevel: 3,
          applyLevel: false,
          improvements: [],
        },
      });

      const progress = await repos.progress.get("domain-a");
      assertEquals(progress, null);
    });

    it("create_feedback with applyLevel=true updates progress", async () => {
      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 5,
        type: "assessment",
        domainId: "domain-a",
        title: "Assessment",
        body: "Body",
      });
      const [question] = await repos.questions.create([{
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 1,
        type: "open",
        body: "Open Q?",
        maxLevel: 4,
        deadline: new Date(Date.now() + 86400000).toISOString(),
      }]);
      const answer = await repos.answers.create({
        questionId: question.id,
        body: "My answer",
      });

      await client.callTool({
        name: "create_feedback",
        arguments: {
          answerId: answer.id,
          questionId: question.id,
          score: "correct",
          explanation: "Well done",
          suggestedLevel: 3,
          applyLevel: true,
          improvements: [],
        },
      });

      const progress = await repos.progress.get("domain-a");
      assertExists(progress);
      assertEquals(progress.level, 3);
    });

    it("create_feedback with structured feedback fields persists them", async () => {
      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 5,
        type: "assessment",
        domainId: "domain-a",
        title: "Assessment",
        body: "Body",
      });
      const [question] = await repos.questions.create([{
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 1,
        type: "open",
        body: "Q?",
        maxLevel: 4,
        deadline: new Date(Date.now() + 86400000).toISOString(),
      }]);
      const answer = await repos.answers.create({
        questionId: question.id,
        body: "ans",
      });

      const result = await client.callTool({
        name: "create_feedback",
        arguments: {
          answerId: answer.id,
          questionId: question.id,
          score: "partial",
          explanation: "Decent",
          suggestedLevel: 2,
          applyLevel: false,
          improvements: ["be more specific"],
          feedUp: "Working toward CKA competency",
          feedBack: "Identified the core concept",
          feedForward: "Add more detail next time",
          feedbackLevel: "process",
        },
      });
      const data = parse(result);
      assertEquals(data.score, "partial");
      assertEquals(data.feedUp, "Working toward CKA competency");
      assertEquals(data.feedBack, "Identified the core concept");
      assertEquals(data.feedForward, "Add more detail next time");
      assertEquals(data.feedbackLevel, "process");
    });
  });

  // ── Calibration ────────────────────────────

  describe("Calibration tools", () => {
    it("record_self_assessment computes delta for overestimate (-1)", async () => {
      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-a",
        title: "D",
        body: "B",
      });
      const [question] = await repos.questions.create([{
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 1,
        type: "open",
        body: "Q?",
        maxLevel: 3,
        deadline: new Date(Date.now() + 86400000).toISOString(),
      }]);
      const answer = await repos.answers.create({
        questionId: question.id,
        body: "ans",
      });
      await repos.feedback.create({
        answerId: answer.id,
        questionId: question.id,
        score: "incorrect",
        explanation: "Wrong",
        suggestedLevel: 1,
        applyLevel: false,
        improvements: [],
      });

      const result = await client.callTool({
        name: "record_self_assessment",
        arguments: { questionId: question.id, predictedScore: "correct" },
      });
      const data = parse(result);
      assertEquals(data.delta, -1);
    });

    it("record_self_assessment computes delta for calibrated (0)", async () => {
      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-a",
        title: "D",
        body: "B",
      });
      const [question] = await repos.questions.create([{
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 1,
        type: "open",
        body: "Q?",
        maxLevel: 3,
        deadline: new Date(Date.now() + 86400000).toISOString(),
      }]);
      const answer = await repos.answers.create({
        questionId: question.id,
        body: "ans",
      });
      await repos.feedback.create({
        answerId: answer.id,
        questionId: question.id,
        score: "correct",
        explanation: "Good",
        suggestedLevel: 3,
        applyLevel: false,
        improvements: [],
      });

      const result = await client.callTool({
        name: "record_self_assessment",
        arguments: { questionId: question.id, predictedScore: "correct" },
      });
      const data = parse(result);
      assertEquals(data.delta, 0);
    });

    it("record_self_assessment computes delta for underestimate (1)", async () => {
      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-a",
        title: "D",
        body: "B",
      });
      const [question] = await repos.questions.create([{
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 1,
        type: "open",
        body: "Q?",
        maxLevel: 3,
        deadline: new Date(Date.now() + 86400000).toISOString(),
      }]);
      const answer = await repos.answers.create({
        questionId: question.id,
        body: "ans",
      });
      await repos.feedback.create({
        answerId: answer.id,
        questionId: question.id,
        score: "correct",
        explanation: "Good",
        suggestedLevel: 3,
        applyLevel: false,
        improvements: [],
      });

      const result = await client.callTool({
        name: "record_self_assessment",
        arguments: { questionId: question.id, predictedScore: "incorrect" },
      });
      const data = parse(result);
      assertEquals(data.delta, 1);
    });

    it("record_self_assessment returns error for missing question", async () => {
      const result = await client.callTool({
        name: "record_self_assessment",
        arguments: { questionId: "nonexistent", predictedScore: "correct" },
      });
      const data = parse(result);
      assertEquals(data.error, "Question not found");
    });

    it("record_self_assessment returns error when feedback not yet created", async () => {
      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-a",
        title: "D",
        body: "B",
      });
      const [question] = await repos.questions.create([{
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 1,
        type: "open",
        body: "Q?",
        maxLevel: 3,
        deadline: new Date(Date.now() + 86400000).toISOString(),
      }]);
      await repos.answers.create({ questionId: question.id, body: "ans" });
      // No feedback created

      const result = await client.callTool({
        name: "record_self_assessment",
        arguments: { questionId: question.id, predictedScore: "correct" },
      });
      const data = parse(result);
      assertExists(data.error);
    });

    it("get_calibration_summary returns summary", async () => {
      // Seed a calibration entry via record_self_assessment
      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-a",
        title: "D",
        body: "B",
      });
      const [question] = await repos.questions.create([{
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 1,
        type: "open",
        body: "Q?",
        maxLevel: 3,
        deadline: new Date(Date.now() + 86400000).toISOString(),
      }]);
      const answer = await repos.answers.create({
        questionId: question.id,
        body: "ans",
      });
      await repos.feedback.create({
        answerId: answer.id,
        questionId: question.id,
        score: "correct",
        explanation: "Good",
        suggestedLevel: 3,
        applyLevel: false,
        improvements: [],
      });
      await client.callTool({
        name: "record_self_assessment",
        arguments: { questionId: question.id, predictedScore: "correct" },
      });

      const result = await client.callTool({
        name: "get_calibration_summary",
        arguments: {},
      });
      const data = parse(result);
      assertExists(data);
    });
  });

  // ── Intake ─────────────────────────────────

  describe("Intake tools", () => {
    it("start_intake creates session with config context", async () => {
      const result = await client.callTool({
        name: "start_intake",
        arguments: {},
      });
      const data = parse(result);

      assertExists(data.session);
      assertEquals(data.session.status, "goal_validation");
      assertExists(data.learner);
      assertExists(data.curriculum);
    });

    it("start_intake returns existing session if already started", async () => {
      const result1 = await client.callTool({
        name: "start_intake",
        arguments: {},
      });
      const data1 = parse(result1);
      const sessionId = data1.session.id;

      const result2 = await client.callTool({
        name: "start_intake",
        arguments: {},
      });
      const data2 = parse(result2);
      assertEquals(data2.session.id, sessionId);
    });

    it("send_intake_message stores message and advances phase", async () => {
      await client.callTool({ name: "start_intake", arguments: {} });

      const result = await client.callTool({
        name: "send_intake_message",
        arguments: {
          content: "Tell me about yourself",
          phase: "profile_validation",
        },
      });
      const data = parse(result);
      assertEquals(data.phase, "profile_validation");
      assertEquals(data.role, "agent");

      const messages = await repos.intake.getMessages();
      assertEquals(messages.length, 1);

      // Session phase should have advanced
      const session = await repos.intake.getSession();
      assertEquals(session?.status, "profile_validation");
    });

    it("complete_intake sets progress levels and marks LearnerState completed", async () => {
      await client.callTool({ name: "start_intake", arguments: {} });

      // Advance to gap_analysis first
      await client.callTool({
        name: "send_intake_message",
        arguments: { content: "Advancing", phase: "gap_analysis" },
      });

      const result = await client.callTool({
        name: "complete_intake",
        arguments: {
          gapAnalysis: buildGapAnalysis({
            overallFeasible: true,
            estimatedWeeks: 8,
            phaseGaps: [
              {
                phaseId: 1,
                phaseName: "Fundamentals",
                gapSize: "moderate",
                estimatedWeeks: 4,
                strategy: "analogy",
              },
              {
                phaseId: 2,
                phaseName: "Advanced",
                gapSize: "large",
                estimatedWeeks: 4,
                strategy: "first_principles",
              },
            ],
          }),
          baselineResults: [
            {
              phaseId: 1,
              questionId: "q1",
              question: "What is X?",
              answer: "Y",
              suggestedLevel: 2,
            },
            {
              phaseId: 2,
              questionId: "q2",
              question: "Explain Z",
              answer: "W",
              suggestedLevel: 1,
            },
          ],
        },
      });
      const data = parse(result);
      assertEquals(data.status, "completed");
      assertExists(data.completedAt);

      // Phase 1 domains (domain-a, domain-b) should be level 2
      const progA = await repos.progress.get("domain-a");
      assertEquals(progA?.level, 2);
      const progB = await repos.progress.get("domain-b");
      assertEquals(progB?.level, 2);

      // Phase 2 domains (domain-c, domain-d) should be level 1
      const progC = await repos.progress.get("domain-c");
      assertEquals(progC?.level, 1);

      // LearnerState should be updated
      const state = await repos.learnerState.get();
      assertExists(state);
      assertEquals(state.intake.completed, true);
    });
  });

  // ── Gap Analysis ───────────────────────────

  describe("Gap Analysis tools", () => {
    it("get_gap_analysis returns per-phase analysis", async () => {
      await repos.progress.put("domain-a", { level: 3, source: "assessment" });
      await repos.progress.put("domain-b", { level: 1, source: "manual" });

      const result = await client.callTool({
        name: "get_gap_analysis",
        arguments: {},
      });
      const data = parse(result);

      assertEquals(data.phaseGaps.length, 2);
      assertExists(
        data.phaseGaps.find((p: { phaseId: number }) => p.phaseId === 1),
      );
      assertExists(
        data.phaseGaps.find((p: { phaseId: number }) => p.phaseId === 2),
      );
    });

    it("get_gap_analysis filters by phaseId", async () => {
      await repos.progress.put("domain-a", { level: 3, source: "assessment" });

      const result = await client.callTool({
        name: "get_gap_analysis",
        arguments: { phaseId: 1 },
      });
      const data = parse(result);
      assertEquals(data.phaseId, 1);
    });

    it("recalculate_gaps compares vs intake", async () => {
      const session = buildIntakeSession({
        status: "completed",
        gapAnalysis: buildGapAnalysis({ estimatedWeeks: 8 }),
      });
      await repos.intake.putSession(session);

      await repos.progress.put("domain-a", { level: 4, source: "assessment" });
      await repos.progress.put("domain-b", { level: 4, source: "assessment" });

      const result = await client.callTool({
        name: "recalculate_gaps",
        arguments: { weekNumber: 2 },
      });
      const data = parse(result);

      assertExists(data.intakeGapComparison);
      assertEquals(data.intakeGapComparison.delta < 0, true);
    });
  });

  // ── Wellbeing ─────────────────────────────

  describe("Wellbeing tools", () => {
    it("set_wellbeing_status sets paused", async () => {
      const result = await client.callTool({
        name: "set_wellbeing_status",
        arguments: { status: "paused" },
      });
      const data = parse(result);
      assertEquals(data.status, "paused");
      assertExists(data.pausedAt);
    });

    it("set_wellbeing_status sets returning", async () => {
      // First pause
      await client.callTool({
        name: "set_wellbeing_status",
        arguments: { status: "paused" },
      });
      // Then return
      const result = await client.callTool({
        name: "set_wellbeing_status",
        arguments: { status: "returning" },
      });
      const data = parse(result);
      assertEquals(data.status, "returning");
      assertExists(data.returnedAt);
    });

    it("recalculate_retention_after_pause recalculates intervals", async () => {
      await repos.retention.put("domain-a", "correct");
      await repos.retention.put("domain-b", "correct");

      const result = await client.callTool({
        name: "recalculate_retention_after_pause",
        arguments: { pauseDays: 10 },
      });
      const data = parse(result);
      assertEquals(data.recalculated, 2);
      assertEquals(data.pauseDays, 10);
    });
  });

  // ── Scheduling ────────────────────────────

  describe("Scheduling tools", () => {
    it("get_scheduled_tasks returns manifest and schedule", async () => {
      const result = await client.callTool({
        name: "get_scheduled_tasks",
        arguments: {},
      });
      const data = parse(result);
      assertExists(data.tasks);
      assertExists(data.schedule);
    });
  });
});
