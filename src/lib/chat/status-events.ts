/**
 * The tiny, model-independent status stream the chat routes send while the
 * agents are working (docs/fix.txt, chatbot step 7c + store demo).
 *
 * Client-safe: the browser imports only the types (never any server code).
 * The values are enums built on the server — no tool names, arguments,
 * results, prompts or model text ever travel in a status event.
 */

export type ChatAgentName = "Router" | "Work" | "Profile" | "Contact";

/**
 * The single agent of the "Store demo" mode. It appears in status events
 * only — the exact same enum trick as the main chat's agents.
 */
export const STORE_AGENT_NAME = "Store agent" as const;

export type ChatStatusTopic =
  | "projects"
  | "project_detail"
  | "cv"
  | "about"
  | "contact"
  | "notes"
  | "order"
  | "stock";

export type ChatStatus =
  | { phase: "routing"; agent: "Router" }
  | { phase: "handoff"; from: "Router"; to: "Work" | "Profile" | "Contact" }
  | {
      phase: "lookup";
      agent: "Work" | "Profile" | "Contact" | typeof STORE_AGENT_NAME;
      topic: ChatStatusTopic;
    }
  | { phase: "writing"; agent: "Work" | "Profile" | "Contact" | typeof STORE_AGENT_NAME }
  /** The store demo's first step: the run started (no "routing" there). */
  | { phase: "agent"; name: typeof STORE_AGENT_NAME };

/** The main chat's specialist agents (never the store agent). */
export type ChatSpecialistAgent = "Work" | "Profile" | "Contact";
