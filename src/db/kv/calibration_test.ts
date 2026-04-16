import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { createTestKv } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

describe("KvCalibrationRepository", () => {
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

  describe("create", () => {
    it("should create a calibration entry with generated id and createdAt", async () => {
      const entry = await repos.calibration.create({
        questionId: "q-1",
        domainId: "domain-a",
        predictedScore: "correct",
        actualScore: "partial",
        delta: -1,
      });

      assertNotEquals(entry.id, undefined);
      assertEquals(entry.questionId, "q-1");
      assertEquals(entry.domainId, "domain-a");
      assertEquals(entry.predictedScore, "correct");
      assertEquals(entry.actualScore, "partial");
      assertEquals(entry.delta, -1);
      assertNotEquals(entry.createdAt, undefined);
    });
  });

  describe("getByDomain", () => {
    it("should return entries for a specific domain", async () => {
      await repos.calibration.create({
        questionId: "q-1",
        domainId: "domain-a",
        predictedScore: "correct",
        actualScore: "correct",
        delta: 0,
      });
      await repos.calibration.create({
        questionId: "q-2",
        domainId: "domain-a",
        predictedScore: "partial",
        actualScore: "incorrect",
        delta: -1,
      });
      await repos.calibration.create({
        questionId: "q-3",
        domainId: "domain-b",
        predictedScore: "correct",
        actualScore: "correct",
        delta: 0,
      });

      const domainA = await repos.calibration.getByDomain("domain-a");
      assertEquals(domainA.length, 2);

      const domainB = await repos.calibration.getByDomain("domain-b");
      assertEquals(domainB.length, 1);
    });

    it("should return an empty array for a domain with no entries", async () => {
      const entries = await repos.calibration.getByDomain("nonexistent");
      assertEquals(entries.length, 0);
    });
  });

  describe("getRecent", () => {
    it("should return entries limited to the specified count", async () => {
      await repos.calibration.create({
        questionId: "q-1",
        domainId: "domain-a",
        predictedScore: "correct",
        actualScore: "correct",
        delta: 0,
      });
      await repos.calibration.create({
        questionId: "q-2",
        domainId: "domain-a",
        predictedScore: "partial",
        actualScore: "partial",
        delta: 0,
      });
      await repos.calibration.create({
        questionId: "q-3",
        domainId: "domain-b",
        predictedScore: "incorrect",
        actualScore: "incorrect",
        delta: 0,
      });

      const limited = await repos.calibration.getRecent(2);
      assertEquals(limited.length, 2);
    });

    it("should return all entries when limit exceeds total count", async () => {
      await repos.calibration.create({
        questionId: "q-1",
        domainId: "domain-a",
        predictedScore: "correct",
        actualScore: "correct",
        delta: 0,
      });

      const all = await repos.calibration.getRecent(100);
      assertEquals(all.length, 1);
    });
  });

  describe("getSummary", () => {
    it("should compute average delta per domain", async () => {
      // domain-a: deltas -1, 0, 1 => avg 0
      await repos.calibration.create({
        questionId: "q-1",
        domainId: "domain-a",
        predictedScore: "correct",
        actualScore: "partial",
        delta: -1,
      });
      await repos.calibration.create({
        questionId: "q-2",
        domainId: "domain-a",
        predictedScore: "correct",
        actualScore: "correct",
        delta: 0,
      });
      await repos.calibration.create({
        questionId: "q-3",
        domainId: "domain-a",
        predictedScore: "incorrect",
        actualScore: "correct",
        delta: 1,
      });

      // domain-b: delta -1 => avg -1
      await repos.calibration.create({
        questionId: "q-4",
        domainId: "domain-b",
        predictedScore: "correct",
        actualScore: "partial",
        delta: -1,
      });

      const summary = await repos.calibration.getSummary();
      assertEquals(summary.length, 2);

      const domainASummary = summary.find((
        s: { domainId: string; avgDelta: number; count: number },
      ) => s.domainId === "domain-a");
      assertNotEquals(domainASummary, undefined);
      assertEquals(domainASummary!.avgDelta, 0);
      assertEquals(domainASummary!.count, 3);

      const domainBSummary = summary.find((
        s: { domainId: string; avgDelta: number; count: number },
      ) => s.domainId === "domain-b");
      assertNotEquals(domainBSummary, undefined);
      assertEquals(domainBSummary!.avgDelta, -1);
      assertEquals(domainBSummary!.count, 1);
    });

    it("should return an empty array when no entries exist", async () => {
      const summary = await repos.calibration.getSummary();
      assertEquals(summary.length, 0);
    });
  });
});
