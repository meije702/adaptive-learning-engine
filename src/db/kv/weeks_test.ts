import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assertNotEquals, assertRejects } from "@std/assert";
import { createTestKv } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

describe("KvWeekRepository", () => {
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
    it("should create a week plan and return it with a createdAt timestamp", async () => {
      const plan = await repos.weeks.create({
        weekNumber: 1,
        domainId: "domain-a",
        isStretchWeek: false,
        summary: "Fundamentals week",
      });

      assertEquals(plan.weekNumber, 1);
      assertEquals(plan.domainId, "domain-a");
      assertEquals(plan.isStretchWeek, false);
      assertEquals(plan.summary, "Fundamentals week");
      assertNotEquals(plan.createdAt, undefined);
    });
  });

  describe("get", () => {
    it("should return null for a non-existent week", async () => {
      const result = await repos.weeks.get(99);
      assertEquals(result, null);
    });

    it("should return the week plan by week number", async () => {
      await repos.weeks.create({
        weekNumber: 3,
        domainId: "domain-b",
        isStretchWeek: true,
        summary: "Stretch week",
      });

      const fetched = await repos.weeks.get(3);
      assertNotEquals(fetched, null);
      assertEquals(fetched!.weekNumber, 3);
      assertEquals(fetched!.domainId, "domain-b");
      assertEquals(fetched!.isStretchWeek, true);
    });
  });

  describe("getAll", () => {
    it("should return an empty array when no weeks exist", async () => {
      const all = await repos.weeks.getAll();
      assertEquals(all.length, 0);
    });

    it("should return all created week plans", async () => {
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

      const all = await repos.weeks.getAll();
      assertEquals(all.length, 2);
    });
  });

  describe("addRetrospective", () => {
    it("should add a retrospective to an existing week plan", async () => {
      await repos.weeks.create({
        weekNumber: 1,
        domainId: "domain-a",
        isStretchWeek: false,
        summary: "Week 1",
      });

      const updated = await repos.weeks.addRetrospective(
        1,
        "Learner progressed well through RBAC concepts.",
      );

      assertEquals(updated.weekNumber, 1);
      assertEquals(
        updated.retrospective,
        "Learner progressed well through RBAC concepts.",
      );
    });

    it("should throw an error when the week does not exist", async () => {
      await assertRejects(
        () => repos.weeks.addRetrospective(999, "Some text"),
        Error,
        "WeekPlan 999 not found",
      );
    });
  });
});
