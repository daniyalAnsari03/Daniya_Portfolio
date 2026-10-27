/**
 * Demo chat endpoint — the "Live demo mode" (docs/fix.txt).
 *
 * Fully isolated from the portfolio chat: a NEW demo agent per request with
 * NO tools, NO handoffs, NO MCP servers, no access to knowledge.ts, and NO
 * Router. Nothing is written to chat_sessions or chat_messages — the demo
 * conversation lives in the visitor's browser memory only, and the demo
 * name / instructions / context / messages are never stored or logged.
 *
 * - Rate limited per hashed IP (10 messages / 10 minutes, separate budget).
 * - The client sends the setup (name, instructions, context), the new message
 *   and up to 10 prior user/assistant turns.
 * - Streams Server-Sent Events: delta, done, error (no session, no status).
 */

import {
  assistant,
  run,
  user,
  type AgentInputItem,
} from "@openai/agents";
import { z } from "zod";

import { createDemoAgent } from "@/lib/chat/demo-agent";
import {
  jsonResponse,
  logStreamError,
  methodNotAllowed,
  isSameOrigin,
  sseFrame,
  ssePingFrame,
} from "@/lib/chat/http";
import { getClientIp, hashIp } from "@/lib/chat/ip";
import { checkRateLimitWithKey } from "@/lib/chat/sessions";

export const maxDuration = 60;

const MAX_BODY_BYTES = 40 * 1024;
const KEEP_ALIVE_MS = 15_000;

/** The demo budget: a separate key so it never shares the main chat's counter. */
const DEMO_RATE_LIMIT = 10;
const DEMO_RATE_LIMIT_WINDOW_SECONDS = 600;

/**
 * Strips control characters from visitor-supplied text (line breaks and tabs
 * are kept). Applied BEFORE validation.
 */
function cleanText(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .trim();
}

const historyItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.preprocess(cleanText, z.string().min(1).max(3000)),
});

const demoRequestSchema = z.object({
  name: z.preprocess(cleanText, z.string().min(1).max(60)),
  instructions: z.preprocess(cleanText, z.string().min(1).max(1000)),
  context: z.preprocess(cleanText, z.string().min(1).max(8000)),
  message: z.preprocess(cleanText, z.string().min(1).max(500)),
  history: z.array(historyItemSchema).max(10),
});

type DemoStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; code: "server_error" | "empty" };

const PING_FRAME = ssePingFrame();

function createEventStream(options: {
  request: Request;
  instructions: string;
  context: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  message: string;
}): ReadableStream<Uint8Array> {
  const { request, instructions, context, history, message } = options;
  let streamClosed = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: DemoStreamEvent) => {
        if (streamClosed) return;
        try {
          controller.enqueue(sseFrame(event));
        } catch {
          streamClosed = true;
        }
      };

      const keepAlive = setInterval(() => {
        if (streamClosed) return;
        try {
          controller.enqueue(PING_FRAME);
        } catch {
          streamClosed = true;
        }
      }, KEEP_ALIVE_MS);

      try {
        const agent = createDemoAgent({ instructions, context });

        const input: AgentInputItem[] = [
          ...history.map((item) =>
            item.role === "user"
              ? user(item.content)
              : assistant(item.content),
          ),
          user(message),
        ];

        const result = await run(agent, input, {
          stream: true,
          signal: request.signal,
        });

        let fullText = "";

        for await (const event of result) {
          if (streamClosed || request.signal.aborted) break;

          // Only raw text deltas stream out; the demo agent has no tools and
          // no handoffs, so nothing else can occur.
          if (event.type !== "raw_model_stream_event") continue;
          if (event.data.type !== "output_text_delta") continue;

          const delta = event.data.delta;
          if (!delta) continue;

          fullText += delta;
          send({ type: "delta", text: delta });
        }

        if (streamClosed || request.signal.aborted) return;

        if (!fullText.trim()) {
          send({ type: "error", code: "empty" });
          return;
        }

        // Nothing is saved — the answer ends its life in this stream.
        send({ type: "done" });
      } catch (error) {
        if (request.signal.aborted) return;

        logStreamError("api/chat/demo", error);
        send({ type: "error", code: "server_error" });
      } finally {
        clearInterval(keepAlive);

        if (!streamClosed) {
          streamClosed = true;
          try {
            controller.close();
          } catch {
            // The client already closed the connection.
          }
        }
      }
    },
    cancel() {
      streamClosed = true;
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!isSameOrigin(request)) {
      return jsonResponse({ error: "forbidden" }, 403);
    }

    const contentType = request.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();

    if (contentType !== "application/json") {
      return jsonResponse({ error: "unsupported_media_type" }, 415);
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "payload_too_large" }, 413);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400);
    }

    const parsed = demoRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    const ipHash = hashIp(getClientIp(request));
    const rateLimit = await checkRateLimitWithKey(
      `${ipHash}:demo`,
      DEMO_RATE_LIMIT,
      DEMO_RATE_LIMIT_WINDOW_SECONDS,
    );

    if (!rateLimit.allowed) {
      return jsonResponse(
        {
          error: "rate_limited",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        429,
        { "retry-after": String(rateLimit.retryAfterSeconds) },
      );
    }

    // The name is validated but never reaches the model or any log — the
    // visitor's own instructions already carry it.
    const { instructions, context, history, message } = parsed.data;

    const stream = createEventStream({
      request,
      instructions,
      context,
      history,
      message,
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    logStreamError("api/chat/demo", error);
    return jsonResponse({ error: "server_error" }, 500);
  }
}

export function GET(): Response {
  return methodNotAllowed();
}

export function PUT(): Response {
  return methodNotAllowed();
}

export function PATCH(): Response {
  return methodNotAllowed();
}

export function DELETE(): Response {
  return methodNotAllowed();
}
