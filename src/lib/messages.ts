import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Cache tag shared by the admin messages list. Revalidate after a mutation. */
export const MESSAGES_TAG = "messages";

export type AdminMessage = {
  id: string;
  email: string;
  message: string;
  read: boolean;
  createdAt: string;
};

/**
 * All contact submissions, newest first.
 *
 * Admin data must always be fresh, so this is intentionally uncached. It must
 * only be called from an async component wrapped in <Suspense>, never from a
 * page shell (Cache Components rule).
 */
export async function getMessages(): Promise<AdminMessage[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("messages")
      .select("id, email, message, is_read, created_at")
      .order("created_at", { ascending: false });

    if (error || !data) {
      if (error) console.error("[messages] failed to read messages:", error);
      return [];
    }

    return data.map((row) => ({
      id: String(row.id),
      email: String(row.email),
      message: String(row.message),
      read: Boolean(row.is_read),
      createdAt: String(row.created_at),
    }));
  } catch (error) {
    console.error("[messages] unexpected error reading messages:", error);
    return [];
  }
}
