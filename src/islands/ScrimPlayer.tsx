import { useEffect, useRef, useState } from "preact/hooks";

interface ScrimPlayerProps {
  sceneDocument: unknown;
  interactionLog?: unknown;
  dayContentId: string;
}

export default function ScrimPlayer(
  { sceneDocument, interactionLog, dayContentId }: ScrimPlayerProps,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<{ cancel(): void; interactionLog: unknown } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    async function startRuntime() {
      // Dynamic imports to ensure these only load client-side
      const [
        { interpret },
        { ScrimRuntime },
        { WebRenderer },
        { conductChallenge },
      ] = await Promise.all([
        import("@scrim/core"),
        import("@scrim/core/runtime"),
        import("@scrim/web"),
        import("@scrim/assessment"),
      ]);

      if (cancelled) return;

      const scene = interpret(
        sceneDocument as Parameters<typeof interpret>[0],
        // deno-lint-ignore no-explicit-any
        { challengeRunner: conductChallenge as any },
      );

      const renderer = new WebRenderer();

      // Evaluator bridge: calls ALE API to grade answers and store feedback
      const evaluator = async (
        response: unknown,
        evaluatorKey: string,
        signal?: AbortSignal,
      ) => {
        const res = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            response,
            evaluatorKey,
            dayContentId,
          }),
          signal,
        });
        if (!res.ok) {
          throw new Error(`Evaluation failed: ${res.status}`);
        }
        return res.json();
      };

      // deno-lint-ignore no-explicit-any
      const runtime = new ScrimRuntime<HTMLElement>({
        scene,
        renderer,
        host: containerRef.current!,
        replayLog: interactionLog as any,
        evaluator,
      });

      runtimeRef.current = runtime;

      try {
        await runtime.run();
        if (!cancelled) {
          setCompleted(true);
          await persistLog(dayContentId, runtime.interactionLog);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Scene execution failed",
          );
        }
      }
    }

    startRuntime();

    return () => {
      cancelled = true;
      if (runtimeRef.current) {
        // Persist log before cleanup
        persistLog(dayContentId, runtimeRef.current.interactionLog);
        runtimeRef.current.cancel();
        runtimeRef.current = null;
      }
    };
  }, [sceneDocument, dayContentId]);

  if (error) {
    return (
      <div style="padding: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.5rem; color: #991b1b;">
        Scene kon niet worden geladen: {error}
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} style="min-height: 200px;" />
      {completed && (
        <div style="margin-top: 1rem; padding: 0.75rem; background: #f0fdf4; border-radius: 0.375rem; font-size: 0.875rem; color: #166534;">
          Sessie voltooid
        </div>
      )}
    </div>
  );
}

async function persistLog(
  dayContentId: string,
  log: unknown,
): Promise<void> {
  try {
    await fetch(`/api/days/${dayContentId}/interaction-log`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log),
    });
  } catch {
    // Best-effort persistence — don't crash the UI
  }
}
