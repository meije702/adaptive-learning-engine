import { assertEquals } from "jsr:@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import {
  buildProgress,
  createTestConfig,
  createTestKv,
} from "@/test_helpers.ts";
import { computeGapAnalysis } from "@/analysis/gap.ts";
import type { Repositories } from "@/db/repositories.ts";

const config = createTestConfig();

describe("Scenario: Gap analysis decreases over time", () => {
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

  it("shows gaps shrinking as learner progresses", async () => {
    // Stage 1: All domains at level 0 — gaps are very_large/large
    const stage1 = computeGapAnalysis([], config.curriculum);

    for (const phase of stage1.phaseGaps) {
      assertEquals(
        phase.gapSize === "very_large" || phase.gapSize === "large",
        true,
        `Phase ${phase.phaseName} should have very_large or large gap, got ${phase.gapSize}`,
      );
    }
    assertEquals(
      stage1.estimatedRemainingWeeks,
      config.curriculum.domains.length,
    );

    // Stage 2: Update 2 domains to level 2 — gaps decrease
    await repos.progress.put("domain-a", { level: 2, source: "assessment" });
    await repos.progress.put("domain-b", { level: 2, source: "assessment" });

    const progress2 = await repos.progress.getAll();
    const stage2 = computeGapAnalysis(progress2, config.curriculum);

    // Phase 1 should be moderate now (avg = 2, gap = 2)
    const phase1_s2 = stage2.phaseGaps.find((p) => p.phaseId === 1);
    assertEquals(phase1_s2?.gapSize, "moderate");

    // Phase 2 still very_large (avg = 0, gap = 4)
    const phase2_s2 = stage2.phaseGaps.find((p) => p.phaseId === 2);
    assertEquals(phase2_s2?.gapSize, "very_large");

    // Remaining weeks stays the same (domains at level 2 are still below 4)
    // but overall avg level should have improved
    assertEquals(stage2.overallAvgLevel > stage1.overallAvgLevel, true);

    // Stage 3: Update all to level 4 — gaps are small, estimatedRemainingWeeks = 0
    for (const domain of config.curriculum.domains) {
      await repos.progress.put(domain.id, { level: 4, source: "assessment" });
    }

    const progress3 = await repos.progress.getAll();
    const stage3 = computeGapAnalysis(progress3, config.curriculum);

    for (const phase of stage3.phaseGaps) {
      assertEquals(phase.gapSize, "small");
    }
    assertEquals(stage3.estimatedRemainingWeeks, 0);
    assertEquals(stage3.riskFactors.length, 0);
  });

  it("shows accelerators appearing as domains reach level 3+", async () => {
    // No accelerators at start
    const stage1 = computeGapAnalysis([], config.curriculum);
    assertEquals(stage1.accelerators.length, 0);

    // After domain-a reaches level 3
    const progress = [buildProgress({ domainId: "domain-a", level: 3 })];
    const stage2 = computeGapAnalysis(progress, config.curriculum);
    assertEquals(stage2.accelerators.length, 1);
    assertEquals(stage2.accelerators[0].includes("Domain A"), true);

    // After all domains reach level 4
    const allAt4 = config.curriculum.domains.map((d) =>
      buildProgress({ domainId: d.id, level: 4 })
    );
    const stage3 = computeGapAnalysis(allAt4, config.curriculum);
    assertEquals(stage3.accelerators.length, config.curriculum.domains.length);
  });

  it("shows risk factors clearing as prerequisites are met", async () => {
    // domain-b requires domain-a, domain-c requires domain-a and domain-b
    // domain-a at level 1 → weak prereq for domain-b and domain-c
    const weakProgress = [
      buildProgress({ domainId: "domain-a", level: 1 }),
      buildProgress({ domainId: "domain-b", level: 1 }),
    ];
    const withRisks = computeGapAnalysis(weakProgress, config.curriculum);
    assertEquals(withRisks.riskFactors.length > 0, true);

    // After domain-a and domain-b reach level 3 → prereqs met
    const strongProgress = [
      buildProgress({ domainId: "domain-a", level: 3 }),
      buildProgress({ domainId: "domain-b", level: 3 }),
    ];
    const noRisks = computeGapAnalysis(strongProgress, config.curriculum);
    assertEquals(noRisks.riskFactors.length, 0);
  });
});
