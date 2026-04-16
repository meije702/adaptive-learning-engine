import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import IntakeChat from "../islands/IntakeChat.tsx";

export default define.page(async function IntakePage(ctx) {
  const { repos, config } = ctx.state;
  const { curriculum, learner } = config;

  // Check if intake is already completed via KV state
  const learnerState = await repos.learnerState.get();
  const intakeCompleted = learnerState?.intake?.completed ?? false;

  // Load intake session
  const session = await repos.intake.getSession();
  const messages = await repos.intake.getMessages();

  // If completed and no session to show, redirect to dashboard
  if (intakeCompleted && !session) {
    return new Response("", {
      status: 302,
      headers: { Location: "/" },
    });
  }

  return (
    <div style="max-width: 720px; margin: 0 auto; padding: 2rem 1rem;">
      <Head>
        <title>Intake — {curriculum.meta.name}</title>
      </Head>

      <a href="/" style="color: #3b82f6; font-size: 0.875rem;">
        ← Dashboard
      </a>

      <h1 style="font-size: 1.75rem; font-weight: 700; margin-top: 0.5rem; margin-bottom: 0.25rem;">
        Intake
      </h1>
      <p style="color: #6b7280; margin-bottom: 1.5rem;">
        {curriculum.meta.name} — {learner.profile.name}
      </p>

      {!session
        ? (
          <div style="padding: 2rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; text-align: center;">
            <p style="color: #6b7280; margin-bottom: 0.5rem;">
              De intake wordt gestart door de AI coach via MCP.
            </p>
            <p style="font-size: 0.875rem; color: #9ca3af;">
              Verbind de AI agent en roep{" "}
              <code style="background: #f3f4f6; padding: 0.125rem 0.375rem; border-radius: 0.25rem;">
                start_intake
              </code>{" "}
              aan om te beginnen.
            </p>
          </div>
        )
        : (
          <IntakeChat
            initialMessages={messages}
            sessionStatus={session.status}
          />
        )}
    </div>
  );
});
