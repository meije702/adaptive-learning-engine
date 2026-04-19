/**
 * Default theme — neutral light.
 *
 * Values intentionally match Scrim's built-in defaults (`themeProperties`
 * in @scrim/web) so that landing WP-D1 is visually a no-op for existing
 * Scrim scenes. Divergence from Scrim's defaults is a D3+ concern
 * (alternate presets).
 */

import type { Theme } from "./types.ts";

export const defaultTheme: Theme = {
  font: {
    family: "system-ui, -apple-system, sans-serif",
    size: "16px",
    lineHeight: "1.6",
    mono: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
  },
  color: {
    text: "#1a1a2e",
    bg: "#ffffff",
    primary: "#2563eb",
    primaryLight: "#dbeafe",
    danger: "#dc2626",
    warning: "#d97706",
    success: "#16a34a",
    info: "#0891b2",
    muted: "#6b7280",
    border: "#e5e7eb",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
  radius: "6px",
  shadow: "0 1px 3px rgba(0,0,0,0.1)",
};
