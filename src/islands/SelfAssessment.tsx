import { useState } from "preact/hooks";

interface SelfAssessmentProps {
  questionId: string;
}

export default function SelfAssessment({ questionId }: SelfAssessmentProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handlePredict(
    score: "correct" | "partial" | "incorrect",
  ) {
    if (submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, predictedScore: score }),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch {
      // Best effort
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style="padding: 0.5rem 0.75rem; background: #f0fdf4; border-radius: 0.375rem; font-size: 0.8125rem; color: #166534;">
        Zelfbeoordeling opgeslagen. Feedback wordt nu getoond.
      </div>
    );
  }

  return (
    <div style="padding: 0.75rem; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 0.375rem; margin-top: 0.5rem;">
      <div style="font-size: 0.8125rem; font-weight: 600; color: #6b21a8; margin-bottom: 0.5rem;">
        Hoe denk je dat je het hebt gedaan?
      </div>
      <div style="display: flex; gap: 0.5rem;">
        {(["correct", "partial", "incorrect"] as const).map((score) => (
          <button
            key={score}
            onClick={() => handlePredict(score)}
            disabled={submitting}
            style={`padding: 0.375rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.8125rem; cursor: pointer; background: white; ${submitting ? "opacity: 0.5;" : ""}`}
          >
            {score === "correct"
              ? "Goed"
              : score === "partial"
              ? "Gedeeltelijk"
              : "Niet goed"}
          </button>
        ))}
      </div>
    </div>
  );
}
