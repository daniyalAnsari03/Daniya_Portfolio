/**
 * The ONLY place the chat talks to the assistant.
 *
 * The browser sends one new message (plus the session id it already has) to
 * the server route; the server owns the history. The reply arrives as
 * Server-Sent Events (`session`, `status`, `delta`, `done`, `error`, plus the
 * one `ui` event — `{ "type": "contact_form" }` — when the Contact agent's
 * local `show_contact_form` tool runs) and is turned into typed callbacks
 * here. Nothing about the model lives in the client.
 */

import type {
  ChatStatus,
  ChatStatusTopic,
} from "@/lib/chat/status-events";

export type ChatErrorCode =
  | "rate_limited"
  | "network"
  | "server"
  | "empty"
  | "invalid";

export type ChatStreamError = {
  code: ChatErrorCode;
  /** Only for `rate_limited` — the seconds the server asks us to wait. */
  retryAfterSeconds?: number;
};

export type StreamAssistantOptions = {
  /** The new message only — never the history, never a role. */
  message: string;
  /** The id from an earlier `session` event, kept in memory only. */
  sessionId?: string;
  signal?: AbortSignal;
  onSession: (sessionId: string) => void;
  /** The server's tiny, model-independent "what is happening" events. */
  onStatus?: (status: ChatStatus) => void;
  /** The one "ui" event: the in-chat contact form should appear. */
  onUi?: () => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: ChatStreamError) => void;
};

type ServerEvent =
  | { type: "session"; sessionId?: unknown }
  | {
      type: "status";
      phase?: unknown;
      agent?: unknown;
      from?: unknown;
      to?: unknown;
      topic?: unknown;
    }
  | { type: "delta"; text?: unknown }
  | { type: "contact_form" }
  | { type: "done" }
  | { type: "error"; code?: unknown };

const SPECIALIST_AGENTS = ["Work", "Profile", "Contact"] as const;
const STATUS_TOPICS = [
  "projects",
  "project_detail",
  "cv",
  "about",
  "contact",
  "notes",
] as const;

function asSpecialist(
  value: unknown,
): "Work" | "Profile" | "Contact" | null {
  return typeof value === "string" &&
    (SPECIALIST_AGENTS as readonly string[]).includes(value)
    ? (value as "Work" | "Profile" | "Contact")
    : null;
}

function asTopic(value: unknown): ChatStatusTopic | null {
  return typeof value === "string" &&
    (STATUS_TOPICS as readonly string[]).includes(value)
    ? (value as ChatStatusTopic)
    : null;
}

/** Defensively rebuild a status from unknown JSON; unknown values are ignored. */
function parseStatus(event: {
  phase?: unknown;
  agent?: unknown;
  from?: unknown;
  to?: unknown;
  topic?: unknown;
}): ChatStatus | null {
  switch (event.phase) {
    case "routing":
      return event.agent === "Router"
        ? { phase: "routing", agent: "Router" }
        : null;
    case "handoff": {
      if (event.from !== "Router") return null;
      const to = asSpecialist(event.to);
      return to ? { phase: "handoff", from: "Router", to } : null;
    }
    case "lookup": {
      const agent = asSpecialist(event.agent);
      const topic = asTopic(event.topic);
      return agent && topic ? { phase: "lookup", agent, topic } : null;
    }
    case "writing": {
      const agent = asSpecialist(event.agent);
      return agent ? { phase: "writing", agent } : null;
    }
    default:
      return null;
  }
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }
  return error instanceof Error && error.name === "AbortError";
}

async function readRetryAfter(response: Response): Promise<number> {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header;

  try {
    const body = (await response.json()) as { retryAfterSeconds?: unknown };
    const value = Number(body?.retryAfterSeconds);
    if (Number.isFinite(value) && value > 0) return value;
  } catch {
    // No JSON body — use the fallback.
  }

  return 60;
}

function parseEventFrame(frame: string): ServerEvent | null {
  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    if (!line.startsWith("data:")) continue;

    const raw = line.slice(5).trim();
    if (!raw) continue;

    try {
      return JSON.parse(raw) as ServerEvent;
    } catch {
      // A malformed frame is ignored; the stream may still recover.
    }
  }

  return null;
}

/**
 * POST the new message and consume the SSE stream.
 *
 * Resolves when the stream ends (or immediately for a non-200 response).
 * An abort (New chat, drawer close, unmount) resolves silently — it is not an
 * error.
 */
export async function streamAssistant(
  options: StreamAssistantOptions,
): Promise<void> {
  const { message, sessionId, signal } = options;
  let settled = false;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sessionId ? { message, sessionId } : { message }),
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

      const event = parseEventFrame(frame);
      if (!event) return;

      switch (event.type) {
        case "session": {
          if (typeof event.sessionId === "string" && event.sessionId) {
            options.onSession(event.sessionId);
          }
          break;
        }
        case "status": {
          const status = parseStatus(event);
          if (status) options.onStatus?.(status);
          break;
        }
        case "delta": {
          if (typeof event.text === "string" && event.text) {
            options.onDelta(event.text);
          }
          break;
        }
        case "contact_form": {
          // The "ui" event — the Contact agent asked for the in-chat form.
          options.onUi?.();
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

      // SSE frames are separated by a blank line. Keep the unfinished tail.
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
      // The connection ended without a `done` or an `error` event.
      settled = true;
      options.onError({ code: "server" });
    }
  } catch (error) {
    if (isAbortError(error, signal)) return;
    if (settled) return;
    options.onError({ code: "network" });
  }
}
