/**
 * "Store demo" chat endpoint (docs/fix.txt).
 *
 * The visitor taps "Try the store demo" and a chat starts immediately with a
 * single agent ("Store agent") that has ONLY two local read-only tools over
 * the hardcoded fake store data. Fully isolated: NO handoffs, NO Router, NO
 * MCP, no access to knowledge.ts or the database, and NOTHING is written to
 * chat_sessions or chat_messages — the history lives in the visitor's
 * browser memory only and is sent back with each request.
 *
 * - Rate limited per hashed IP (10 messages / 10 minutes, separate budget).
 * - Streams Server-Sent Events: status, delta, done, error (no session, no
 *   ui). Status events carry enums only — never tool names, arguments,
 *   results, prompts or model text.
 */

import {
  assistant,
  run,
  user,
  type AgentInputItem,
} from "@openai/agents";
import { z } from "zod";

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
import { createStoreDemoAgent } from "@/lib/chat/store-demo-agent";
import { STORE_AGENT_NAME, type ChatStatus, type ChatStatusTopic } from "@/lib/chat/status-events";
import { TOOL_CHECK_STOCK, TOOL_LOOKUP_ORDER } from "@/lib/chat/tool-names";

export const maxDuration = 60;

const MAX_BODY_BYTES = 4 * 1024;
const KEEP_ALIVE_MS = 15_000;
const MAX_TURNS = 4;

/** The store demo budget: a separate key so it never shares another counter. */
const STORE_DEMO_RATE_LIMIT = 10;
const STORE_DEMO_RATE_LIMIT_WINDOW_SECONDS = 600;

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
  content: z.preprocess(cleanText, z.string().min(1).max(1000)),
});

const storeRequestSchema = z.object({
  message: z.preprocess(cleanText, z.string().min(1).max(500)),
  history: z.array(historyItemSchema).max(10),
});

type StoreStreamEvent =
  | ({ type: "status" } & ChatStatus)
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; code: "server_error" | "empty" };

/** The same tool-name -> status-topic map pattern as the main chat route. */
const TOOL_TOPICS: Record<string, ChatStatusTopic> = {
  [TOOL_LOOKUP_ORDER]: "order",
  [TOOL_CHECK_STOCK]: "stock",
};

const PING_FRAME = ssePingFrame();

function createEventStream(options: {
  request: Request;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  message: string;
}): ReadableStream<Uint8Array> {
  const { request, history, message } = options;
  let streamClosed = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StoreStreamEvent) => {
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
        // The store flow's first step: the agent started (no "routing" step).
        send({ type: "status", phase: "agent", name: STORE_AGENT_NAME });

        const agent = createStoreDemoAgent();

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
          maxTurns: MAX_TURNS,
          signal: request.signal,
        });

        let fullText = "";

        for await (const event of result) {
          if (streamClosed || request.signal.aborted) break;

          if (event.type === "run_item_stream_event") {
            if (
              event.name === "tool_called" &&
              event.item.type === "tool_call_item"
            ) {
              // Enum only: the tool name is turned into a topic right here —
              // never a tool name, argument or result leaves the server.
              const rawItem = event.item.rawItem;
              const toolName =
                rawItem && "name" in rawItem && typeof rawItem.name === "string"
                  ? rawItem.name
                  : null;
              const topic = toolName ? TOOL_TOPICS[toolName] : undefined;

              if (topic) {
                send({
                  type: "status",
                  phase: "lookup",
                  agent: STORE_AGENT_NAME,
                  topic,
                });
              }
              continue;
            }

            if (
              event.name === "tool_output" &&
              event.item.type === "tool_call_output_item"
            ) {
              send({ type: "status", phase: "writing", agent: STORE_AGENT_NAME });
              continue;
            }

            continue;
          }

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

        logStreamError("api/chat/demo-store", error);
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

    const parsed = storeRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    const ipHash = hashIp(getClientIp(request));
    const rateLimit = await checkRateLimitWithKey(
      `${ipHash}:demo-store`,
      STORE_DEMO_RATE_LIMIT,
      STORE_DEMO_RATE_LIMIT_WINDOW_SECONDS,
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

    const { history, message } = parsed.data;

    const stream = createEventStream({
      request,
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
    logStreamError("api/chat/demo-store", error);
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
