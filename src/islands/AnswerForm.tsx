import { useState } from "preact/hooks";

interface AnswerFormProps {
  questionId: string;
  questionType: string;
  options?: { key: string; text: string }[];
}

export default function AnswerForm(
  { questionId, questionType, options }: AnswerFormProps,
) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/questions/${questionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: answer }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.detail ?? "Kon antwoord niet opslaan.");
      }
    } catch {
      setError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style="padding: 0.75rem; background: #f0fdf4; border-radius: 0.375rem; font-size: 0.875rem; color: #166534;">
        Antwoord opgeslagen. Feedback volgt na beoordeling.
      </div>
    );
  }

  // Multiple choice
  if (questionType === "multiple_choice" && options) {
    return (
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        {options.map((opt) => (
          <label
            key={opt.key}
            style={`display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 0.75rem; border: 1px solid ${answer === opt.key ? "#3b82f6" : "#d1d5db"}; border-radius: 0.375rem; cursor: pointer; font-size: 0.875rem; background: ${answer === opt.key ? "#eff6ff" : "white"};`}
          >
            <input
              type="radio"
              name={`q-${questionId}`}
              value={opt.key}
              checked={answer === opt.key}
              onChange={() => setAnswer(opt.key)}
            />
            <span style="font-weight: 600; min-width: 1.25rem;">{opt.key}.</span>
            {opt.text}
          </label>
        ))}
        <button
          onClick={handleSubmit}
          disabled={!answer || submitting}
          style={`margin-top: 0.25rem; padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 600; cursor: pointer; ${!answer || submitting ? "background: #e5e7eb; color: #9ca3af;" : "background: #3b82f6; color: white;"}`}
        >
          {submitting ? "Opslaan..." : "Antwoord insturen"}
        </button>
        {error && (
          <p style="color: #dc2626; font-size: 0.8125rem; margin-top: 0.25rem;">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Open / scenario / troubleshoot — textarea
  return (
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      <textarea
        value={answer}
        onInput={(e) => setAnswer((e.target as HTMLTextAreaElement).value)}
        placeholder="Typ je antwoord..."
        rows={4}
        style="padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; font-family: inherit; resize: vertical;"
      />
      <button
        onClick={handleSubmit}
        disabled={!answer.trim() || submitting}
        style={`align-self: flex-start; padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 600; cursor: pointer; ${!answer.trim() || submitting ? "background: #e5e7eb; color: #9ca3af;" : "background: #3b82f6; color: white;"}`}
      >
        {submitting ? "Opslaan..." : "Antwoord insturen"}
      </button>
      {error && (
        <p style="color: #dc2626; font-size: 0.8125rem;">{error}</p>
      )}
    </div>
  );
}
