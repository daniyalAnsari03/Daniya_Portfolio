/**
 * The demo mode's ONLY connection to the server (docs/fix.txt).
 *
 * The browser posts the whole demo setup (name, instructions, context), the
 * new message and the last turns it kept in memory to /api/chat/demo. The
 * reply arrives as Server-Sent Events (`delta`, `done`, `error` — no
 * `session`, no `status`) and is turned into typed callbacks here. The SSE
 * parsing is shared with chat-client.ts.
 */

import {
  isAbortError,
  parseEventFrame,
  readRetryAfter,
  type ChatStreamError,
  type ServerEvent,
} from "@/lib/chat/chat-client";

/** One prior turn kept in browser memory — user/assistant only. */
export type DemoHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

/** The demo setup screen's PDF limit (mirrors the extract route). */
export const MAX_PDF_BYTES = 4 * 1024 * 1024;

/** Why the PDF context extraction failed (client + server codes). */
export type PdfExtractErrorCode =
  | "too_large"
  | "invalid_file"
  | "unreadable"
  | "no_text"
  | "rate_limited"
  | "network"
  | "server";

export type PdfExtractError = {
  code: PdfExtractErrorCode;
  retryAfterSeconds?: number;
};

export type PdfExtractResult = {
  text: string;
  truncated: boolean;
};

/**
 * Client-side pre-flight so an obviously wrong file never reaches the
 * server: PDF only (name or mime type) and within the size limit.
 */
export function preflightPdf(file: File): PdfExtractError | null {
  const looksLikePdf =
    file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!looksLikePdf) return { code: "invalid_file" };
  if (file.size > MAX_PDF_BYTES) return { code: "too_large" };
  return null;
}

/**
 * POST one PDF (multipart/form-data, field "file") to the extract route and
 * return the extracted text. Supports abort (Back, option switch, close,
 * unmount). The file name and its bytes are never persisted anywhere.
 */
export async function extractPdf(
  file: File,
  signal?: AbortSignal,
): Promise<PdfExtractResult> {
  const body = new FormData();
  body.set("file", file);

  let response: Response;
  try {
    response = await fetch("/api/chat/demo/extract", {
      method: "POST",
      body,
      signal,
    });
  } catch (error) {
    if (isAbortError(error, signal)) throw error;
    throw { code: "network" } satisfies PdfExtractError;
  }

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterSeconds = await readRetryAfter(response);
      throw { code: "rate_limited", retryAfterSeconds } satisfies PdfExtractError;
    }

    // Read the route's short error code when one is present and fall back
    // to the status for anything unknown.
    let serverCode: string | null = null;
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload?.error === "string") serverCode = payload.error;
    } catch {
      // No JSON body — fall through to the status mapping.
    }

    const mapped: PdfExtractErrorCode = (() => {
      switch (serverCode) {
        case "too_large":
          return "too_large";
        case "invalid_file":
          return "invalid_file";
        case "unreadable":
          return "unreadable";
        case "no_text":
          return "no_text";
        case "server":
        default:
          return response.status === 400 ? "invalid_file" : "server";
      }
    })();

    throw { code: mapped } satisfies PdfExtractError;
  }

  const payload = (await response.json().catch(() => null)) as {
    text?: unknown;
    truncated?: unknown;
  } | null;

  if (
    !payload ||
    typeof payload.text !== "string" ||
    typeof payload.truncated !== "boolean"
  ) {
    throw { code: "server" } satisfies PdfExtractError;
  }

  return { text: payload.text, truncated: payload.truncated };
}

export type StreamDemoOptions = {
  name: string;
  instructions: string;
  context: string;
  /** The new message only. */
  message: string;
  /** The last turns, oldest first — at most 10. */
  history: DemoHistoryMessage[];
  signal?: AbortSignal;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: ChatStreamError) => void;
};

/**
 * POST the demo setup + message and consume the SSE stream.
 *
 * Resolves when the stream ends (or immediately for a non-200 response).
 * An abort (Back, New chat, drawer close, unmount) resolves silently — it is
 * not an error.
 */
export async function streamDemo(
  options: StreamDemoOptions,
): Promise<void> {
  const { name, instructions, context, message, history, signal } = options;
  let settled = false;

  try {
    const response = await fetch("/api/chat/demo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, instructions, context, message, history }),
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

      // The demo stream only ever carries delta / done / error; anything
      // else is ignored defensively.
      switch (event.type) {
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
