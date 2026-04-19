/**
 * Top-nav theme switcher — smoke test for WP-D5.
 *
 * Changes the learner-scoped theme via `PUT /api/theme`, then reloads so
 * SSR re-resolves the composition. Not a full UX; the "themes gallery" is
 * explicitly out of scope per docs/design-system.md.
 */

import { useState } from "preact/hooks";

type Preset = "default" | "dark" | "high_contrast";

async function setTheme(preset: Preset): Promise<void> {
  await fetch("/api/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "user", preset }),
  });
  location.reload();
}

async function revert(): Promise<void> {
  await fetch("/api/theme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "revert" }),
  });
  location.reload();
}

export default function ThemeSwitcher() {
  const [busy, setBusy] = useState(false);

  const handle = (fn: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style="display: flex; gap: 0.5rem; align-items: center; font-size: 0.75rem;">
      <span style="color: var(--ale-color-muted);">Theme:</span>
      <button
        type="button"
        disabled={busy}
        onClick={handle(() => setTheme("default"))}
        style="background: none; border: 1px solid var(--ale-color-border); padding: 0.125rem 0.5rem; border-radius: var(--ale-radius); cursor: pointer; color: var(--ale-color-text);"
      >
        default
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={handle(() => setTheme("dark"))}
        style="background: none; border: 1px solid var(--ale-color-border); padding: 0.125rem 0.5rem; border-radius: var(--ale-radius); cursor: pointer; color: var(--ale-color-text);"
      >
        dark
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={handle(() => setTheme("high_contrast"))}
        style="background: none; border: 1px solid var(--ale-color-border); padding: 0.125rem 0.5rem; border-radius: var(--ale-radius); cursor: pointer; color: var(--ale-color-text);"
      >
        high_contrast
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={handle(revert)}
        style="background: none; border: 1px solid var(--ale-color-border); padding: 0.125rem 0.5rem; border-radius: var(--ale-radius); cursor: pointer; color: var(--ale-color-muted);"
      >
        revert
      </button>
    </div>
  );
}
