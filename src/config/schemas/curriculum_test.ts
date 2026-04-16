import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { CurriculumConfigSchema } from "./curriculum.ts";

const validMinimal = {
  meta: {
    id: "test",
    name: "Test",
    version: "1.0.0",
    description: "Test curriculum",
    estimated_weeks: 4,
    language: "en",
  },
  bridge: {
    from: {
      label: "Beginner",
      concepts: ["basics"],
      proficiency: "beginner",
    },
    to: {
      label: "Advanced",
      concepts: ["advanced"],
      proficiency: "advanced",
    },
  },
  levels: [
    {
      id: 0,
      label: "Unknown",
      description: "Not started",
      assessment_type: null,
    },
  ],
  phases: [
    {
      id: 1,
      name: "Phase 1",
      description: "First phase",
      bridge: {
        from: { label: "Start", concepts: ["a"], proficiency: "none" },
        to: { label: "End", concepts: ["b"], proficiency: "intermediate" },
      },
    },
  ],
  domains: [
    {
      id: "domain-1",
      name: "Domain 1",
      phase: 1,
      week: 1,
      tags: ["tag"],
      prerequisites: [],
      bridge: {
        from: { label: "Old", concepts: ["x"], proficiency: "expert" },
        to: { label: "New", concepts: ["y"], proficiency: "intermediate" },
      },
      key_concepts: ["concept"],
      resources: [],
    },
  ],
  stretch: {
    frequency: 4,
    domains: [],
  },
};

describe("CurriculumConfigSchema", () => {
  it("should accept valid minimal config", () => {
    const result = CurriculumConfigSchema.safeParse(validMinimal);
    assertEquals(result.success, true);
  });

  it("should accept null bridge.from (blank slate)", () => {
    const blankSlate = {
      ...validMinimal,
      bridge: {
        from: null,
        to: validMinimal.bridge.to,
      },
    };
    const result = CurriculumConfigSchema.safeParse(blankSlate);
    assertEquals(result.success, true);
    if (result.success) {
      assertEquals(result.data.bridge.from, null);
    }
  });

  it("should reject invalid proficiency", () => {
    const invalid = {
      ...validMinimal,
      bridge: {
        from: {
          label: "test",
          concepts: [],
          proficiency: "godlike",
        },
        to: validMinimal.bridge.to,
      },
    };
    const result = CurriculumConfigSchema.safeParse(invalid);
    assertEquals(result.success, false);
  });

  it("should reject missing meta.id", () => {
    const { id: _, ...metaWithoutId } = validMinimal.meta;
    const invalid = { ...validMinimal, meta: metaWithoutId };
    const result = CurriculumConfigSchema.safeParse(invalid);
    assertEquals(result.success, false);
  });
});
