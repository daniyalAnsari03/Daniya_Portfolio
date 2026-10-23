/**
 * Internal, read-only MCP server used only by the chatbot agents.
 *
 * Streamable HTTP, stateless (no session ids), token protected with
 * `Authorization: Bearer <MCP_AUTH_TOKEN>`. It exposes six read-only tools
 * backed exclusively by `src/lib/chat/knowledge.ts`; there are no write tools
 * and no access to private data. GET and DELETE are not supported.
 */

import { createHash, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  getAbout,
  getChatbotKnowledge,
  getCv,
  getProjectDetail,
  getProjects,
  getPublicContact,
} from "@/lib/chat/knowledge";
import {
  TOOL_GET_ABOUT,
  TOOL_GET_CHATBOT_KNOWLEDGE,
  TOOL_GET_CV,
  TOOL_GET_PROJECT_DETAIL,
  TOOL_GET_PROJECTS,
  TOOL_GET_PUBLIC_CONTACT,
} from "@/lib/chat/tool-names";

// Cache Components (next.config.ts) rejects the `runtime` and `dynamic` route
// segment configs. This route is Node.js by default, and a POST handler is
// always rendered per request, so the required behaviour is unchanged.

const LATEST_PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  "2024-11-05",
  "2025-03-26",
  LATEST_PROTOCOL_VERSION,
]);

const SERVER_INFO = {
  name: "portfolio-knowledge",
  version: "1.0.0",
};

const EMPTY_INPUT = z.object({});
const PROJECT_DETAIL_INPUT = z.object({
  id_or_name: z.string().trim().min(1).max(100),
});

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  run: (args: unknown) => Promise<unknown>;
};

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: TOOL_GET_PROJECTS,
    description: "List the portfolio projects that are publicly visible.",
    inputSchema: EMPTY_INPUT,
    run: () => getProjects(),
  },
  {
    name: TOOL_GET_PROJECT_DETAIL,
    description:
      "Get the public details of one visible project by its id or exact name.",
    inputSchema: PROJECT_DETAIL_INPUT,
    run: (args) => {
      const { id_or_name } = PROJECT_DETAIL_INPUT.parse(args);
      return getProjectDetail(id_or_name);
    },
  },
  {
    name: TOOL_GET_CV,
    description: "Read the published CV (profile and sections).",
    inputSchema: EMPTY_INPUT,
    run: () => getCv(),
  },
  {
    name: TOOL_GET_ABOUT,
    description: "Read the public About content, services, skills and education.",
    inputSchema: EMPTY_INPUT,
    run: () => getAbout(),
  },
  {
    name: TOOL_GET_PUBLIC_CONTACT,
    description: "Read the public site name, contact email and social links.",
    inputSchema: EMPTY_INPUT,
    run: () => getPublicContact(),
  },
  {
    name: TOOL_GET_CHATBOT_KNOWLEDGE,
    description: "Read the free-text facts the site admin added for the chatbot.",
    inputSchema: EMPTY_INPUT,
    run: () => getChatbotKnowledge(),
  },
];

const TOOL_BY_NAME = new Map(TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

function toInputSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  const properties =
    json.properties && typeof json.properties === "object"
      ? (json.properties as Record<string, unknown>)
      : {};

  return {
    type: "object",
    properties,
    required: Array.isArray(json.required) ? json.required : [],
    additionalProperties: json.additionalProperties ?? false,
  };
}

const TOOL_LIST = TOOL_DEFINITIONS.map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: toInputSchema(tool.inputSchema),
  annotations: { readOnlyHint: true },
}));

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function rpcError(
  id: string | number | null,
  code: number,
  message: string,
): Response {
  return jsonResponse({ jsonrpc: "2.0", id, error: { code, message } });
}

function methodNotAllowed(): Response {
  return jsonResponse(
    { error: "Method not allowed" },
    405,
    { allow: "POST" },
  );
}

function getBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer[ ]+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length === rightBuffer.length) {
    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  const leftHash = createHash("sha256").update(leftBuffer).digest();
  const rightHash = createHash("sha256").update(rightBuffer).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.MCP_AUTH_TOKEN;
  if (!expected) return false;

  const provided = getBearerToken(request.headers.get("authorization"));
  if (!provided) return false;

  return constantTimeEqual(expected, provided);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeToolResult(value: unknown): string {
  if (value === null) return "No data available";
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" ? serialized : "No data available";
  } catch {
    return "No data available";
  }
}

function toolError(text: string) {
  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

async function handleToolCall(params: unknown) {
  if (!isRecord(params) || typeof params.name !== "string") {
    throw new RpcError(-32602, "Invalid params");
  }

  const tool = TOOL_BY_NAME.get(params.name);
  if (!tool) return toolError("Unknown tool.");

  const parsed = tool.inputSchema.safeParse(params.arguments ?? {});
  if (!parsed.success) return toolError("Invalid arguments.");

  try {
    const result = await tool.run(parsed.data);
    return {
      content: [{ type: "text", text: serializeToolResult(result) }],
    };
  } catch {
    return toolError("The tool could not complete the request.");
  }
}

function negotiateProtocolVersion(params: unknown): string {
  if (!isRecord(params)) return LATEST_PROTOCOL_VERSION;
  const requested = params.protocolVersion;
  return typeof requested === "string" &&
    SUPPORTED_PROTOCOL_VERSIONS.has(requested)
    ? requested
    : LATEST_PROTOCOL_VERSION;
}

async function handleRequest(method: string, params: unknown): Promise<unknown> {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: negotiateProtocolVersion(params),
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      };
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOL_LIST };
    case "tools/call":
      return handleToolCall(params);
    default:
      throw new RpcError(-32601, "Method not found");
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  if (
    !isRecord(payload) ||
    payload.jsonrpc !== "2.0" ||
    typeof payload.method !== "string"
  ) {
    return rpcError(null, -32600, "Invalid Request");
  }

  const id =
    typeof payload.id === "string" || typeof payload.id === "number"
      ? payload.id
      : null;

  if (!("id" in payload)) {
    return new Response(null, {
      status: 202,
      headers: { "cache-control": "no-store" },
    });
  }

  try {
    const result = await handleRequest(payload.method, payload.params);
    return jsonResponse({ jsonrpc: "2.0", id, result });
  } catch (error) {
    if (error instanceof RpcError) {
      return rpcError(id, error.code, error.message);
    }
    return rpcError(id, -32603, "Internal error");
  }
}

export function GET(): Response {
  return methodNotAllowed();
}

export function DELETE(): Response {
  return methodNotAllowed();
}
