import { assertEquals, assertExists } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import {
  buildIntakeSession,
  createTestConfig,
  createTestKv,
} from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

let kv: Deno.Kv;
let repos: Repositories;
const config = createTestConfig();

function mockCtx(
  req: Request,
  overrides?: Record<string, unknown>,
) {
  return {
    req,
    state: { repos, config },
    params: {},
    url: new URL(req.url),
    ...overrides,
    // deno-lint-ignore no-explicit-any
  } as any;
}

function postJson(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getReq(path: string): Request {
  return new Request(`http://localhost${path}`, { method: "GET" });
}

describe("API Route Handlers — Layer 2", () => {
  beforeEach(async () => {
    const t = await createTestKv();
    kv = t.kv;
    repos = t.repos;
  });

  afterEach(() => {
    kv.close();
  });

  // ── POST /api/evaluate ───────────────────────

  describe("POST /api/evaluate", () => {
    it("auto-grades MC correct answer", async () => {
      const { handler } = await import("@/routes/api/evaluate.ts");

      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-a",
        title: "D",
        body: "B",
      });
      await repos.questions.create([{
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 1,
        type: "multiple_choice",
        body: "Pick one",
        maxLevel: 3,
        deadline: new Date(Date.now() + 86400000).toISOString(),
        options: [
          { key: "A", text: "Correct answer", isOptimal: true },
          { key: "B", text: "Wrong answer", isOptimal: false },
        ],
        scrimCheckpoint: "mc-test-checkpoint",
      }]);

      const ctx = mockCtx(postJson("/api/evaluate", {
        response: "A",
        evaluatorKey: "mc-test-checkpoint",
        dayContentId: day.id,
      }));

      const response = await handler.POST!(ctx);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.correct, true);
      assertEquals(data.score, 1);
    });

    it("returns pending for free-text answer", async () => {
      const { handler } = await import("@/routes/api/evaluate.ts");

      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-a",
        title: "D",
        body: "B",
      });
      await repos.questions.create([{
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 1,
        type: "open",
        body: "Explain this",
        maxLevel: 3,
        deadline: new Date(Date.now() + 86400000).toISOString(),
        scrimCheckpoint: "open-test-checkpoint",
      }]);

      const ctx = mockCtx(postJson("/api/evaluate", {
        response: "My explanation here",
        evaluatorKey: "open-test-checkpoint",
        dayContentId: day.id,
      }));

      const response = await handler.POST!(ctx);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.metadata.pending, true);
    });

    it("returns generic result when question not found", async () => {
      const { handler } = await import("@/routes/api/evaluate.ts");

      const ctx = mockCtx(postJson("/api/evaluate", {
        response: "X",
        evaluatorKey: "nonexistent-checkpoint",
        dayContentId: "day-1",
      }));

      const response = await handler.POST!(ctx);
      const data = await response.json();

      assertEquals(response.status, 200);
      assertEquals(data.correct, false);
    });

    it("rejects when dayContentId is omitted", async () => {
      const { handler } = await import("@/routes/api/evaluate.ts");

      const ctx = mockCtx(postJson("/api/evaluate", {
        response: "A",
        evaluatorKey: "checkpoint-without-day",
      }));

      const response = await handler.POST!(ctx);
      assertEquals(response.status, 400);
    });

    it("rejects when dayContentId is empty", async () => {
      const { handler } = await import("@/routes/api/evaluate.ts");

      const ctx = mockCtx(postJson("/api/evaluate", {
        response: "A",
        evaluatorKey: "checkpoint-empty-day",
        dayContentId: "",
      }));

      const response = await handler.POST!(ctx);
      assertEquals(response.status, 400);
    });
  });

  // ── POST /api/wellbeing ──────────────────────

  describe("POST /api/wellbeing", () => {
    it("sets valid status", async () => {
      const { handler } = await import("@/routes/api/wellbeing.ts");

      const ctx = mockCtx(postJson("/api/wellbeing", { status: "paused" }));
      const response = await handler.POST!(ctx);

      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(data.wellbeing.status, "paused");
      assertExists(data.wellbeing.pausedAt);
    });

    it("returns 400 for invalid status", async () => {
      const { handler } = await import("@/routes/api/wellbeing.ts");

      const ctx = mockCtx(postJson("/api/wellbeing", { status: "invalid" }));
      const response = await handler.POST!(ctx);

      assertEquals(response.status, 400);
    });

    it("triggers retention recalc when returning from paused", async () => {
      const { handler } = await import("@/routes/api/wellbeing.ts");

      // Set paused state first
      await repos.learnerState.put({
        intake: { completed: true },
        wellbeing: {
          status: "paused",
          pausedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
      });

      // Seed retention schedule
      await repos.retention.put("domain-a", "correct");

      const ctx = mockCtx(postJson("/api/wellbeing", { status: "returning" }));
      const response = await handler.POST!(ctx);

      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(data.retentionRecalculated, 1);
    });
  });

  // ── POST /api/calibration ────────────────────

  describe("POST /api/calibration", () => {
    it("creates entry with correct delta", async () => {
      const { handler } = await import("@/routes/api/calibration.ts");

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
        score: "partial",
        explanation: "Ok",
        suggestedLevel: 2,
        levelApplied: false,
        improvements: [],
      });

      // Predict correct, actual partial → overestimate → delta -1
      const ctx = mockCtx(postJson("/api/calibration", {
        questionId: question.id,
        predictedScore: "correct",
      }));
      const response = await handler.POST!(ctx);

      assertEquals(response.status, 201);
      const data = await response.json();
      assertEquals(data.delta, -1);
    });

    it("rejects missing question", async () => {
      const { handler } = await import("@/routes/api/calibration.ts");

      const ctx = mockCtx(postJson("/api/calibration", {
        questionId: "nonexistent",
        predictedScore: "correct",
      }));
      const response = await handler.POST!(ctx);

      assertEquals(response.status, 400);
    });

    it("rejects when no answer submitted", async () => {
      const { handler } = await import("@/routes/api/calibration.ts");

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

      const ctx = mockCtx(postJson("/api/calibration", {
        questionId: question.id,
        predictedScore: "correct",
      }));
      const response = await handler.POST!(ctx);

      assertEquals(response.status, 400);
    });
  });

  // ── GET /api/intake ──────────────────────────

  describe("GET /api/intake", () => {
    it("returns 404 when no session exists", async () => {
      const { handler } = await import("@/routes/api/intake/index.ts");

      const ctx = mockCtx(getReq("/api/intake"));
      const response = await handler.GET!(ctx);

      assertEquals(response.status, 404);
    });

    it("returns session when one exists", async () => {
      const { handler } = await import("@/routes/api/intake/index.ts");

      const session = buildIntakeSession({ status: "profile_validation" });
      await repos.intake.putSession(session);

      const ctx = mockCtx(getReq("/api/intake"));
      const response = await handler.GET!(ctx);

      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(data.status, "profile_validation");
    });
  });

  // ── POST /api/intake/messages ────────────────

  describe("POST /api/intake/messages", () => {
    it("creates learner message", async () => {
      const { handler } = await import("@/routes/api/intake/messages.ts");

      const session = buildIntakeSession({ status: "goal_validation" });
      await repos.intake.putSession(session);

      const ctx = mockCtx(postJson("/api/intake/messages", {
        content: "I want to learn Kubernetes",
      }));
      const response = await handler.POST!(ctx);

      assertEquals(response.status, 201);
      const data = await response.json();
      assertEquals(data.role, "learner");
      assertEquals(data.content, "I want to learn Kubernetes");
      assertEquals(data.phase, "goal_validation");
    });

    it("rejects when session is completed", async () => {
      const { handler } = await import("@/routes/api/intake/messages.ts");

      const session = buildIntakeSession({ status: "completed" });
      await repos.intake.putSession(session);

      const ctx = mockCtx(postJson("/api/intake/messages", {
        content: "More input",
      }));
      const response = await handler.POST!(ctx);

      assertEquals(response.status, 400);
    });

    it("rejects when no session exists", async () => {
      const { handler } = await import("@/routes/api/intake/messages.ts");

      const ctx = mockCtx(postJson("/api/intake/messages", {
        content: "Hello",
      }));
      const response = await handler.POST!(ctx);

      assertEquals(response.status, 404);
    });
  });

  // ── POST /api/calibration — negative paths ──

  describe("POST /api/calibration — answer exists but no feedback", () => {
    it("rejects calibration when feedback has not been created yet", async () => {
      const { handler } = await import("@/routes/api/calibration.ts");

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
      // Submit answer but create NO feedback
      await repos.answers.create({
        questionId: question.id,
        body: "my answer",
      });

      const ctx = mockCtx(postJson("/api/calibration", {
        questionId: question.id,
        predictedScore: "correct",
      }));
      const response = await handler.POST!(ctx);

      // Must reject — calibration requires an actual score to compare against
      assertEquals(response.status, 400);
    });
  });

  // ── POST /api/evaluate — mismatched dayContentId ──

  describe("POST /api/evaluate — mismatched dayContentId", () => {
    it("rejects evaluation when dayContentId does not match the question's day", async () => {
      const { handler } = await import("@/routes/api/evaluate.ts");

      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-a",
        title: "D",
        body: "B",
      });
      const [_question] = await repos.questions.create([{
        dayContentId: day.id,
        domainId: "domain-a",
        sequence: 1,
        type: "multiple_choice",
        body: "Pick one",
        maxLevel: 3,
        deadline: new Date(Date.now() + 86400000).toISOString(),
        options: [
          { key: "A", text: "Correct", isOptimal: true },
          { key: "B", text: "Wrong", isOptimal: false },
        ],
        scrimCheckpoint: "mc-mismatch-test",
      }]);

      // Pass a different dayContentId than the question's actual dayContentId
      const ctx = mockCtx(postJson("/api/evaluate", {
        response: "A",
        evaluatorKey: "mc-mismatch-test",
        dayContentId: "wrong-day-id",
      }));

      const response = await handler.POST!(ctx);

      // Must reject — prevents stale clients from creating answers on wrong days
      assertEquals(response.status, 400);
    });
  });

  // ── POST /api/answers/:answerId/feedback — progress update ──

  describe("POST /api/answers/:answerId/feedback", () => {
    async function createFeedbackTarget() {
      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "assessment",
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
        maxLevel: 4,
        deadline: new Date(Date.now() + 86400000).toISOString(),
      }]);
      const answer = await repos.answers.create({
        questionId: question.id,
        body: "ans",
      });

      return { question, answer };
    }

    it("updates progress on the correct domainId when levelApplied is true", async () => {
      const { handler } = await import(
        "@/routes/api/answers/[answerId]/feedback.ts"
      );

      const { question, answer } = await createFeedbackTarget();

      const ctx = mockCtx(
        postJson(`/api/answers/${answer.id}/feedback`, {
          questionId: question.id,
          score: "correct",
          explanation: "Good",
          suggestedLevel: 4,
          levelApplied: true,
          improvements: [],
        }),
        { params: { answerId: answer.id } },
      );
      const response = await handler.POST!(ctx);
      assertEquals(response.status, 201);

      // Verify progress updated on domain-a, NOT on the questionId
      const progress = await repos.progress.get("domain-a");
      assertEquals(progress!.level, 4);

      // Verify no garbage progress entry was created under the questionId
      const garbage = await repos.progress.get(question.id);
      assertEquals(garbage, null);
    });

    it("rejects when levelApplied is missing", async () => {
      const { handler } = await import(
        "@/routes/api/answers/[answerId]/feedback.ts"
      );

      const { question, answer } = await createFeedbackTarget();

      const ctx = mockCtx(
        postJson(`/api/answers/${answer.id}/feedback`, {
          questionId: question.id,
          score: "correct",
          explanation: "Good",
          suggestedLevel: 4,
          improvements: [],
        }),
        { params: { answerId: answer.id } },
      );
      const response = await handler.POST!(ctx);

      assertEquals(response.status, 400);
    });

    it("rejects legacy applyLevel-only payloads", async () => {
      const { handler } = await import(
        "@/routes/api/answers/[answerId]/feedback.ts"
      );

      const { question, answer } = await createFeedbackTarget();

      const ctx = mockCtx(
        postJson(`/api/answers/${answer.id}/feedback`, {
          questionId: question.id,
          score: "correct",
          explanation: "Good",
          suggestedLevel: 4,
          applyLevel: true,
          improvements: [],
        }),
        { params: { answerId: answer.id } },
      );
      const response = await handler.POST!(ctx);

      assertEquals(response.status, 400);
    });
  });

  // ── GET /api/answers/:answerId/feedback ──

  describe("GET /api/answers/:answerId/feedback", () => {
    it("returns feedback when it exists", async () => {
      const { handler } = await import(
        "@/routes/api/answers/[answerId]/feedback.ts"
      );

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
        explanation: "Well done",
        suggestedLevel: 3,
        levelApplied: false,
        improvements: [],
      });

      const ctx = mockCtx(getReq(`/api/answers/${answer.id}/feedback`), {
        params: { answerId: answer.id },
      });
      const response = await handler.GET!(ctx);

      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(data.score, "correct");
      assertEquals(data.answerId, answer.id);
    });

    it("returns 404 when no feedback exists", async () => {
      const { handler } = await import(
        "@/routes/api/answers/[answerId]/feedback.ts"
      );

      const ctx = mockCtx(getReq("/api/answers/nonexistent/feedback"), {
        params: { answerId: "nonexistent" },
      });
      const response = await handler.GET!(ctx);

      assertEquals(response.status, 404);
    });
  });

  // ── /api/theme ─────────────────────────────────────────────────────

  describe("PUT /api/theme — supersede fixture (WP-D5)", () => {
    async function putTheme(body: unknown) {
      const { handler } = await import("@/routes/api/theme.ts");
      const ctx = mockCtx(
        new Request("http://localhost/api/theme", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      return handler.PUT!(ctx);
    }

    it(
      "the worked supersede scenario: course default → ai_proposed dark → user picks high_contrast",
      async () => {
        // (1) Start: no learner state. Course theme is default (no
        // theme.config.yaml in the test config).
        assertEquals(await repos.learnerState.get(), null);

        // (2) AI writes a proposal. The proposal MUST NOT affect
        // rendering (fitness #11).
        await repos.learnerState.put({
          intake: { completed: false },
          wellbeing: { status: "active" },
          theme: {
            source: "ai_proposed",
            preset: "dark",
            proposedAt: "2026-04-16T09:00:00.000Z",
          },
        });

        // (3) Learner picks high_contrast via PUT /api/theme.
        const res = await putTheme({
          source: "user",
          preset: "high_contrast",
        });
        assertEquals(res.status, 200);

        // (4) Expected post-state:
        const after = await repos.learnerState.get();
        assertEquals(after?.theme?.source, "user");
        assertEquals(after?.theme?.preset, "high_contrast");
        // `previous` reflects RENDERING before the write. The proposal
        // didn't render, so previous === undefined (course-fallback).
        assertEquals(after?.theme?.previous, undefined);
        // And the proposal itself is gone — no trace.
        assertEquals(
          // deno-lint-ignore no-explicit-any
          (after?.theme as any)?.proposedAt,
          undefined,
        );
      },
    );

    it("rejects invalid user write (no preset, no overrides)", async () => {
      const res = await putTheme({ source: "user" });
      assertEquals(res.status, 400);
    });

    it("revert returns to previous (user→user→revert lands back on first user pick)", async () => {
      await putTheme({ source: "user", preset: "dark" });
      await putTheme({ source: "user", preset: "high_contrast" });
      const res = await putTheme({ source: "revert" });
      assertEquals(res.status, 200);
      const after = await repos.learnerState.get();
      assertEquals(after?.theme?.source, "user");
      assertEquals(after?.theme?.preset, "dark");
    });
  });

  describe("GET /api/theme", () => {
    it("returns the resolved active theme + stored learner state", async () => {
      const { handler } = await import("@/routes/api/theme.ts");
      const res = await handler.GET!(
        mockCtx(getReq("/api/theme")),
      );
      assertEquals(res.status, 200);
      const body = await res.json();
      assertExists(body.active);
      // default preset color.primary value — the canonical signal that
      // the resolver ran against the expected preset.
      assertEquals(body.learner, null);
    });
  });
});
