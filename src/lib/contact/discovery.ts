/**
 * The in-chat "Discovery form" wizard — the canonical values shared by the
 * wizard component (client) and the submit action (server).
 *
 * The display questions / labels live in `content.askAi.discovery`; the
 * choice strings, the limits and the payload shape live here, so the client
 * and the server can never drift apart. No server imports only.
 */

/** The five project types (step 1 choices, exact server-side values). */
export const DISCOVERY_TYPES = [
  "Simple website",
  "E-commerce store",
  "AI chatbot or agent",
  "Web app or dashboard",
  "Something else",
] as const;

export type DiscoveryType = (typeof DISCOVERY_TYPES)[number];

/** The value that opens the extra "Something else" text box. */
export const DISCOVERY_OTHER: DiscoveryType = "Something else";

/** The four timeline choices (step 4, exact server-side values). */
export const DISCOVERY_TIMES = [
  "2 weeks",
  "1 month",
  "2-3 months",
  "Just an idea",
] as const;

export type DiscoveryTime = (typeof DISCOVERY_TIMES)[number];

/** Character limits (all enforced after trim, on both sides). */
export const DISCOVERY_LIMITS = {
  /** business / need */
  textMin: 2,
  textMax: 500,
  /** the "Something else" text box (step 1) */
  otherMin: 2,
  otherMax: 200,
  /** the optional "Anything else?" input (step 4) */
  extraMax: 300,
  /** the whole formatted message stored in the `messages` table */
  messageMax: 2000,
} as const;

/** The wizard's one submit payload — never sent to the model, never persisted
 * anywhere except the formatted text in the `messages` table. */
export type DiscoveryPayload = {
  /** One of DISCOVERY_TYPES. */
  type: string;
  /** Only when `type` is DISCOVERY_OTHER. */
  typeOther: string;
  /** Step 2. */
  business: string;
  /** Step 3. */
  need: string;
  /** One of DISCOVERY_TIMES. */
  time: string;
  /** Optional step 4 "Anything else?" input. */
  extra: string;
  /** Step 5 — goes into the existing `email` column. */
  email: string;
  /** The shared honeypot field (same name the Contact popup uses). */
  company?: string | null;
};
