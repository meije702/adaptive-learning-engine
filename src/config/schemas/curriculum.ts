import { z } from "zod";
import { BridgeSchema } from "./common.ts";

const LevelSchema = z.object({
  id: z.number(),
  label: z.string(),
  description: z.string(),
  assessment_type: z.string().nullable(),
});

const PhaseSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  bridge: BridgeSchema,
});

const DomainSchema = z.object({
  id: z.string(),
  name: z.string(),
  phase: z.number(),
  week: z.number(),
  tags: z.array(z.string()),
  prerequisites: z.array(z.string()),
  bridge: BridgeSchema,
  key_concepts: z.array(z.string()),
  resources: z.array(z.string()),
});

const StretchDomainSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  bridge: BridgeSchema,
  key_concepts: z.array(z.string()),
});

export const CurriculumConfigSchema = z.object({
  meta: z.object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
    description: z.string(),
    target_certification: z.string().optional(),
    estimated_weeks: z.number(),
    language: z.string(),
  }),

  bridge: BridgeSchema,

  levels: z.array(LevelSchema),

  phases: z.array(PhaseSchema),

  domains: z.array(DomainSchema),

  stretch: z.object({
    frequency: z.number(),
    domains: z.array(StretchDomainSchema),
  }),
});

export type CurriculumConfig = z.infer<typeof CurriculumConfigSchema>;
export type Level = z.infer<typeof LevelSchema>;
export type Phase = z.infer<typeof PhaseSchema>;
export type Domain = z.infer<typeof DomainSchema>;
