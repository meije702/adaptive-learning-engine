/**
 * High-contrast theme — accessibility preset.
 *
 * Large-step contrast ratios, saturated primary, bolder borders and
 * shadow. Typography scale is unchanged from default.
 */

import type { Theme } from "./types.ts";

export const highContrastTheme: Theme = {
  font: {
    family: "system-ui, -apple-system, sans-serif",
    size: "16px",
    lineHeight: "1.7",
    mono: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
  },
  color: {
    text: "#000000",
    bg: "#ffffff",
    primary: "#0000ee",
    primaryLight: "#e0e0ff",
    danger: "#c00000",
    warning: "#8a4b00",
    success: "#006400",
    info: "#004e64",
    muted: "#404040",
    border: "#000000",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
  radius: "4px",
  shadow: "0 2px 4px rgba(0,0,0,0.5)",
};
