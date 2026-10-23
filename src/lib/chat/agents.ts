import "server-only";

import {
  Agent,
  MCPServerStreamableHttp,
  handoff,
  setTracingDisabled,
  type ModelSettings,
} from "@openai/agents";

import { buildInstructions } from "@/lib/chat/skills/load";
import {
  CONTACT_TOOLS,
  PROFILE_TOOLS,
  WORK_TOOLS,
} from "@/lib/chat/tool-names";

// Visitor messages must not be sent to the OpenAI traces dashboard; our own
// chat logs are the record. Set this to false temporarily when debugging.
setTracingDisabled(true);

export const AGENT_NAMES = {
  router: "Router",
  work: "Work",
  profile: "Profile",
  contact: "Contact",
} as const;

export type ChatAgentName = (typeof AGENT_NAMES)[keyof typeof AGENT_NAMES];

export type ChatRuntime = {
  router: Agent;
  connect: () => Promise<void>;
  close: () => Promise<void>;
};

type ChatRuntimeOptions = {
  /** Origin of this deployment, used for the internal MCP endpoint. */
  origin: string;
};

const MODEL_SETTINGS: ModelSettings = {
  // Reasoning tokens count toward this cap too.
  maxTokens: 1200,
  reasoning: { effort: "low" },
};

function requireEnv(name: "OPENAI_MODEL" | "MCP_AUTH_TOKEN"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function createMcpServer(
  origin: string,
  token: string,
  name: string,
  allowedToolNames: readonly string[],
): MCPServerStreamableHttp {
  return new MCPServerStreamableHttp({
    url: `${origin}/api/mcp`,
    name,
    cacheToolsList: true,
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    toolFilter: {
      allowedToolNames: [...allowedToolNames],
    },
  });
}

/**
 * Builds one stateless chat runtime per request. The caller connects the MCP
 * servers before running the router and closes them when the request ends.
 */
export function createChatRuntime({
  origin,
}: ChatRuntimeOptions): ChatRuntime {
  // Read at call time so a missing variable fails clearly per request instead
  // of at import time (and never from a hardcoded value).
  const model = requireEnv("OPENAI_MODEL");
  const mcpToken = requireEnv("MCP_AUTH_TOKEN");

  const workServer = createMcpServer(
    origin,
    mcpToken,
    "work-knowledge",
    WORK_TOOLS,
  );
  const profileServer = createMcpServer(
    origin,
    mcpToken,
    "profile-knowledge",
    PROFILE_TOOLS,
  );
  const contactServer = createMcpServer(
    origin,
    mcpToken,
    "contact-knowledge",
    CONTACT_TOOLS,
  );

  const work = new Agent({
    name: AGENT_NAMES.work,
    handoffDescription:
      "Answers questions about Daniyal's projects, work, tech stack and demos.",
    instructions: buildInstructions("work"),
    model,
    modelSettings: MODEL_SETTINGS,
    mcpServers: [workServer],
  });

  const profile = new Agent({
    name: AGENT_NAMES.profile,
    handoffDescription:
      "Answers questions about Daniyal's background, CV, skills, education, services and experience.",
    instructions: buildInstructions("profile"),
    model,
    modelSettings: MODEL_SETTINGS,
    mcpServers: [profileServer],
  });

  const contact = new Agent({
    name: AGENT_NAMES.contact,
    handoffDescription:
      "Answers questions about Daniyal's email, socials, hiring and how to reach him.",
    instructions: buildInstructions("contact"),
    model,
    modelSettings: MODEL_SETTINGS,
    mcpServers: [contactServer],
  });

  const router = new Agent({
    name: AGENT_NAMES.router,
    instructions: buildInstructions("router"),
    model,
    modelSettings: MODEL_SETTINGS,
    handoffs: [handoff(work), handoff(profile), handoff(contact)],
  });

  const servers = [workServer, profileServer, contactServer];
  let connected = false;
  let closed = false;

  return {
    router,
    async connect() {
      if (connected || closed) return;
      await Promise.all(servers.map((server) => server.connect()));
      connected = true;
    },
    async close() {
      if (closed) return;
      closed = true;
      // allSettled keeps close idempotent and silent: a server that never
      // connected (or was already closed) cannot throw out of here.
      await Promise.allSettled(
        servers.map((server) =>
          Promise.resolve().then(() => server.close()),
        ),
      );
    },
  };
}

/** Convenience for request logging: the model-facing agent name. */
export function getAgentName(agent: Agent): string {
  return agent.name;
}
