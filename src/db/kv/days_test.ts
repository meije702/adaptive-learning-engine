import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { createTestKv } from "@/test_helpers.ts";
import type { Repositories } from "@/db/repositories.ts";

describe("KvDayRepository", () => {
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
    it("should create day content with a generated id and createdAt", async () => {
      const day = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-a",
        title: "Introduction to Containers",
        body: "Containers are lightweight...",
      });

      assertNotEquals(day.id, undefined);
      assertEquals(day.weekNumber, 1);
      assertEquals(day.dayOfWeek, 1);
      assertEquals(day.type, "theory");
      assertEquals(day.domainId, "domain-a");
      assertEquals(day.title, "Introduction to Containers");
      assertNotEquals(day.createdAt, undefined);
    });
  });

  describe("get", () => {
    it("should return null for non-existent day", async () => {
      const result = await repos.days.get(1, 1);
      assertEquals(result, null);
    });

    it("should return day content by week number and day of week", async () => {
      await repos.days.create({
        weekNumber: 2,
        dayOfWeek: 3,
        type: "practice_guided",
        domainId: "domain-b",
        title: "Guided Practice",
        body: "Try the following...",
      });

      const fetched = await repos.days.get(2, 3);
      assertNotEquals(fetched, null);
      assertEquals(fetched!.weekNumber, 2);
      assertEquals(fetched!.dayOfWeek, 3);
      assertEquals(fetched!.type, "practice_guided");
    });
  });

  describe("getById", () => {
    it("should return null for non-existent id", async () => {
      const result = await repos.days.getById("nonexistent-id");
      assertEquals(result, null);
    });

    it("should return day content by its id", async () => {
      const created = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 2,
        type: "theory",
        domainId: "domain-a",
        title: "Theory Day",
        body: "Content here",
      });

      const fetched = await repos.days.getById(created.id);
      assertNotEquals(fetched, null);
      assertEquals(fetched!.id, created.id);
      assertEquals(fetched!.title, "Theory Day");
    });
  });

  describe("getByWeek", () => {
    it("should return an empty array when no days exist for the week", async () => {
      const days = await repos.days.getByWeek(5);
      assertEquals(days.length, 0);
    });

    it("should return all days for a given week", async () => {
      await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-a",
        title: "Day 1",
        body: "Content 1",
      });
      await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 2,
        type: "practice_guided",
        domainId: "domain-a",
        title: "Day 2",
        body: "Content 2",
      });
      await repos.days.create({
        weekNumber: 2,
        dayOfWeek: 1,
        type: "theory",
        domainId: "domain-b",
        title: "Week 2 Day 1",
        body: "Different week",
      });

      const week1Days = await repos.days.getByWeek(1);
      assertEquals(week1Days.length, 2);

      const week2Days = await repos.days.getByWeek(2);
      assertEquals(week2Days.length, 1);
    });
  });

  describe("getToday", () => {
    it("should return null when today is not an active day", async () => {
      // Use an empty active days array to guarantee today is inactive
      const result = await repos.days.getToday([], {});
      assertEquals(result, null);
    });

    it("should return the day content for today when it exists", async () => {
      const today = new Date().getDay(); // 0=Sun through 6=Sat

      // Create a week so getToday can find the current week
      await repos.weeks.create({
        weekNumber: 1,
        domainId: "domain-a",
        isStretchWeek: false,
        summary: "Current week",
      });

      // Create day content for today's day-of-week
      await repos.days.create({
        weekNumber: 1,
        dayOfWeek: today as 1 | 2 | 3 | 4 | 5 | 6,
        type: "theory",
        domainId: "domain-a",
        title: "Today's content",
        body: "Content for today",
      });

      const result = await repos.days.getToday([today], {
        [String(today)]: "theory",
      });

      // If today is 0 (Sunday) and the dayOfWeek type is 1-6, this might be null
      // but we still test the logic path
      if (today >= 1 && today <= 6) {
        assertNotEquals(result, null);
        assertEquals(result!.title, "Today's content");
      }
    });
  });

  describe("sceneDocument storage", () => {
    it("should persist sceneDocument on day content", async () => {
      const sceneDoc = {
        scenes: [{ id: "scene-1", title: "Interactive Exercise" }],
        version: "1.0",
      };

      const created = await repos.days.create({
        weekNumber: 1,
        dayOfWeek: 4,
        type: "practice_open",
        domainId: "domain-a",
        title: "Interactive Day",
        body: "Work through the scrim",
        sceneDocument: sceneDoc,
      });

      assertEquals(created.sceneDocument, sceneDoc);

      const fetched = await repos.days.getById(created.id);
      assertNotEquals(fetched, null);
      assertEquals(fetched!.sceneDocument, sceneDoc);
    });
  });
});
