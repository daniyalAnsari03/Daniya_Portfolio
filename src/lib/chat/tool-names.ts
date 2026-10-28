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

/**
 * A LOCAL function tool (never exposed through /api/mcp): the Contact agent's
 * only signal to the UI that the in-chat contact form should appear. It has
 * no arguments, no data access and is given to no other agent.
 */
export const TOOL_SHOW_CONTACT_FORM = "show_contact_form";

/**
 * The two LOCAL read-only tools of the "Store demo" mode (docs/fix.txt).
 * They are not MCP tools and read only the hardcoded fake store data —
 * no database, no env, no portfolio knowledge.
 */
export const TOOL_LOOKUP_ORDER = "lookup_order";
export const TOOL_CHECK_STOCK = "check_stock";

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
