import type { Progress } from "../db/types.ts";
import type { CurriculumConfig } from "../config/schemas/index.ts";

export interface PhaseGapResult {
  phaseId: number;
  phaseName: string;
  domains: DomainGapResult[];
  avgLevel: number;
  targetLevel: number;
  gapSize: "small" | "moderate" | "large" | "very_large";
  strategy: "analogy" | "first_principles" | "contrast" | "scaffolded" | "accelerated";
}

export interface DomainGapResult {
  domainId: string;
  domainName: string;
  currentLevel: number;
  weekPrerequisitesMet: boolean;
  weakPrerequisites: string[];
}

export interface GapAnalysisResult {
  overallAvgLevel: number;
  overallTargetLevel: number;
  estimatedRemainingWeeks: number;
  phaseGaps: PhaseGapResult[];
  riskFactors: string[];
  accelerators: string[];
}

/**
 * Compute a gap analysis by comparing current Progress against the curriculum structure.
 * Pure computation — reads existing data, produces a summary.
 */
export function computeGapAnalysis(
  progress: Progress[],
  curriculum: CurriculumConfig,
): GapAnalysisResult {
  const progressMap = new Map(progress.map((p) => [p.domainId, p]));

  const phaseGaps: PhaseGapResult[] = curriculum.phases.map((phase) => {
    const domains = curriculum.domains.filter((d) => d.phase === phase.id);

    const domainGaps: DomainGapResult[] = domains.map((domain) => {
      const p = progressMap.get(domain.id);
      const currentLevel = p?.level ?? 0;

      // Check prerequisites
      const weakPrerequisites: string[] = [];
      for (const prereqId of domain.prerequisites) {
        const prereqProgress = progressMap.get(prereqId);
        if (!prereqProgress || prereqProgress.level < 3) {
          const prereqDomain = curriculum.domains.find((d) => d.id === prereqId);
          weakPrerequisites.push(prereqDomain?.name ?? prereqId);
        }
      }

      return {
        domainId: domain.id,
        domainName: domain.name,
        currentLevel,
        weekPrerequisitesMet: weakPrerequisites.length === 0,
        weakPrerequisites,
      };
    });

    const avgLevel = domains.length > 0
      ? domainGaps.reduce((s, d) => s + d.currentLevel, 0) / domains.length
      : 0;

    // Target is level 4 (independent) for non-stretch domains
    const targetLevel = 4;
    const gap = targetLevel - avgLevel;

    const gapSize = gap <= 1
      ? "small"
      : gap <= 2
      ? "moderate"
      : gap <= 3
      ? "large"
      : "very_large";

    // Determine strategy from bridge
    const bridgeFrom = phase.bridge.from;
    let strategy: PhaseGapResult["strategy"];
    if (!bridgeFrom) {
      strategy = "first_principles";
    } else if (gapSize === "large" || gapSize === "very_large") {
      strategy = "scaffolded";
    } else if (bridgeFrom.proficiency === "expert" && gapSize === "small") {
      strategy = "accelerated";
    } else if (bridgeFrom.proficiency === "expert" || bridgeFrom.proficiency === "advanced") {
      strategy = "analogy";
    } else {
      strategy = "contrast";
    }

    return {
      phaseId: phase.id,
      phaseName: phase.name,
      domains: domainGaps,
      avgLevel: Math.round(avgLevel * 10) / 10,
      targetLevel,
      gapSize,
      strategy,
    };
  });

  const allDomainLevels = phaseGaps.flatMap((p) =>
    p.domains.map((d) => d.currentLevel)
  );
  const overallAvgLevel = allDomainLevels.length > 0
    ? allDomainLevels.reduce((s, l) => s + l, 0) / allDomainLevels.length
    : 0;

  // Estimate remaining weeks: domains not yet at target level
  const domainsRemaining = phaseGaps.flatMap((p) =>
    p.domains.filter((d) => d.currentLevel < 4)
  );
  const estimatedRemainingWeeks = domainsRemaining.length; // ~1 week per domain

  // Risk factors: weak prerequisites
  const riskFactors: string[] = [];
  for (const phase of phaseGaps) {
    for (const domain of phase.domains) {
      if (domain.weakPrerequisites.length > 0) {
        riskFactors.push(
          `${domain.domainName} has weak prerequisites: ${domain.weakPrerequisites.join(", ")}`,
        );
      }
    }
  }

  // Accelerators: domains already at level 3+
  const accelerators: string[] = [];
  for (const phase of phaseGaps) {
    for (const domain of phase.domains) {
      if (domain.currentLevel >= 3) {
        accelerators.push(
          `${domain.domainName} is already at level ${domain.currentLevel} — can accelerate`,
        );
      }
    }
  }

  return {
    overallAvgLevel: Math.round(overallAvgLevel * 10) / 10,
    overallTargetLevel: 4,
    estimatedRemainingWeeks,
    phaseGaps,
    riskFactors,
    accelerators,
  };
}
