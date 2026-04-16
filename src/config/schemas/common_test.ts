import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { BridgeSchema, ProficiencySchema } from "./common.ts";

describe("ProficiencySchema", () => {
  it("should accept valid proficiency values", () => {
    for (
      const value of ["none", "beginner", "intermediate", "advanced", "expert"]
    ) {
      const result = ProficiencySchema.safeParse(value);
      assertEquals(result.success, true, `Expected "${value}" to be valid`);
    }
  });

  it("should reject invalid proficiency values", () => {
    for (const value of ["godlike", "master", "", "EXPERT", "None", 0, null]) {
      const result = ProficiencySchema.safeParse(value);
      assertEquals(result.success, false, `Expected "${value}" to be invalid`);
    }
  });
});

describe("BridgeSchema", () => {
  const validFrom = {
    label: "Existing Knowledge",
    concepts: ["docker", "linux"],
    proficiency: "advanced",
  };

  const validTo = {
    label: "Target Knowledge",
    concepts: ["kubernetes"],
    proficiency: "intermediate",
  };

  it("should accept a bridge with a valid from and to", () => {
    const result = BridgeSchema.safeParse({ from: validFrom, to: validTo });
    assertEquals(result.success, true);
  });

  it("should accept a bridge with null from (blank slate learner)", () => {
    const result = BridgeSchema.safeParse({ from: null, to: validTo });
    assertEquals(result.success, true);
    if (result.success) {
      assertEquals(result.data.from, null);
    }
  });

  it("should reject a bridge with null to", () => {
    const result = BridgeSchema.safeParse({ from: validFrom, to: null });
    assertEquals(result.success, false);
  });

  it("should reject a bridge missing the to field entirely", () => {
    const result = BridgeSchema.safeParse({ from: validFrom });
    assertEquals(result.success, false);
  });

  it("should reject a bridge with invalid proficiency in from", () => {
    const result = BridgeSchema.safeParse({
      from: { ...validFrom, proficiency: "godlike" },
      to: validTo,
    });
    assertEquals(result.success, false);
  });
});
