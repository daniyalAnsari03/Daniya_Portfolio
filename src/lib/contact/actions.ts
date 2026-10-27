"use server";

import { headers } from "next/headers";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashIp } from "@/lib/chat/ip";
import { checkRateLimitWithKey } from "@/lib/chat/sessions";
import { MESSAGES_TAG } from "@/lib/messages";
import {
  DISCOVERY_LIMITS,
  DISCOVERY_OTHER,
  DISCOVERY_TIMES,
  DISCOVERY_TYPES,
  type DiscoveryPayload,
  type DiscoveryTime,
  type DiscoveryType,
} from "@/lib/contact/discovery";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** The Contact popup's own limit (the shared default). */
const MESSAGE_MAX = 2000;

/** Basic shared in-memory rate limit: 5 submissions per IP per 10 minutes. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const recentHits = new Map<string, number[]>();

/** Shared error copy (never leaks internals). */
const RATE_LIMIT_ERROR = "Too many messages sent. Please try again later.";
const GENERIC_ERROR = "Something went wrong. Please try again.";

export type ContactFormState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      message: string;
      /**
       * The error "family" so a client can pick its own copy for a known
       * case. Optional — every unknown/blank case still carries `message`.
       */
      kind?: "rate-limited" | "invalid";
      fieldErrors?: {
        email?: string;
        message?: string;
      };
    };

export type ContactSubmission = {
  email: string;
  message: string;
  /** The honeypot field — bots fill hidden fields; the shared field name is `company`. */
  company?: string | null;
};

type ValidatedContactMessage = {
  email: string;
  message: string;
};

/**
 * Shared validation + honeypot (one place, both surfaces).
 * `messageMax` carries the per-surface limit: the popup validates its default
 * (2000-char message), the in-chat form 1000.
 */
function validateContactSubmission(
  submission: ContactSubmission,
  limits: { messageMax?: number | null } = {},
): { status: "ok"; values: ValidatedContactMessage } | { status: "error"; state: ContactFormState } {
  // Honeypot: bots fill hidden fields. Pretend success without storing anything.
  if (String(submission.company ?? "").trim()) {
    return { status: "ok", values: { email: "", message: "" } };
  }

  const email = String(submission.email ?? "").trim();
  const message = String(submission.message ?? "").trim();
  const messageMax = limits.messageMax ?? MESSAGE_MAX;

  const fieldErrors: { email?: string; message?: string } = {};

  if (!EMAIL_RE.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (message.length === 0) {
    fieldErrors.message = "Please write a message.";
  } else if (message.length > messageMax) {
    fieldErrors.message = `Message must be ${messageMax} characters or fewer.`;
  }

  if (fieldErrors.email || fieldErrors.message) {
    return {
      status: "error",
      state: {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors,
      },
    };
  }

  return { status: "ok", values: { email, message } };
}

/** The client's IP for the in-memory per-instance limiter (best effort). */
function ipFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  return (
    (forwarded ? forwarded.split(",")[0]?.trim() : "") ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Shared rate limiting + insert into `messages` + cache revalidation.
 * The honeypot success short-circuits before this point.
 */
async function persistContactMessage(
  values: ValidatedContactMessage,
): Promise<ContactFormState> {
  let ip = "unknown";
  try {
    const headerList = await headers();
    ip = ipFromHeaders(headerList);
  } catch {
    // headers() unavailable — fall through with the default bucket.
  }

  const now = Date.now();
  const recent = (recentHits.get(ip) ?? []).filter(
    (time) => now - time < RATE_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT) {
    return { status: "error", message: RATE_LIMIT_ERROR, kind: "rate-limited" };
  }
  recent.push(now);
  recentHits.set(ip, recent);

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("messages").insert({
      email: values.email,
      message: values.message,
    });
    if (error) {
      console.error("[contact] failed to insert message:", error);
      return { status: "error", message: GENERIC_ERROR };
    }
  } catch (error) {
    console.error("[contact] unexpected error inserting message:", error);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidateTag(MESSAGES_TAG, { expire: 0 });
  return { status: "success" };
}

/**
 * The Contact popup's submit path (ContactForm.tsx via useActionState).
 * Fields: email, message (+ the shared `company` honeypot).
 */
export async function submitContactMessage(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const validated = validateContactSubmission({
    email: String(formData.get("email") ?? ""),
    message: String(formData.get("message") ?? ""),
    company: String(formData.get("company") ?? ""),
  });

  if (validated.status === "error") return validated.state;

  // The honeypot tripped: pretend success without storing anything.
  if (!validated.values.email) return { status: "success" };

  return persistContactMessage(validated.values);
}

/**
 * The in-chat "Discovery form" wizard's server-side core.
 *
 * The five answers are validated, cleaned and formatted into ONE string that
 * is stored in the existing `message` column of the `messages` table (one
 * item per line); the email goes into the existing `email` column exactly
 * like the popup. Nothing is stored anywhere else: no extra tables, no new
 * columns, nothing in `chat_messages` and never anything sent to the model.
 */

/** Removes control characters but keeps line breaks and normal text. */
function stripControlChars(value: string): string {
  return String(value).replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    "",
  );
}

function validTrimmedLength(value: string, min: number, max: number): boolean {
  const length = stripControlChars(value).trim().length;
  return length >= min && length <= max;
}

/**
 * The formatted message stored in the `messages.message` column — one item
 * per line. `Something else` keeps the visitor's own wording on the Type
 * line. Extra is only ever printed when it was actually provided.
 */
function formatDiscoveryMessage(input: {
  type: DiscoveryType;
  typeOther: string;
  business: string;
  need: string;
  time: DiscoveryTime;
  extra: string;
}): string {
  const typeLine =
    input.type === DISCOVERY_OTHER && input.typeOther
      ? `${input.type} — ${input.typeOther}`
      : input.type;

  const lines = [
    `Type: ${typeLine}`,
    `Business: ${input.business}`,
    `Need: ${input.need}`,
    `Time: ${input.time}`,
  ];
  if (input.extra) lines.push(`Extra: ${input.extra}`);
  return lines.join("\n");
}

/**
 * Discovery validation. Every unknown value, out-of-range length, bad email
 * or oversized result is rejected with the same generic invalid state.
 */
function validateDiscoverySubmission(
  payload: DiscoveryPayload,
):
  | { status: "ok"; values: ValidatedContactMessage }
  | { status: "error"; state: ContactFormState } {
  const invalid: { status: "error"; state: ContactFormState } = {
    status: "error",
    state: {
      status: "error",
      message: "Please check your answers and try again.",
      kind: "invalid",
    },
  };

  // Honeypot: bots fill hidden fields. Pretend success without storing anything.
  if (String(payload.company ?? "").trim()) {
    return { status: "ok", values: { email: "", message: "" } };
  }

  if (!(DISCOVERY_TYPES as readonly string[]).includes(payload.type)) {
    return invalid;
  }
  if (!(DISCOVERY_TIMES as readonly string[]).includes(payload.time)) {
    return invalid;
  }

  const type = payload.type as DiscoveryType;
  const time = payload.time as DiscoveryTime;

  // The "Something else" wording is required exactly when the choice says so;
  // any stray value for a fixed choice is rejected.
  const typeOther = stripControlChars(payload.typeOther ?? "").trim();
  if (type === DISCOVERY_OTHER) {
    if (
      typeOther.length < DISCOVERY_LIMITS.otherMin ||
      typeOther.length > DISCOVERY_LIMITS.otherMax
    ) {
      return invalid;
    }
  } else if (typeOther) {
    return invalid;
  }

  const business = stripControlChars(payload.business ?? "").trim();
  const need = stripControlChars(payload.need ?? "").trim();
  const extra = stripControlChars(payload.extra ?? "").trim();
  const email = stripControlChars(payload.email ?? "").trim();

  if (!validTrimmedLength(business, DISCOVERY_LIMITS.textMin, DISCOVERY_LIMITS.textMax)) {
    return invalid;
  }
  if (!validTrimmedLength(need, DISCOVERY_LIMITS.textMin, DISCOVERY_LIMITS.textMax)) {
    return invalid;
  }
  if (extra.length > DISCOVERY_LIMITS.extraMax) {
    return invalid;
  }
  if (!EMAIL_RE.test(email)) {
    return invalid;
  }

  const formatted = formatDiscoveryMessage({ type, typeOther, business, need, time, extra });
  if (formatted.length > DISCOVERY_LIMITS.messageMax) {
    return invalid;
  }

  return { status: "ok", values: { email, message: formatted } };
}

/**
 * The in-chat Discovery form wizard's submit path (ContactFormCard.tsx).
 * Shares the popup's insert + honeypot + cache revalidation; adds the chat
 * budget (`check_chat_rate_limit`, key `${ipHash}:contact`, 5 per 600 s).
 * Form values never go to `chat_messages` and never to the model.
 */
export async function submitChatDiscoveryMessage(
  payload: DiscoveryPayload,
): Promise<ContactFormState> {
  const validated = validateDiscoverySubmission(payload);

  if (validated.status === "error") return validated.state;

  // The honeypot tripped: pretend success without storing anything.
  if (!validated.values.email) return { status: "success" };

  // The hashed-IP budget in the chat rate-limit table, namespaced so the chat
  // and TTS counters never share one. Missing env fails closed with a generic
  // error; the RPC is hard-required before anything is stored.
  let ipHash: string;
  try {
    const headerList = await headers();
    ipHash = hashIp(ipFromHeaders(headerList));
    const budget = await checkRateLimitWithKey(`${ipHash}:contact`, 5, 600);
    if (!budget.allowed) {
      return { status: "error", message: RATE_LIMIT_ERROR, kind: "rate-limited" };
    }
  } catch (error) {
    console.error(
      "[contact] chat form rate limit check failed:",
      error instanceof Error ? `${error.message.slice(0, 200)}` : error,
    );
    return { status: "error", message: GENERIC_ERROR };
  }

  // Only the formatted text is stored — exactly like the Contact popup.
  return persistContactMessage(validated.values);
}
