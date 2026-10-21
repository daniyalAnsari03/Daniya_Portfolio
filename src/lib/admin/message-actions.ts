"use server";

import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { MESSAGES_TAG } from "@/lib/messages";

export type MessageActionResult = { ok: true } | { ok: false; error: string };

export async function setMessageRead(
  id: string,
  read: boolean,
): Promise<MessageActionResult> {
  await requireAdmin();

  if (typeof id !== "string" || !id) {
    return { ok: false, error: "Missing message id." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("messages")
      .update({ is_read: Boolean(read) })
      .eq("id", id);

    if (error) {
      return { ok: false, error: "Could not update the message." };
    }
  } catch {
    return { ok: false, error: "Could not update the message." };
  }

  revalidateTag(MESSAGES_TAG, { expire: 0 });
  return { ok: true };
}

export async function deleteMessage(
  id: string,
): Promise<MessageActionResult> {
  await requireAdmin();

  if (typeof id !== "string" || !id) {
    return { ok: false, error: "Missing message id." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("messages").delete().eq("id", id);

    if (error) {
      return { ok: false, error: "Could not delete the message." };
    }
  } catch {
    return { ok: false, error: "Could not delete the message." };
  }

  revalidateTag(MESSAGES_TAG, { expire: 0 });
  return { ok: true };
}
