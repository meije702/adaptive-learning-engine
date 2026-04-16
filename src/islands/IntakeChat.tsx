import { useEffect, useRef, useState } from "preact/hooks";

interface Message {
  id: string;
  role: "agent" | "learner";
  content: string;
  timestamp: string;
  phase: string;
}

interface IntakeChatProps {
  initialMessages: Message[];
  sessionStatus: string;
}

const PHASE_LABELS: Record<string, string> = {
  goal_validation: "Doelvalidatie",
  profile_validation: "Profielvalidatie",
  baseline: "Nulmeting",
  gap_analysis: "Gap-analyse",
  confirmation: "Bevestiging",
  completed: "Voltooid",
};

export default function IntakeChat(
  { initialMessages, sessionStatus }: IntakeChatProps,
) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(sessionStatus);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | undefined>(
    initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1].timestamp
      : undefined,
  );

  // Poll for new messages (agent responses)
  useEffect(() => {
    if (status === "completed") return;

    const interval = setInterval(async () => {
      const since = lastTimestampRef.current;
      const url = since
        ? `/api/intake/messages?since=${encodeURIComponent(since)}`
        : "/api/intake/messages";

      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const newMessages: Message[] = await res.json();
        if (newMessages.length > 0) {
          setMessages((prev) => [...prev, ...newMessages]);
          lastTimestampRef.current =
            newMessages[newMessages.length - 1].timestamp;

          // Check if intake is completed
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.phase === "completed") {
            setStatus("completed");
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/intake/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const message: Message = await res.json();
        setMessages((prev) => [...prev, message]);
        lastTimestampRef.current = message.timestamp;
        setInput("");
      }
    } catch {
      // Ignore send errors
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Detect phase transitions for visual dividers
  let lastPhase = "";

  return (
    <div style="display: flex; flex-direction: column; height: calc(100vh - 180px); max-height: 700px;">
      {/* Messages */}
      <div style="flex: 1; overflow-y: auto; padding: 1rem 0; display: flex; flex-direction: column; gap: 0.75rem;">
        {messages.map((msg) => {
          const showPhaseDivider = msg.phase !== lastPhase;
          lastPhase = msg.phase;

          return (
            <div key={msg.id}>
              {showPhaseDivider && (
                <div style="text-align: center; margin: 1rem 0 0.5rem; font-size: 0.75rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">
                  {PHASE_LABELS[msg.phase] ?? msg.phase}
                </div>
              )}
              <div
                style={`max-width: 80%; padding: 0.75rem 1rem; border-radius: 0.75rem; font-size: 0.875rem; line-height: 1.6; white-space: pre-wrap; ${
                  msg.role === "agent"
                    ? "background: #f3f4f6; margin-right: auto;"
                    : "background: #dbeafe; margin-left: auto;"
                }`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {status !== "completed"
        ? (
          <div style="display: flex; gap: 0.5rem; padding-top: 0.75rem; border-top: 1px solid #e5e7eb;">
            <textarea
              value={input}
              onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
              onKeyDown={handleKeyDown}
              placeholder="Typ je antwoord..."
              disabled={sending}
              rows={2}
              style="flex: 1; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 0.875rem; resize: none; font-family: inherit;"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              style={`padding: 0 1.25rem; border-radius: 0.5rem; border: none; font-size: 0.875rem; font-weight: 600; cursor: pointer; ${
                sending || !input.trim()
                  ? "background: #e5e7eb; color: #9ca3af;"
                  : "background: #3b82f6; color: white;"
              }`}
            >
              {sending ? "..." : "Verstuur"}
            </button>
          </div>
        )
        : (
          <div style="padding: 1rem; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #166534; font-weight: 600; margin-bottom: 0.5rem;">
              Intake voltooid
            </p>
            <a
              href="/"
              style="color: #3b82f6; font-size: 0.875rem;"
            >
              Ga naar het dashboard →
            </a>
          </div>
        )}
    </div>
  );
}
