/**
 * Public chat endpoint.
 *
 * - Rate limited per hashed IP (20 requests / 10 minutes).
 * - The server owns the conversation history; the client sends only ONE new
 *   text message (plus, optionally, the session id it received earlier).
 * - Streams Server-Sent Events: session, status, delta, done, error — plus the
 *   one `ui` event (`{"type":"contact_form"}`) when the Contact agent calls
 *   its local `show_contact_form` tool.
 */

import {
  assistant,
  run,
  user,
  type AgentInputItem,
} from "@openai/agents";
import { z } from "zod";

import {
  AGENT_NAMES,
  createChatRuntime,
  getAgentName,
  type ChatRuntime,
} from "@/lib/chat/agents";
import { getClientIp, hashIp } from "@/lib/chat/ip";
import {
  checkRateLimit,
  getOrCreateSession,
  loadHistory,
  saveMessage,
  type ChatHistoryMessage,
} from "@/lib/chat/sessions";
import type { ChatStatus, ChatStatusTopic } from "@/lib/chat/status-events";
import {
  jsonResponse,
  logStreamError,
  methodNotAllowed,
  isSameOrigin,
  sseFrame,
  ssePingFrame,
} from "@/lib/chat/http";
import {
  TOOL_GET_ABOUT,
  TOOL_GET_CHATBOT_KNOWLEDGE,
  TOOL_GET_CV,
  TOOL_GET_PROJECT_DETAIL,
  TOOL_GET_PROJECTS,
  TOOL_GET_PUBLIC_CONTACT,
  TOOL_SHOW_CONTACT_FORM,
} from "@/lib/chat/tool-names";

export const maxDuration = 60;

const MAX_BODY_BYTES = 4 * 1024;
const KEEP_ALIVE_MS = 15_000;
const MAX_TURNS = 6;

const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(500),
  sessionId: z.uuid().optional(),
});

type ChatStreamEvent =
  | { type: "session"; sessionId: string }
  | ({ type: "status" } & ChatStatus)
  | { type: "delta"; text: string }
  /**
   * The one "ui" event: the ONLY payload is the UI enum (`contact_form`),
   * sent when the Contact agent calls its local `show_contact_form` tool.
   * Nothing else travels with it and nothing extra is saved.
   */
  | { type: "contact_form" }
  | { type: "done" }
  | { type: "error"; code: "server_error" | "empty" };

type SpecialistAgent = Extract<ChatStatus, { phase: "handoff" }>["to"];

const SPECIALIST_AGENTS = [
  AGENT_NAMES.work,
  AGENT_NAMES.profile,
  AGENT_NAMES.contact,
] as const;

const TOOL_TOPICS: Record<string, ChatStatusTopic> = {
  [TOOL_GET_PROJECTS]: "projects",
  [TOOL_GET_PROJECT_DETAIL]: "project_detail",
  [TOOL_GET_CV]: "cv",
  [TOOL_GET_ABOUT]: "about",
  [TOOL_GET_PUBLIC_CONTACT]: "contact",
  [TOOL_GET_CHATBOT_KNOWLEDGE]: "notes",
};

function asSpecialist(name: string): SpecialistAgent | null {
  return (SPECIALIST_AGENTS as readonly string[]).includes(name)
    ? (name as SpecialistAgent)
    : null;
}

const encoder = new TextEncoder();
const PING_FRAME = ssePingFrame();

function sseEvent(event: ChatStreamEvent): Uint8Array {
  return sseFrame(event);
}

function logChatError(error: unknown): void {
  logStreamError("api/chat", error);
}

function createEventStream(options: {
  request: Request;
  runtime: ChatRuntime;
  sessionId: string;
  history: ChatHistoryMessage[];
  message: string;
}): ReadableStream<Uint8Array> {
  const { request, runtime, sessionId, history, message } = options;
  let streamClosed = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        if (streamClosed) return;
        try {
          controller.enqueue(sseEvent(event));
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
        send({ type: "session", sessionId });
        send({ type: "status", phase: "routing", agent: "Router" });

        await runtime.connect();

        const input: AgentInputItem[] = [
          ...history.map((item) =>
            item.role === "user"
              ? user(item.content)
              : assistant(item.content),
          ),
          user(message),
        ];

        const result = await run(runtime.router, input, {
          stream: true,
          maxTurns: MAX_TURNS,
          signal: request.signal,
        });

        let currentAgent: string = AGENT_NAMES.router;
        let previousAgent: string = AGENT_NAMES.router;
        let handoffSent = false;
        let routerBuffer = "";
        let fullText = "";

        // Only the enums in ChatStatus leave the server; the agent identity and
        // the tool name are turned into a status right here.
        const sendHandoff = (agentName: string) => {
          if (handoffSent) return;
          const to = asSpecialist(agentName);
          if (!to) return;
          handoffSent = true;
          send({ type: "status", phase: "handoff", from: "Router", to });
        };

        for await (const event of result) {
          if (streamClosed || request.signal.aborted) break;

          if (event.type === "agent_updated_stream_event") {
            const nextAgent = getAgentName(event.agent);
            if (
              previousAgent === AGENT_NAMES.router &&
              nextAgent !== AGENT_NAMES.router
            ) {
              sendHandoff(nextAgent);
            }
            currentAgent = nextAgent;
            previousAgent = nextAgent;
            if (currentAgent !== AGENT_NAMES.router) routerBuffer = "";
            continue;
          }

          if (event.type === "run_item_stream_event") {
            if (
              event.name === "handoff_occurred" &&
              event.item.type === "handoff_output_item"
            ) {
              const targetAgent = getAgentName(event.item.targetAgent);
              sendHandoff(targetAgent);
              currentAgent = targetAgent;
              previousAgent = targetAgent;
              if (currentAgent !== AGENT_NAMES.router) routerBuffer = "";
              continue;
            }

            if (
              event.name === "tool_called" &&
              event.item.type === "tool_call_item"
            ) {
              const agent = asSpecialist(getAgentName(event.item.agent));
              const rawItem = event.item.rawItem;
              const toolName =
                rawItem &&
                "name" in rawItem &&
                typeof rawItem.name === "string"
                  ? rawItem.name
                  : null;
              const topic = toolName ? TOOL_TOPICS[toolName] : undefined;

              if (agent && topic) {
                send({ type: "status", phase: "lookup", agent, topic });
              }

              // The Contact agent's local signal to the UI: the form appears
              // under this answer once it settles. Enum only — no tool name,
              // arguments, results or agent identity leave the server, and
              // nothing extra is stored.
              if (toolName === TOOL_SHOW_CONTACT_FORM) {
                send({ type: "contact_form" });
              }
              continue;
            }

            if (
              event.name === "tool_output" &&
              event.item.type === "tool_call_output_item"
            ) {
              const agent =
                asSpecialist(getAgentName(event.item.agent)) ??
                asSpecialist(currentAgent);

              if (agent) {
                send({ type: "status", phase: "writing", agent });
              }
              continue;
            }

            continue;
          }

          if (event.type !== "raw_model_stream_event") continue;
          if (event.data.type !== "output_text_delta") continue;

          const delta = event.data.delta;
          if (!delta) continue;

          if (currentAgent === AGENT_NAMES.router) {
            // The router may be about to hand off; hold its text back until
            // we know whether it is the final answer.
            routerBuffer += delta;
          } else {
            fullText += delta;
            send({ type: "delta", text: delta });
          }
        }

        if (streamClosed || request.signal.aborted) return;

        if (currentAgent === AGENT_NAMES.router && routerBuffer.trim()) {
          // No handoff: the router itself answered (e.g. a refusal).
          fullText += routerBuffer;
          send({ type: "delta", text: routerBuffer });
        }

        if (!fullText.trim()) {
          send({ type: "error", code: "empty" });
          return;
        }

        if (streamClosed || request.signal.aborted) return;

        await saveMessage(sessionId, "assistant", fullText, currentAgent);
        send({ type: "done" });
      } catch (error) {
        if (request.signal.aborted) return;

        logChatError(error);
        send({ type: "error", code: "server_error" });
      } finally {
        clearInterval(keepAlive);
        await runtime.close();

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
    if (encoder.encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "payload_too_large" }, 413);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400);
    }

    const parsed = chatRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    const ipHash = hashIp(getClientIp(request));
    const rateLimit = await checkRateLimit(ipHash);

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

    const session = await getOrCreateSession(
      parsed.data.sessionId ?? null,
      ipHash,
    );
    const history = await loadHistory(session.id);

    await saveMessage(session.id, "user", parsed.data.message);

    const runtime = createChatRuntime({
      origin: new URL(request.url).origin,
    });

    const stream = createEventStream({
      request,
      runtime,
      sessionId: session.id,
      history,
      message: parsed.data.message,
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
    logChatError(error);
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
