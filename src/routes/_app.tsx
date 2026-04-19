import { define } from "../utils.ts";
import { defaultTheme } from "../design/themes/default.ts";
import { themeToInlineStyle } from "../design/themes/apply_to_root.ts";

export default define.page(function App({ Component, url }) {
  const path = url.pathname;
  const rootStyle = themeToInlineStyle(defaultTheme);

  return (
    <html style={rootStyle}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Adaptive Learning Engine</title>
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
          </div>
        </nav>
        <Component />
      </body>
    </html>
  );
});
