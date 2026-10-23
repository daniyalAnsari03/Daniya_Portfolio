/**
 * The tiny, model-independent status stream the chat route sends while the
 * router / specialists are working (docs/fix.txt, chatbot step 7c).
 *
 * Client-safe: the browser imports only the types (never any server code).
 * The values are enums built on the server — no tool names, arguments,
 * results, prompts or model text ever travel in a status event.
 */

export type ChatAgentName = "Router" | "Work" | "Profile" | "Contact";

export type ChatStatusTopic =
  | "projects"
  | "project_detail"
  | "cv"
  | "about"
  | "contact"
  | "notes";

export type ChatStatus =
  | { phase: "routing"; agent: "Router" }
  | { phase: "handoff"; from: "Router"; to: "Work" | "Profile" | "Contact" }
  | {
      phase: "lookup";
      agent: "Work" | "Profile" | "Contact";
      topic: ChatStatusTopic;
    }
  | { phase: "writing"; agent: "Work" | "Profile" | "Contact" };
