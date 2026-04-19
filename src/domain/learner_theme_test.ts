import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assertRejects } from "@std/assert";
import { createTestKv } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";
import type { LearnerState, LearnerTheme } from "@/db/types.ts";
import {
  computeNextLearnerTheme,
  LearnerThemeSchema,
  PreviousThemeSchema,
  renderSnapshotOf,
  resolveLearnerTheme,
  revertLearnerTheme,
} from "./learner_theme.ts";
import { ValidationError } from "./errors.ts";

const t0 = "2026-04-16T09:00:00.000Z";
const t1 = "2026-04-17T10:00:00.000Z";

// -- Fitness #9 -----------------------------------------------------------

describe("LearnerThemeSchema — fitness #9 provenance", () => {
  it("accepts a valid user theme (no timestamps required)", () => {
    const result = LearnerThemeSchema.safeParse({
      source: "user",
      preset: "dark",
    });
    assertEquals(result.success, true);
  });

  it("requires a preset OR overrides", () => {
    assertEquals(
      LearnerThemeSchema.safeParse({ source: "user" }).success,
      false,
    );
  });

  it("ai_proposed requires proposedAt", () => {
    assertEquals(
      LearnerThemeSchema.safeParse({ source: "ai_proposed", preset: "dark" })
        .success,
      false,
    );
    assertEquals(
      LearnerThemeSchema.safeParse({
        source: "ai_proposed",
        preset: "dark",
        proposedAt: t0,
      }).success,
      true,
    );
  });

  it("ai_accepted requires BOTH proposedAt AND acceptedAt", () => {
    assertEquals(
      LearnerThemeSchema.safeParse({
        source: "ai_accepted",
        preset: "dark",
        acceptedAt: t1,
      }).success,
      false,
      "missing proposedAt should fail",
    );
    assertEquals(
      LearnerThemeSchema.safeParse({
        source: "ai_accepted",
        preset: "dark",
        proposedAt: t0,
      }).success,
      false,
      "missing acceptedAt should fail",
    );
    assertEquals(
      LearnerThemeSchema.safeParse({
        source: "ai_accepted",
        preset: "dark",
        proposedAt: t0,
        acceptedAt: t1,
      }).success,
      true,
    );
  });

  it("PreviousThemeSchema has no `previous` field (no chain)", () => {
    assertEquals(
      PreviousThemeSchema.safeParse({
        source: "user",
        preset: "dark",
        previous: { source: "user", preset: "default" },
      }).success,
      false,
    );
  });

  it("rejects unknown keys", () => {
    assertEquals(
      LearnerThemeSchema.safeParse({
        source: "user",
        preset: "dark",
        bogus: true,
      }).success,
      false,
    );
  });
});

// -- Resolution (fitness #11 building block) ------------------------------

describe("resolveLearnerTheme — fitness #11 (ai_proposed doesn't render)", () => {
  it("returns undefined for null/missing state", () => {
    assertEquals(resolveLearnerTheme(null), undefined);
    assertEquals(resolveLearnerTheme({}), undefined);
    assertEquals(resolveLearnerTheme({ theme: undefined }), undefined);
  });

  it("returns undefined when source === ai_proposed (data, not rendering)", () => {
    const theme: LearnerTheme = {
      source: "ai_proposed",
      preset: "dark",
      proposedAt: t0,
    };
    assertEquals(resolveLearnerTheme({ theme }), undefined);
  });

  it("returns the theme for user and ai_accepted", () => {
    const user: LearnerTheme = { source: "user", preset: "dark" };
    assertEquals(resolveLearnerTheme({ theme: user })?.source, "user");

    const accepted: LearnerTheme = {
      source: "ai_accepted",
      preset: "dark",
      proposedAt: t0,
      acceptedAt: t1,
    };
    assertEquals(
      resolveLearnerTheme({ theme: accepted })?.source,
      "ai_accepted",
    );
  });
});

describe("renderSnapshotOf", () => {
  it("returns undefined when course is rendering (no learner override)", () => {
    assertEquals(renderSnapshotOf(undefined), undefined);
    assertEquals(renderSnapshotOf({}), undefined);
  });

  it("returns undefined when ai_proposed is stored (didn't render)", () => {
    const theme: LearnerTheme = {
      source: "ai_proposed",
      preset: "dark",
      proposedAt: t0,
    };
    assertEquals(renderSnapshotOf({ theme }), undefined);
  });

  it("snapshots a user pick as PreviousTheme (no nested previous)", () => {
    const theme: LearnerTheme = {
      source: "user",
      preset: "dark",
      previous: { source: "user", preset: "high_contrast" },
    };
    const snap = renderSnapshotOf({ theme });
    assertEquals(snap?.source, "user");
    assertEquals(snap?.preset, "dark");
    // snap is a PreviousTheme, not a LearnerTheme — no `previous` key.
    assertEquals(Object.keys(snap!).includes("previous"), false);
  });
});

// -- State machine (fitness #10) ------------------------------------------

describe("computeNextLearnerTheme — fitness #10 state machine", () => {
  it("user pick over undefined → previous is undefined (course-fallback)", () => {
    const next = computeNextLearnerTheme(undefined, {
      source: "user",
      preset: "dark",
    });
    assertEquals(next.source, "user");
    assertEquals(next.preset, "dark");
    assertEquals(next.previous, undefined);
  });

  it("SUPERSEDE: ai_proposed in slot, user picks → proposal gone, previous reflects course", () => {
    const existing: LearnerTheme = {
      source: "ai_proposed",
      preset: "dark",
      proposedAt: t0,
    };
    const next = computeNextLearnerTheme(existing, {
      source: "user",
      preset: "high_contrast",
    });
    // The proposal is replaced entirely.
    assertEquals(next.source, "user");
    assertEquals(next.preset, "high_contrast");
    // previous captures RENDERING before the write — proposals don't
    // render, so previous is undefined (course-fallback was rendering).
    assertEquals(next.previous, undefined);
  });

  it("user over user: previous captures the prior user pick", () => {
    const existing: LearnerTheme = { source: "user", preset: "dark" };
    const next = computeNextLearnerTheme(existing, {
      source: "user",
      preset: "high_contrast",
    });
    assertEquals(next.source, "user");
    assertEquals(next.preset, "high_contrast");
    assertEquals(next.previous?.source, "user");
    assertEquals(next.previous?.preset, "dark");
  });

  it("no-op user write: preserves existing previous", () => {
    const existing: LearnerTheme = {
      source: "user",
      preset: "dark",
      previous: { source: "user", preset: "high_contrast" },
    };
    const next = computeNextLearnerTheme(existing, {
      source: "user",
      preset: "dark",
    });
    // No-op ⇒ returns existing unchanged (in particular, previous survives).
    assertEquals(next, existing);
  });

  it("ai_proposed: sets proposedAt, no previous", () => {
    const next = computeNextLearnerTheme(undefined, {
      source: "ai_proposed",
      preset: "dark",
    }, t0);
    assertEquals(next.source, "ai_proposed");
    assertEquals(next.proposedAt, t0);
    assertEquals(next.previous, undefined);
  });

  it("ai_accepted: persists proposedAt, sets acceptedAt, previous from render", () => {
    const existing: LearnerTheme = {
      source: "ai_proposed",
      preset: "dark",
      proposedAt: t0,
    };
    const next = computeNextLearnerTheme(
      existing,
      { source: "ai_accepted", preset: "dark" },
      t1,
    );
    assertEquals(next.source, "ai_accepted");
    assertEquals(next.proposedAt, t0, "original proposedAt persists");
    assertEquals(next.acceptedAt, t1);
    // Previous captures pre-proposal render; ai_proposed didn't render,
    // so previous stays undefined (course-fallback was rendering).
    assertEquals(next.previous, undefined);
  });

  it("ai_accepted over an existing user pick: previous = that user pick", () => {
    const existing: LearnerTheme = {
      source: "user",
      preset: "high_contrast",
    };
    const next = computeNextLearnerTheme(
      existing,
      { source: "ai_accepted", preset: "dark", proposedAt: t0 },
      t1,
    );
    assertEquals(next.source, "ai_accepted");
    assertEquals(next.previous?.source, "user");
    assertEquals(next.previous?.preset, "high_contrast");
  });
});

// -- Revert ---------------------------------------------------------------

describe("revertLearnerTheme", () => {
  it("undefined when there's no existing state", () => {
    assertEquals(revertLearnerTheme(undefined), undefined);
  });

  it("undefined when there's no previous (revert returns to course)", () => {
    const existing: LearnerTheme = { source: "user", preset: "dark" };
    assertEquals(revertLearnerTheme(existing), undefined);
  });

  it("promotes `previous` to the active theme, dropping its own previous", () => {
    const existing: LearnerTheme = {
      source: "user",
      preset: "dark",
      previous: { source: "user", preset: "high_contrast" },
    };
    const next = revertLearnerTheme(existing);
    assertEquals(next?.source, "user");
    assertEquals(next?.preset, "high_contrast");
    assertEquals(next?.previous, undefined);
  });
});

// -- Repo write guard -----------------------------------------------------

describe("KvLearnerStateRepository.put — schema enforcement", () => {
  let kv: Deno.Kv;
  let repos: Repositories;

  beforeEach(async () => {
    const t = await createTestKv();
    kv = t.kv;
    repos = t.repos;
  });
  afterEach(() => kv.close());

  it("persists a valid user theme", async () => {
    const state: LearnerState = {
      intake: { completed: false },
      wellbeing: { status: "active" },
      theme: { source: "user", preset: "dark" },
    };
    await repos.learnerState.put(state);
    const roundtrip = await repos.learnerState.get();
    assertEquals(roundtrip?.theme?.source, "user");
  });

  it("rejects a theme that violates provenance invariants", async () => {
    const state: LearnerState = {
      intake: { completed: false },
      wellbeing: { status: "active" },
      // ai_accepted missing both timestamps.
      theme: {
        source: "ai_accepted",
        preset: "dark",
      } as unknown as LearnerTheme,
    };
    await assertRejects(
      () => repos.learnerState.put(state),
      ValidationError,
    );
  });

  it("allows writes without any theme", async () => {
    const state: LearnerState = {
      intake: { completed: false },
      wellbeing: { status: "active" },
    };
    await repos.learnerState.put(state);
    const roundtrip = await repos.learnerState.get();
    assertEquals(roundtrip?.theme, undefined);
  });
});
