import "server-only";

import { Agent, setTracingDisabled } from "@openai/agents";

import { buildStoreDemoInstructions } from "@/lib/chat/skills/load";
import { checkStockTool, lookupOrderTool } from "@/lib/chat/store-demo-tools";

// Store demo traffic must never reach the OpenAI traces dashboard.
setTracingDisabled(true);

/**
 * The store bot's model settings: small cap (reasoning tokens count toward
 * it), low reasoning effort, no temperature.
 */
const MODEL_SETTINGS = {
  maxTokens: 600,
  reasoning: { effort: "low" as const },
};

/**
 * Builds ONE store demo agent per request: NO handoffs, NO Router, NO MCP
 * servers — just its two local read-only tools over the fake store data.
 * Fully isolated from the portfolio agents, knowledge.ts and the database.
 */
export function createStoreDemoAgent(): Agent {
  // Read at call time so a missing variable fails clearly per request.
  const model = process.env.OPENAI_MODEL?.trim();
  if (!model) throw new Error("OPENAI_MODEL is not set");

  return new Agent({
    name: "Store agent",
    instructions: buildStoreDemoInstructions(),
    model,
    modelSettings: MODEL_SETTINGS,
    tools: [lookupOrderTool, checkStockTool],
  });
}
