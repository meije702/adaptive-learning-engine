import { z } from "zod";

export const ProficiencySchema = z.enum([
  "none",
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);

export const BridgeStateSchema = z.object({
  label: z.string(),
  concepts: z.array(z.string()),
  proficiency: ProficiencySchema,
});

export const BridgeSchema = z.object({
  from: BridgeStateSchema.nullable(),
  to: BridgeStateSchema,
});

export type Proficiency = z.infer<typeof ProficiencySchema>;
export type BridgeState = z.infer<typeof BridgeStateSchema>;
export type Bridge = z.infer<typeof BridgeSchema>;
