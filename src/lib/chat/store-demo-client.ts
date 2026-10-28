/**
 * The store demo mode's ONLY connection to the server (docs/fix.txt).
 *
 * The browser posts the new message plus the last turns it kept in memory to
 * /api/chat/demo-store. The reply arrives as Server-Sent Events (`status`,
 * `delta`, `done`, `error` — no `session`, no `ui`) and is turned into typed
 * callbacks here. The SSE frame parsing is shared with chat-client.ts; the
 * status events are parsed defensively here so the main chat's parser is
 * untouched.
 */

import {
  isAbortError,
  parseEventFrame,
  readRetryAfter,
  type ChatStreamError,
  type ServerEvent,
} from "@/lib/chat/chat-client";
import {
  STORE_AGENT_NAME,
  type ChatStatus,
  type ChatStatusTopic,
} from "@/lib/chat/status-events";

/** One prior turn kept in browser memory — user/assistant only. */
export type StoreDemoHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

const STORE_STATUS_TOPICS = ["order", "stock"] as const;

function asStoreTopic(value: unknown): ChatStatusTopic | null {
  return typeof value === "string" &&
    (STORE_STATUS_TOPICS as readonly string[]).includes(value)
    ? (value as "order" | "stock")
    : null;
}

/**
 * Defensively rebuild the store demo's status from unknown JSON; values that
 * cannot come from the store route are ignored. Only enums survive — never
 * tool names, arguments or results.
 */
function parseStoreStatus(event: {
  phase?: unknown;
  agent?: unknown;
  name?: unknown;
  topic?: unknown;
}): ChatStatus | null {
  switch (event.phase) {
    case "agent":
      return event.name === STORE_AGENT_NAME
        ? { phase: "agent", name: STORE_AGENT_NAME }
        : null;
    case "lookup": {
      if (event.agent !== STORE_AGENT_NAME) return null;
      const topic = asStoreTopic(event.topic);
      return topic
        ? { phase: "lookup", agent: STORE_AGENT_NAME, topic }
        : null;
    }
    case "writing":
      return event.agent === STORE_AGENT_NAME
        ? { phase: "writing", agent: STORE_AGENT_NAME }
        : null;
    default:
      return null;
  }
}

export type StreamStoreDemoOptions = {
  /** The new message only. */
  message: string;
  /** The last turns, oldest first — at most 10. */
  history: StoreDemoHistoryMessage[];
  signal?: AbortSignal;
  onStatus?: (status: ChatStatus) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: ChatStreamError) => void;
};

/**
 * POST the message and consume the SSE stream.
 *
 * Resolves when the stream ends (or immediately for a non-200 response).
 * An abort (Back, New chat, drawer close, unmount) resolves silently — it is
 * not an error.
 */
export async function streamStoreDemo(
  options: StreamStoreDemoOptions,
): Promise<void> {
  const { message, history, signal } = options;
  let settled = false;

  try {
    const response = await fetch("/api/chat/demo-store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, history }),
      signal,
    });

    if (!response.ok) {
      settled = true;

      if (response.status === 429) {
        const retryAfterSeconds = await readRetryAfter(response);
        options.onError({ code: "rate_limited", retryAfterSeconds });
        return;
      }

      options.onError({
        code:
          response.status === 400 || response.status === 413
            ? "invalid"
            : "server",
      });
      return;
    }

    if (!response.body) {
      settled = true;
      options.onError({ code: "server" });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const handleFrame = (frame: string) => {
      if (settled) return;

      const event: ServerEvent | null = parseEventFrame(frame);
      if (!event) return;

      switch (event.type) {
        case "status": {
          // The stream can only carry the store statuses, but parse them
          // defensively anyway — anything unknown is dropped.
          const status = parseStoreStatus(
            event as { phase?: unknown; agent?: unknown; name?: unknown; topic?: unknown },
          );
          if (status) options.onStatus?.(status);
          break;
        }
        case "delta": {
          if (typeof event.text === "string" && event.text) {
            options.onDelta(event.text);
          }
          break;
        }
        case "done": {
          settled = true;
          options.onDone();
          break;
        }
        case "error": {
          settled = true;
          options.onError({
            code: event.code === "empty" ? "empty" : "server",
          });
          break;
        }
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        handleFrame(frame);
        if (settled) break;
      }

      if (settled) {
        await reader.cancel().catch(() => {});
        break;
      }
    }

    if (!settled) {
      buffer += decoder.decode();
      if (buffer.trim()) handleFrame(buffer);
    }

    if (!settled) {
      settled = true;
      options.onError({ code: "server" });
    }
  } catch (error) {
    if (isAbortError(error, signal)) return;
    if (settled) return;
    options.onError({ code: "network" });
  }
}
