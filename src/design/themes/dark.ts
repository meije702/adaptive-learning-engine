/**
 * Dark theme — inverted surface + high-contrast text, tuned text/primary
 * pair for readability against a near-black background.
 *
 * Token values are ALE-owned, not Scrim-copied. Only the *set* of tokens
 * matches Scrim's vocabulary (enforced by fitness #7).
 */

import type { Theme } from "./types.ts";

export const darkTheme: Theme = {
  font: {
    family: "system-ui, -apple-system, sans-serif",
    size: "16px",
    lineHeight: "1.6",
    mono: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
  },
  color: {
    text: "#e5e7eb",
    bg: "#0f172a",
    primary: "#60a5fa",
    primaryLight: "#1e3a8a",
    danger: "#f87171",
    warning: "#fbbf24",
    success: "#34d399",
    info: "#22d3ee",
    muted: "#94a3b8",
    border: "#1e293b",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
  radius: "6px",
  shadow: "0 1px 3px rgba(0,0,0,0.4)",
};
