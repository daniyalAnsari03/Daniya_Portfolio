"use server";

import { headers } from "next/headers";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { MESSAGES_TAG } from "@/lib/messages";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_MAX = 2000;

/** Basic in-memory rate limit: 5 submissions per IP per 10 minutes. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const recentHits = new Map<string, number[]>();

export type ContactFormState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      message: string;
      fieldErrors?: { email?: string; message?: string };
    };

export async function submitContactMessage(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  // Honeypot: bots fill hidden fields. Pretend success without storing anything.
  if (String(formData.get("company") ?? "").trim()) {
    return { status: "success" };
  }

  const fieldErrors: { email?: string; message?: string } = {};
  if (!EMAIL_RE.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (message.length === 0) {
    fieldErrors.message = "Please write a message.";
  } else if (message.length > MESSAGE_MAX) {
    fieldErrors.message = `Message must be ${MESSAGE_MAX} characters or fewer.`;
  }

  if (fieldErrors.email || fieldErrors.message) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  // Rate limit (best effort; per server instance).
  let ip = "unknown";
  try {
    const headerList = await headers();
    const forwarded = headerList.get("x-forwarded-for");
    ip =
      (forwarded ? forwarded.split(",")[0]?.trim() : "") ||
      headerList.get("x-real-ip") ||
      "unknown";
  } catch {
    // headers() unavailable — fall through with the default bucket.
  }

  const now = Date.now();
  const recent = (recentHits.get(ip) ?? []).filter(
    (time) => now - time < RATE_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT) {
    return {
      status: "error",
      message: "Too many messages sent. Please try again later.",
    };
  }
  recent.push(now);
  recentHits.set(ip, recent);

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("messages").insert({ email, message });
    if (error) {
      console.error("[contact] failed to insert message:", error);
      return {
        status: "error",
        message: "Something went wrong. Please try again.",
      };
    }
  } catch (error) {
    console.error("[contact] unexpected error inserting message:", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again.",
    };
  }

  revalidateTag(MESSAGES_TAG, { expire: 0 });
  return { status: "success" };
}
