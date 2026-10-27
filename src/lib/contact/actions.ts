"use server";

import { headers } from "next/headers";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashIp } from "@/lib/chat/ip";
import { checkRateLimitWithKey } from "@/lib/chat/sessions";
import { MESSAGES_TAG } from "@/lib/messages";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** The Contact popup's own limit (the shared default). */
const MESSAGE_MAX = 2000;
/** The in-chat form's message limit (same fields as the popup: email/message). */
const CHAT_MESSAGE_MAX = 1000;

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
    return { status: "error", message: RATE_LIMIT_ERROR };
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
 * The in-chat contact form's submit path (ContactFormCard.tsx). Shares the
 * popup's validation + honeypot + insert; adds the chat budget
 * (`check_chat_rate_limit`, key `${ipHash}:contact`, 5 per 600 s).
 * Fields: email, message (+ the shared `company` honeypot).
 */
export async function submitChatContactMessage(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const validated = validateContactSubmission(
    {
      email: String(formData.get("email") ?? ""),
      message: String(formData.get("message") ?? ""),
      company: String(formData.get("company") ?? ""),
    },
    { messageMax: CHAT_MESSAGE_MAX },
  );

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
      return { status: "error", message: RATE_LIMIT_ERROR };
    }
  } catch (error) {
    console.error(
      "[contact] chat form rate limit check failed:",
      error instanceof Error ? `${error.message.slice(0, 200)}` : error,
    );
    return { status: "error", message: GENERIC_ERROR };
  }

  const { values } = validated;
  // Only the message text is stored — exactly like the Contact popup.
  return persistContactMessage({
    email: values.email,
    message: values.message,
  });
}
