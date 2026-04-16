import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "@std/testing/bdd";
import { computeGapAnalysis } from "./gap.ts";
import { buildProgress, createTestConfig } from "@/test_helpers.ts";

const config = createTestConfig();

describe("computeGapAnalysis", () => {
  // ── Gap sizes ────────────────────────────────

  describe("gap sizes", () => {
    it("returns very_large when all domains are at level 0", () => {
      const result = computeGapAnalysis([], config.curriculum);
      for (const phase of result.phaseGaps) {
        assertEquals(phase.gapSize, "very_large");
      }
    });

    it("returns small when all domains are at level 3+", () => {
      const progress = config.curriculum.domains.map((d) =>
        buildProgress({ domainId: d.id, level: 4 })
      );
      const result = computeGapAnalysis(progress, config.curriculum);
      for (const phase of result.phaseGaps) {
        assertEquals(phase.gapSize, "small");
      }
    });

    it("returns moderate for average level 2", () => {
      const progress = config.curriculum.domains.map((d) =>
        buildProgress({ domainId: d.id, level: 2 })
      );
      const result = computeGapAnalysis(progress, config.curriculum);
      for (const phase of result.phaseGaps) {
        assertEquals(phase.gapSize, "moderate");
      }
    });

    it("returns large for average level 1", () => {
      const progress = config.curriculum.domains.map((d) =>
        buildProgress({ domainId: d.id, level: 1 })
      );
      const result = computeGapAnalysis(progress, config.curriculum);
      for (const phase of result.phaseGaps) {
        assertEquals(phase.gapSize, "large");
      }
    });
  });

  // ── Strategy selection ───────────────────────

  describe("strategy selection", () => {
    it("selects first_principles when bridge.from is null", () => {
      // Phase 2 has domain-c with bridge.from = null
      const progress = config.curriculum.domains.map((d) =>
        buildProgress({ domainId: d.id, level: 0 })
      );
      const result = computeGapAnalysis(progress, config.curriculum);
      // Phase 2 bridge.from has proficiency "intermediate", but domain-c bridge.from is null
      // The phase bridge from is "intermediate", so it won't be first_principles
      // We need a config where the phase bridge.from is null
      // Actually, looking at code: it uses phase.bridge.from, not domain.bridge.from
      // Phase 2 bridge.from has proficiency "intermediate" — so it won't be null
      // Let's use a custom config with null phase bridge
      const customConfig = structuredClone(config.curriculum);
      customConfig.phases[1].bridge.from = null;
      const result2 = computeGapAnalysis(progress, customConfig);
      const phase2 = result2.phaseGaps.find((p) => p.phaseId === 2);
      assertEquals(phase2?.strategy, "first_principles");
    });

    it("selects scaffolded for large gaps", () => {
      // All at level 0 → gap = 4 (very_large) → scaffolded (unless bridge.from is null)
      const progress = config.curriculum.domains.map((d) =>
        buildProgress({ domainId: d.id, level: 0 })
      );
      const result = computeGapAnalysis(progress, config.curriculum);
      // Phase 1 bridge.from.proficiency = "expert", gap = very_large → scaffolded
      const phase1 = result.phaseGaps.find((p) => p.phaseId === 1);
      assertEquals(phase1?.strategy, "scaffolded");
    });

    it("selects accelerated for expert + small gap", () => {
      // Phase 1 bridge.from.proficiency = "expert"
      // Need small gap: all domains at level 3+ (avg >= 3, gap <= 1)
      const progress = config.curriculum.domains
        .filter((d) => d.phase === 1)
        .map((d) => buildProgress({ domainId: d.id, level: 4 }));
      // Also add phase 2 domains so they don't interfere
      const allProgress = [
        ...progress,
        ...config.curriculum.domains
          .filter((d) => d.phase === 2)
          .map((d) => buildProgress({ domainId: d.id, level: 4 })),
      ];
      const result = computeGapAnalysis(allProgress, config.curriculum);
      const phase1 = result.phaseGaps.find((p) => p.phaseId === 1);
      assertEquals(phase1?.strategy, "accelerated");
    });

    it("selects analogy for expert/advanced proficiency with moderate gap", () => {
      // Phase 1 bridge.from.proficiency = "expert", moderate gap
      const progress = config.curriculum.domains
        .filter((d) => d.phase === 1)
        .map((d) => buildProgress({ domainId: d.id, level: 2 }));
      const allProgress = [
        ...progress,
        ...config.curriculum.domains
          .filter((d) => d.phase === 2)
          .map((d) => buildProgress({ domainId: d.id, level: 2 })),
      ];
      const result = computeGapAnalysis(allProgress, config.curriculum);
      const phase1 = result.phaseGaps.find((p) => p.phaseId === 1);
      assertEquals(phase1?.strategy, "analogy");
    });

    it("selects contrast as fallback", () => {
      // Need a phase where bridge.from.proficiency is not expert/advanced, and gap is moderate
      const customConfig = structuredClone(config.curriculum);
      customConfig.phases[0].bridge.from = {
        label: "Basics",
        concepts: ["basic"],
        proficiency: "beginner",
      };
      const progress = customConfig.domains
        .filter((d) => d.phase === 1)
        .map((d) => buildProgress({ domainId: d.id, level: 2 }));
      const result = computeGapAnalysis(progress, customConfig);
      const phase1 = result.phaseGaps.find((p) => p.phaseId === 1);
      assertEquals(phase1?.strategy, "contrast");
    });
  });

  // ── Weak prerequisites ───────────────────────

  describe("weak prerequisites", () => {
    it("detects domains below level 3 that are prerequisites", () => {
      // domain-b requires domain-a, domain-c requires domain-a and domain-b
      // If domain-a is at level 1 (< 3), it's a weak prereq for domain-b and domain-c
      const progress = [
        buildProgress({ domainId: "domain-a", level: 1 }),
        buildProgress({ domainId: "domain-b", level: 2 }),
      ];
      const result = computeGapAnalysis(progress, config.curriculum);
      // domain-b should list "Domain A" as weak prerequisite
      const phase1 = result.phaseGaps.find((p) => p.phaseId === 1);
      const domB = phase1?.domains.find((d) => d.domainId === "domain-b");
      assertEquals(domB?.weekPrerequisitesMet, false);
      assertEquals(domB?.weakPrerequisites.includes("Domain A"), true);
    });

    it("reports no weak prerequisites when all are at level 3+", () => {
      const progress = [
        buildProgress({ domainId: "domain-a", level: 3 }),
        buildProgress({ domainId: "domain-b", level: 3 }),
      ];
      const result = computeGapAnalysis(progress, config.curriculum);
      const phase1 = result.phaseGaps.find((p) => p.phaseId === 1);
      const domB = phase1?.domains.find((d) => d.domainId === "domain-b");
      assertEquals(domB?.weekPrerequisitesMet, true);
      assertEquals(domB?.weakPrerequisites.length, 0);
    });

    it("populates riskFactors for weak prerequisites", () => {
      const progress = [
        buildProgress({ domainId: "domain-a", level: 1 }),
      ];
      const result = computeGapAnalysis(progress, config.curriculum);
      assertEquals(result.riskFactors.length > 0, true);
      assertEquals(
        result.riskFactors.some((r) => r.includes("Domain B")),
        true,
      );
    });
  });

  // ── Accelerators ─────────────────────────────

  describe("accelerators", () => {
    it("lists domains at level 3+ as accelerators", () => {
      const progress = [
        buildProgress({ domainId: "domain-a", level: 4 }),
        buildProgress({ domainId: "domain-b", level: 1 }),
      ];
      const result = computeGapAnalysis(progress, config.curriculum);
      assertEquals(result.accelerators.length, 1);
      assertEquals(result.accelerators[0].includes("Domain A"), true);
    });

    it("returns empty accelerators when all below level 3", () => {
      const progress = config.curriculum.domains.map((d) =>
        buildProgress({ domainId: d.id, level: 1 })
      );
      const result = computeGapAnalysis(progress, config.curriculum);
      assertEquals(result.accelerators.length, 0);
    });
  });

  // ── Estimated remaining weeks ────────────────

  describe("estimatedRemainingWeeks", () => {
    it("counts domains below level 4", () => {
      const progress = [
        buildProgress({ domainId: "domain-a", level: 4 }),
        buildProgress({ domainId: "domain-b", level: 2 }),
      ];
      const result = computeGapAnalysis(progress, config.curriculum);
      // domain-b at 2, domain-c at 0, domain-d at 0 → 3 remaining
      assertEquals(result.estimatedRemainingWeeks, 3);
    });

    it("returns 0 when all at level 4+", () => {
      const progress = config.curriculum.domains.map((d) =>
        buildProgress({ domainId: d.id, level: 4 })
      );
      const result = computeGapAnalysis(progress, config.curriculum);
      assertEquals(result.estimatedRemainingWeeks, 0);
    });

    it("returns total domain count when no progress", () => {
      const result = computeGapAnalysis([], config.curriculum);
      assertEquals(
        result.estimatedRemainingWeeks,
        config.curriculum.domains.length,
      );
    });
  });
});
