/**
 * Theme type — values for every CSS custom property Scrim exposes.
 *
 * Shape is nested (grouped by concern) to match the `theme.config.yaml`
 * authoring format described in docs/design-system.md § Layer 3. The
 * bijection to Scrim's flat `themeProperties` is defined in `apply_to_root.ts`.
 *
 * When Scrim's token set changes:
 *  1) The snapshot test in `design/scrim_tokens_test.ts` fails first.
 *  2) Update this type.
 *  3) Update `themeToCustomProps` in `apply_to_root.ts`.
 *  4) Update `default.ts` (and any other presets) so fitness #2 passes.
 */

export interface Theme {
  font: {
    family: string;
    size: string;
    lineHeight: string;
    mono: string;
  };
  color: {
    text: string;
    bg: string;
    primary: string;
    primaryLight: string;
    danger: string;
    warning: string;
    success: string;
    info: string;
    muted: string;
    border: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  radius: string;
  shadow: string;
}
