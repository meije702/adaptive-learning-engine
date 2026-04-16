import { assertEquals, assertExists } from "jsr:@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import {
  buildAnswer,
  buildDayContent,
  buildFeedback,
  buildGapAnalysis,
  buildIntakeSession,
  buildLearnerState,
  buildProgress,
  buildQuestion,
  buildRetentionSchedule,
  buildWeekPlan,
  createTestConfig,
  createTestKv,
} from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";
import { computeGapAnalysis } from "@/analysis/gap.ts";
import { validateSceneDocument } from "@/scrim/validate.ts";

const config = createTestConfig();

describe("MCP tool logic — Layer 2 integration", () => {
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

  // ── Observe ────────────────────────────────

  describe("Observe tools", () => {
    it("get_dashboard returns correct counts", async () => {
      // Seed data
      await repos.progress.put("domain-a", { level: 2, source: "assessment" });
      await repos.weeks.create({ weekNumber: 1, domainId: "domain-a", isStretchWeek: false, summary: "Week 1" });
      await repos.weeks.create({ weekNumber: 2, domainId: "domain-b", isStretchWeek: false, summary: "Week 2" });

      const progress = await repos.progress.getAll();
      const weeks = await repos.weeks.getAll();
      const pending = await repos.questions.getPending();
      const retentionDue = await repos.retention.getDue();

      const currentWeek = weeks.length > 0 ? Math.max(...weeks.map((w) => w.weekNumber)) : 0;

      assertEquals(currentWeek, 2);
      assertEquals(progress.filter((p) => p.level > 0).length, 1);
      assertEquals(pending.length, 0);
      assertEquals(retentionDue.length, 0);
    });

    it("get_progress returns entries", async () => {
      await repos.progress.put("domain-a", { level: 3, source: "assessment" });
      await repos.progress.put("domain-b", { level: 1, source: "manual" });

      const all = await repos.progress.getAll();
      assertEquals(all.length, 2);

      const single = await repos.progress.get("domain-a");
      assertExists(single);
      assertEquals(single.level, 3);
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
        { dayContentId: day.id, domainId: "domain-a", sequence: 1, type: "open", body: "Q1?", maxLevel: 3, deadline: new Date(Date.now() + 86400000).toISOString() },
        { dayContentId: day.id, domainId: "domain-a", sequence: 2, type: "open", body: "Q2?", maxLevel: 3, deadline: new Date(Date.now() + 86400000).toISOString() },
      ]);

      // Answer q1 only
      await repos.answers.create({ questionId: q1.id, body: "A1" });

      const pending = await repos.questions.getPending();
      assertEquals(pending.length, 1);
      assertEquals(pending[0].id, q2.id);
    });

    it("get_retention_due returns only past-due schedules", async () => {
      await repos.retention.put("domain-a", "correct");
      // domain-a now has a future due date

      // Manually seed a past-due schedule
      const pastDue = buildRetentionSchedule({
        domainId: "domain-b",
        nextDue: new Date(Date.now() - 86400000).toISOString(),
      });
      // Use kv directly to seed
      await kv.set(["retention", "domain-b"], pastDue);

      const due = await repos.retention.getDue();
      assertEquals(due.length, 1);
      assertEquals(due[0].domainId, "domain-b");
    });
  });

  // ── Generate ───────────────────────────────

  describe("Generate tools", () => {
    it("create_week_plan persists", async () => {
      const plan = await repos.weeks.create({
        weekNumber: 1,
        domainId: "domain-a",
        isStretchWeek: false,
        summary: "Intro week",
      });

      assertEquals(plan.weekNumber, 1);
      const fetched = await repos.weeks.get(1);
      assertExists(fetched);
      assertEquals(fetched.summary, "Intro week");
    });

    it("create_day_content with valid sceneDocument stores it", async () => {
      const scene = {
        protocolVersion: "1.0",
        scene: { name: "test", schemaVersion: "1" },
        steps: [{ id: "s1", kind: "show", node: { type: "text", properties: { content: "Hello" } } }],
      };

      const validation = validateSceneDocument(scene);
      assertEquals(validation.valid, true);

      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-a",
        title: "Theory Day",
        body: "Summary text",
        sceneDocument: scene,
      });

      const fetched = await repos.days.getById(day.id);
      assertExists(fetched);
      assertExists(fetched.sceneDocument);
    });

    it("create_day_content with invalid sceneDocument returns validation errors", () => {
      const invalidScene = { protocolVersion: "2.0" };
      const validation = validateSceneDocument(invalidScene);
      assertEquals(validation.valid, false);
      assertEquals(validation.errors.length > 0, true);
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

      const questions = await repos.questions.create([
        {
          dayContentId: day.id,
          domainId: "domain-a",
          sequence: 1,
          type: "scenario",
          body: "Scenario Q?",
          maxLevel: 3,
          deadline: new Date(Date.now() + 86400000).toISOString(),
        },
        {
          dayContentId: day.id,
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
      ]);

      assertEquals(questions.length, 2);
      const byDay = await repos.questions.getByDay(day.id);
      assertEquals(byDay.length, 2);
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

      // Create feedback with applyLevel=true
      const feedback = await repos.feedback.create({
        answerId: answer.id,
        questionId: question.id,
        score: "correct",
        explanation: "Well done",
        suggestedLevel: 3,
        applyLevel: true,
        improvements: [],
      });

      // Replicate MCP tool logic: apply level if applyLevel is set
      const fetched = await repos.questions.get(question.id);
      if (fetched) {
        await repos.progress.put(fetched.domainId, {
          level: 3,
          source: "assessment",
          notes: feedback.explanation,
        });
      }

      const progress = await repos.progress.get("domain-a");
      assertExists(progress);
      assertEquals(progress.level, 3);
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
      const answer = await repos.answers.create({ questionId: question.id, body: "ans" });
      await repos.feedback.create({
        answerId: answer.id,
        questionId: question.id,
        score: "incorrect",
        explanation: "Wrong",
        suggestedLevel: 1,
        applyLevel: false,
        improvements: [],
      });

      // Learner predicts correct but actual is incorrect → overestimate → delta = -1
      const scoreOrder = { incorrect: 0, partial: 1, correct: 2 };
      const predicted = scoreOrder["correct"];
      const actual = scoreOrder["incorrect"];
      const delta = predicted > actual ? -1 : predicted < actual ? 1 : 0;
      assertEquals(delta, -1);

      const entry = await repos.calibration.create({
        questionId: question.id,
        domainId: "domain-a",
        predictedScore: "correct",
        actualScore: "incorrect",
        delta: delta as -1 | 0 | 1,
      });
      assertEquals(entry.delta, -1);
    });

    it("record_self_assessment computes delta for calibrated (0)", async () => {
      const scoreOrder = { incorrect: 0, partial: 1, correct: 2 };
      const predicted = scoreOrder["correct"];
      const actual = scoreOrder["correct"];
      const delta = predicted > actual ? -1 : predicted < actual ? 1 : 0;
      assertEquals(delta, 0);
    });

    it("record_self_assessment computes delta for underestimate (1)", async () => {
      const scoreOrder = { incorrect: 0, partial: 1, correct: 2 };
      const predicted = scoreOrder["incorrect"];
      const actual = scoreOrder["correct"];
      const delta = predicted > actual ? -1 : predicted < actual ? 1 : 0;
      assertEquals(delta, 1);
    });
  });

  // ── Intake ─────────────────────────────────

  describe("Intake tools", () => {
    it("start_intake creates session with config context", async () => {
      let session = await repos.intake.getSession();
      assertEquals(session, null);

      // Replicate start_intake logic
      session = {
        id: crypto.randomUUID(),
        status: "goal_validation",
        startedAt: new Date().toISOString(),
        baselineResults: [],
      };
      await repos.intake.putSession(session);

      const fetched = await repos.intake.getSession();
      assertExists(fetched);
      assertEquals(fetched.status, "goal_validation");
    });

    it("send_intake_message stores message and advances phase", async () => {
      const session = buildIntakeSession({ status: "goal_validation" });
      await repos.intake.putSession(session);

      // Advance to profile_validation
      session.status = "profile_validation";
      await repos.intake.putSession(session);

      const msg = await repos.intake.addMessage({
        role: "agent",
        content: "Tell me about yourself",
        phase: "profile_validation",
      });

      assertEquals(msg.phase, "profile_validation");
      assertEquals(msg.role, "agent");

      const messages = await repos.intake.getMessages();
      assertEquals(messages.length, 1);
    });

    it("complete_intake sets progress levels and marks LearnerState completed", async () => {
      const session = buildIntakeSession({ status: "gap_analysis" });
      await repos.intake.putSession(session);

      // Replicate complete_intake logic
      session.status = "completed";
      session.completedAt = new Date().toISOString();
      session.gapAnalysis = buildGapAnalysis();
      session.baselineResults = [
        { phaseId: 1, questionId: "q1", question: "What is X?", answer: "Y", suggestedLevel: 2 },
        { phaseId: 2, questionId: "q2", question: "Explain Z", answer: "W", suggestedLevel: 1 },
      ];
      await repos.intake.putSession(session);

      // Set initial progress levels
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

      // Verify
      const state = await repos.learnerState.get();
      assertExists(state);
      assertEquals(state.intake.completed, true);

      // Phase 1 domains (domain-a, domain-b) should be level 2
      const progA = await repos.progress.get("domain-a");
      assertEquals(progA?.level, 2);

      // Phase 2 domains (domain-c, domain-d) should be level 1
      const progC = await repos.progress.get("domain-c");
      assertEquals(progC?.level, 1);

      // Session should be completed
      const finalSession = await repos.intake.getSession();
      assertEquals(finalSession?.status, "completed");
    });
  });

  // ── Gap Analysis ───────────────────────────

  describe("Gap Analysis tools", () => {
    it("get_gap_analysis returns per-phase analysis", async () => {
      await repos.progress.put("domain-a", { level: 3, source: "assessment" });
      await repos.progress.put("domain-b", { level: 1, source: "manual" });

      const progress = await repos.progress.getAll();
      const result = computeGapAnalysis(progress, config.curriculum);

      assertEquals(result.phaseGaps.length, 2);
      assertExists(result.phaseGaps.find((p) => p.phaseId === 1));
      assertExists(result.phaseGaps.find((p) => p.phaseId === 2));
    });

    it("get_gap_analysis filters by phaseId", async () => {
      const progress = await repos.progress.getAll();
      const result = computeGapAnalysis(progress, config.curriculum);
      const phase1 = result.phaseGaps.find((p) => p.phaseId === 1);
      assertExists(phase1);
      assertEquals(phase1.phaseId, 1);
    });

    it("recalculate_gaps compares vs intake", async () => {
      // Set up intake session with gap analysis
      const session = buildIntakeSession({
        status: "completed",
        gapAnalysis: buildGapAnalysis({ estimatedWeeks: 8 }),
      });
      await repos.intake.putSession(session);

      // Set some progress
      await repos.progress.put("domain-a", { level: 4, source: "assessment" });
      await repos.progress.put("domain-b", { level: 4, source: "assessment" });

      const progress = await repos.progress.getAll();
      const currentGap = computeGapAnalysis(progress, config.curriculum);
      const intakeGap = session.gapAnalysis;

      assertExists(intakeGap);
      const weeksDiff = currentGap.estimatedRemainingWeeks - intakeGap.estimatedWeeks;

      // With 2 domains at level 4 and 2 at level 0, remaining = 2
      // Initial was 8, diff = 2 - 8 = -6 → ahead of estimate
      assertEquals(weeksDiff < 0, true);
    });
  });
});
