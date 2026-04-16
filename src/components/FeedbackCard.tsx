import type { Feedback } from "../db/types.ts";

interface FeedbackCardProps {
  feedback: Feedback;
}

const LEVEL_LABELS: Record<string, string> = {
  task: "Taakniveau",
  process: "Procesniveau",
  self_regulation: "Zelfregulatieniveau",
};

export function FeedbackCard({ feedback }: FeedbackCardProps) {
  const bgColor = feedback.score === "correct"
    ? "#f0fdf4"
    : feedback.score === "partial"
    ? "#fef9c3"
    : "#fef2f2";

  const hasStructured = feedback.feedUp || feedback.feedBack ||
    feedback.feedForward;

  return (
    <div
      style={`padding: 0.75rem; border-radius: 0.375rem; font-size: 0.875rem; margin-top: 0.5rem; background: ${bgColor};`}
    >
      {/* Feedback level badge */}
      {feedback.feedbackLevel && (
        <div style="font-size: 0.6875rem; color: #6b7280; margin-bottom: 0.375rem; text-transform: uppercase; letter-spacing: 0.05em;">
          {LEVEL_LABELS[feedback.feedbackLevel] ?? feedback.feedbackLevel}
        </div>
      )}

      {hasStructured
        ? (
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            {feedback.feedUp && (
              <div>
                <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; margin-bottom: 0.125rem;">
                  Richting
                </div>
                <div>{feedback.feedUp}</div>
              </div>
            )}
            {feedback.feedBack && (
              <div>
                <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; margin-bottom: 0.125rem;">
                  Resultaat ({feedback.score})
                </div>
                <div>{feedback.feedBack}</div>
              </div>
            )}
            {feedback.feedForward && (
              <div style="padding: 0.5rem; background: rgba(0,0,0,0.04); border-radius: 0.25rem;">
                <div style="font-size: 0.75rem; font-weight: 600; color: #374151; margin-bottom: 0.125rem;">
                  Volgende stap
                </div>
                <div>{feedback.feedForward}</div>
              </div>
            )}
          </div>
        )
        : (
          <div>
            <strong>Feedback ({feedback.score}):</strong>{" "}
            {feedback.explanation}
          </div>
        )}

      {feedback.improvements.length > 0 && (
        <ul style="margin-top: 0.5rem; padding-left: 1.25rem;">
          {feedback.improvements.map((imp, i) => (
            <li key={i} style="font-size: 0.8125rem;">{imp}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
