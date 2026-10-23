/**
 * Canonical names of the read-only MCP tools the chatbot agents may use.
 *
 * The MCP route and the agents both import from this file so a tool name is
 * never duplicated as a loose string.
 */

export const TOOL_GET_PROJECTS = "get_projects";
export const TOOL_GET_PROJECT_DETAIL = "get_project_detail";
export const TOOL_GET_CV = "get_cv";
export const TOOL_GET_ABOUT = "get_about";
export const TOOL_GET_PUBLIC_CONTACT = "get_public_contact";
export const TOOL_GET_CHATBOT_KNOWLEDGE = "get_chatbot_knowledge";

export const WORK_TOOLS = [
  TOOL_GET_PROJECTS,
  TOOL_GET_PROJECT_DETAIL,
  TOOL_GET_CHATBOT_KNOWLEDGE,
] as const;

export const PROFILE_TOOLS = [
  TOOL_GET_CV,
  TOOL_GET_ABOUT,
  TOOL_GET_CHATBOT_KNOWLEDGE,
] as const;

export const CONTACT_TOOLS = [
  TOOL_GET_PUBLIC_CONTACT,
  TOOL_GET_CHATBOT_KNOWLEDGE,
] as const;
