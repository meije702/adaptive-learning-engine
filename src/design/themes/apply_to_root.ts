/**
 * Map a Theme into Scrim's flat CSS-custom-property shape and apply it.
 *
 * Three exports, each with one responsibility:
 *   themeToCustomProps  — pure nested → flat mapping (used by tests + SSR)
 *   themeToInlineStyle  — SSR helper: custom props as a `style` string
 *   applyThemeToRoot    — client-side: sets props on document.documentElement
 *
 * `applyThemeToRoot` takes no element parameter by design — it always
 * targets `document.documentElement`. A scoped-element variant is added
 * only if a concrete need emerges (see docs/design-system.md § Deferred).
 *
 * If Scrim's token vocabulary changes, the snapshot test fires first;
 * the mapping below is then updated alongside the `Theme` type.
 */

import type { Theme } from "./types.ts";

export function themeToCustomProps(theme: Theme): Record<string, string> {
  return {
    "--scrim-font-family": theme.font.family,
    "--scrim-font-size": theme.font.size,
    "--scrim-line-height": theme.font.lineHeight,
    "--scrim-font-mono": theme.font.mono,

    "--scrim-color-text": theme.color.text,
    "--scrim-color-bg": theme.color.bg,
    "--scrim-color-primary": theme.color.primary,
    "--scrim-color-primary-light": theme.color.primaryLight,
    "--scrim-color-danger": theme.color.danger,
    "--scrim-color-warning": theme.color.warning,
    "--scrim-color-success": theme.color.success,
    "--scrim-color-info": theme.color.info,
    "--scrim-color-muted": theme.color.muted,
    "--scrim-color-border": theme.color.border,

    "--scrim-spacing-xs": theme.spacing.xs,
    "--scrim-spacing-sm": theme.spacing.sm,
    "--scrim-spacing-md": theme.spacing.md,
    "--scrim-spacing-lg": theme.spacing.lg,
    "--scrim-spacing-xl": theme.spacing.xl,

    "--scrim-radius": theme.radius,
    "--scrim-shadow": theme.shadow,
  };
}

/**
 * Render the theme as a single inline-style string suitable for `<html style>`.
 * Used during SSR where `document` is unavailable.
 */
export function themeToInlineStyle(theme: Theme): string {
  return Object.entries(themeToCustomProps(theme))
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
}

/**
 * Apply the theme to `document.documentElement` by setting each custom
 * property. No-op during SSR when `document` is unavailable. Used for
 * client-side theme changes (see WP-D5 switcher).
 */
export function applyThemeToRoot(theme: Theme): void {
  if (typeof document === "undefined") return;
  const props = themeToCustomProps(theme);
  for (const [key, value] of Object.entries(props)) {
    document.documentElement.style.setProperty(key, value);
  }
}
