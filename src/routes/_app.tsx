import { define } from "../utils.ts";
import { themeToInlineStyle } from "../design/themes/apply_to_root.ts";
import { mergeTheme } from "../design/themes/merge.ts";
import { presetFor } from "../design/themes/presets.ts";
import { aliasesCss } from "../design/tokens/aliases.ts";
import { resolveLearnerTheme } from "../domain/learner_theme.ts";
import ThemeSwitcher from "../islands/ThemeSwitcher.tsx";

export default define.page(async function App({ Component, url, state }) {
  const path = url.pathname;
  // Composition rule (see docs/design-system.md § Resolution order):
  //   base_preset = learner.preset ?? course.preset ?? "default"
  //   stack       = [course.overrides ?? {}, learner.overrides ?? {}]
  //   theme       = mergeTheme(preset, ...stack)
  // learnerOverlay is `undefined` when source==="ai_proposed" (fitness #11).
  const learnerState = await state.repos.learnerState.get();
  const learnerOverlay = resolveLearnerTheme(learnerState);
  const basePresetId = learnerOverlay?.preset ?? state.config.theme.preset;
  const composedTheme = mergeTheme(
    presetFor(basePresetId),
    state.config.theme.overrides ?? {},
    learnerOverlay?.overrides ?? {},
  );
  const rootStyle = themeToInlineStyle(composedTheme);

  return (
    <html style={rootStyle}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Adaptive Learning Engine</title>
        <style>{aliasesCss}</style>
      </head>
      <body style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; background: #fafafa;">
        <nav style="background: white; border-bottom: 1px solid #e5e7eb; padding: 0 1rem;">
          <div style="max-width: 960px; margin: 0 auto; display: flex; align-items: center; gap: 1.5rem; height: 3rem; font-size: 0.875rem;">
            <a
              href="/"
              style={`text-decoration: none; font-weight: 700; color: ${
                path === "/" ? "#3b82f6" : "#374151"
              };`}
            >
              Dashboard
            </a>
            <a
              href="/today"
              style={`text-decoration: none; color: ${
                path === "/today" ? "#3b82f6" : "#6b7280"
              };`}
            >
              Vandaag
            </a>
            <a
              href="/intake"
              style={`text-decoration: none; color: ${
                path === "/intake" ? "#3b82f6" : "#6b7280"
              };`}
            >
              Intake
            </a>
            <a
              href="/retention"
              style={`text-decoration: none; color: ${
                path === "/retention" ? "#3b82f6" : "#6b7280"
              };`}
            >
              Retentie
            </a>
            <div style="margin-left: auto;">
              <ThemeSwitcher />
            </div>
          </div>
        </nav>
        <Component />
      </body>
    </html>
  );
});
