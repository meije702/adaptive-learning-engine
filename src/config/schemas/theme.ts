/**
 * Theme Zod schemas.
 *
 * `ThemeSchema` — full/required shape, one value per token.
 * `ThemePartialSchema` — deep-partial, every leaf optional.
 * `ThemeConfigSchema` — the wire shape of `theme.config.yaml` (WP-D4).
 * `cssColor` — the SINGLE color validator (fitness #8). See the design
 *   doc for why we don't double up with `CSS.supports` at the schema level.
 */

import { z } from "zod";

// --- Single color validator (fitness #8) ---------------------------------

const HEX = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FN =
  /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\([^)]*\)$/;

/**
 * Minimal CSS named-color list. Not exhaustive — we vendor the most
 * common names and fall through to hex / function syntax for the rest.
 * If a real named color is ever rejected here, add it to the set rather
 * than loosening the refinement.
 */
const NAMED_COLORS = new Set<string>([
  "transparent",
  "currentcolor",
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "pink",
  "gray",
  "grey",
]);

export const cssColor = z.string().refine(
  (v) => HEX.test(v) || FN.test(v) || NAMED_COLORS.has(v.toLowerCase()),
  { message: "must be a CSS color value (hex, rgb/hsl/oklch/..., or named)" },
);

// --- Full Theme schema ---------------------------------------------------

const FontSchema = z.object({
  family: z.string().min(1),
  size: z.string().min(1),
  lineHeight: z.string().min(1),
  mono: z.string().min(1),
}).strict();

const ColorSchema = z.object({
  text: cssColor,
  bg: cssColor,
  primary: cssColor,
  primaryLight: cssColor,
  danger: cssColor,
  warning: cssColor,
  success: cssColor,
  info: cssColor,
  muted: cssColor,
  border: cssColor,
}).strict();

const SpacingSchema = z.object({
  xs: z.string().min(1),
  sm: z.string().min(1),
  md: z.string().min(1),
  lg: z.string().min(1),
  xl: z.string().min(1),
}).strict();

export const ThemeSchema = z.object({
  font: FontSchema,
  color: ColorSchema,
  spacing: SpacingSchema,
  radius: z.string().min(1),
  shadow: z.string().min(1),
}).strict();

// --- Deep-partial schema -------------------------------------------------

const FontPartial = FontSchema.partial().strict();
const ColorPartial = ColorSchema.partial().strict();
const SpacingPartial = SpacingSchema.partial().strict();

export const ThemePartialSchema = z.object({
  font: FontPartial.optional(),
  color: ColorPartial.optional(),
  spacing: SpacingPartial.optional(),
  radius: z.string().min(1).optional(),
  shadow: z.string().min(1).optional(),
}).strict();

// --- theme.config.yaml wire shape (prepared for WP-D4) -------------------

export const THEME_PRESET_IDS = ["default", "dark", "high_contrast"] as const;
export type ThemePresetId = typeof THEME_PRESET_IDS[number];
export const ThemePresetIdSchema = z.enum(THEME_PRESET_IDS);

export const ThemeConfigSchema = z.object({
  preset: ThemePresetIdSchema.optional(),
  overrides: ThemePartialSchema.optional(),
}).strict();

export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
