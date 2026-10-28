import "server-only";

import { tool } from "@openai/agents";
import { z } from "zod";

import {
  STORE_DEMO_ORDERS,
  STORE_DEMO_PRODUCTS,
  type StoreDemoOrder,
  type StoreDemoProduct,
} from "@/lib/chat/store-demo-data";
import { TOOL_CHECK_STOCK, TOOL_LOOKUP_ORDER } from "@/lib/chat/tool-names";

/**
 * The "Store demo" mode's two LOCAL read-only tools (docs/fix.txt).
 *
 * They answer ONLY from the hardcoded fake store data in
 * store-demo-data.ts: no knowledge.ts, no MCP, no database, no env, no
 * portfolio data. One agent per request runs with exactly these two tools.
 */

type OrderLookupResult = StoreDemoOrder | { found: false };
type StockResult = StoreDemoProduct | { found: false };

/**
 * One order by number: trimmed, "#" stripped, case-insensitive number match.
 * Returns the whole order object or `{ found: false }` — never an error for
 * a simply unknown number.
 */
export const lookupOrderTool = tool({
  name: TOOL_LOOKUP_ORDER,
  description:
    "Look up one store order by its order number and return its items, status, delivery and city.",
  parameters: z.object({
    order_number: z
      .string()
      .min(1)
      .max(20)
      .describe("The order number, digits like 1021 with or without a # prefix."),
  }),
  execute: async ({ order_number }): Promise<string> => {
    const normalized = order_number.trim().replace(/#/g, "").toLowerCase();
    const order = STORE_DEMO_ORDERS.find(
      (entry) => entry.orderNumber.toLowerCase() === normalized,
    );
    const result: OrderLookupResult = order ?? { found: false };
    return JSON.stringify(result);
  },
});

/**
 * One product's price and stock: trimmed, case-insensitive match allowing a
 * simple contains match in both directions ("hoodie", "Hoodie in stock").
 * Returns the product object or `{ found: false }`.
 */
export const checkStockTool = tool({
  name: TOOL_CHECK_STOCK,
  description:
    "Check a clothing product's price and current stock by its name.",
  parameters: z.object({
    product: z
      .string()
      .min(1)
      .max(60)
      .describe("The product name, for example Hoodie or Denim Jacket."),
  }),
  execute: async ({ product }): Promise<string> => {
    const query = product.trim().toLowerCase();
    const match = query
      ? STORE_DEMO_PRODUCTS.find((entry) => {
          const name = entry.name.toLowerCase();
          return name.includes(query) || query.includes(name);
        })
      : undefined;
    const result: StockResult = match ?? { found: false };
    return JSON.stringify(result);
  },
});
