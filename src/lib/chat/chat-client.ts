import type { ChatMessage } from "./types";

/**
 * The reply the assistant shows while it is not connected to anything.
 *
 * It is deliberately generic — it makes no claim about Daniyal, his work or
 * his experience.
 */
export const STUB_REPLY =
  "The assistant isn't connected yet. This is a placeholder reply.";

/** How long the stub waits before it answers (ms). */
const STUB_DELAY = 900;

/**
 * The ONLY place the chat talks to "the assistant".
 *
 * TODO: replace the body of this function with the real server call. The
 * request must go to a Next.js route handler / server action so the model
 * key stays on the server — never in the browser, never in this file's
 * caller. Nothing else in the app may fetch an AI endpoint: every screen
 * goes through this function and only this function changes.
 */
export async function askAssistant(history: ChatMessage[]): Promise<string> {
  // `history` is unused while the assistant is stubbed; it is the argument
  // the real implementation needs.
  void history;

  await new Promise((resolve) => {
    setTimeout(resolve, STUB_DELAY);
  });

  return STUB_REPLY;
}
