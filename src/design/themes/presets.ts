/**
 * Registry of built-in preset themes.
 *
 * The keys are the `ThemePresetId` values declared in
 * `src/config/schemas/theme.ts`. If a new preset module is added, add it
 * to both places — the enum (schema) and this map.
 */

import type { ThemePresetId } from "@/config/schemas/theme.ts";
import type { Theme } from "./types.ts";
import { defaultTheme } from "./default.ts";
import { darkTheme } from "./dark.ts";
import { highContrastTheme } from "./high_contrast.ts";

export const PRESETS: Record<ThemePresetId, Theme> = {
  default: defaultTheme,
  dark: darkTheme,
  high_contrast: highContrastTheme,
};

export function presetFor(id: ThemePresetId | undefined): Theme {
  return PRESETS[id ?? "default"];
}
