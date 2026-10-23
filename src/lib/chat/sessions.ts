import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type ChatRole = "user" | "assistant";

export type ChatHistoryMessage = {
  role: ChatRole;
  content: string;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type ChatSessionRef = {
  id: string;
  isNew: boolean;
};

const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_SECONDS = 600;
const HISTORY_MESSAGE_LIMIT = 20;

function toNonNegativeInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

/**
 * Counts this request against a fixed window keyed by `key`. Any RPC failure is
 * rethrown: the caller must fail closed rather than let unthrottled traffic in.
 *
 * The key is namespaced by the caller (for example `${ipHash}:tts`), so
 * separate budgets never share a counter.
 */
export async function checkRateLimitWithKey(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("check_chat_rate_limit", {
    p_ip_hash: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) throw new Error("Could not check the rate limit");

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0] as
    | {
        allowed?: unknown;
        remaining?: unknown;
        retry_after_seconds?: unknown;
      }
    | undefined;

  if (!row) throw new Error("Could not check the rate limit");

  return {
    allowed: row.allowed === true,
    remaining: toNonNegativeInt(row.remaining),
    retryAfterSeconds: toNonNegativeInt(row.retry_after_seconds),
  };
}

/**
 * Counts this request against the hashed IP's chat fixed window. Any RPC
 * failure is rethrown: the caller must fail closed rather than let unthrottled
 * traffic in.
 */
export async function checkRateLimit(
  ipHash: string,
): Promise<RateLimitResult> {
  return checkRateLimitWithKey(
    ipHash,
    RATE_LIMIT,
    RATE_LIMIT_WINDOW_SECONDS,
  );
}

/**
 * Loads the caller's session only when the stored IP hash matches; otherwise a
 * fresh session is created silently (a mismatched id never confirms that the
 * other session exists).
 */
export async function getOrCreateSession(
  sessionId: string | null,
  ipHash: string,
): Promise<ChatSessionRef> {
  const admin = createAdminClient();

  if (sessionId) {
    const { data, error } = await admin
      .from("chat_sessions")
      .select("id, ip_hash")
      .eq("id", sessionId)
      .maybeSingle();

    if (!error && data) {
      const row = data as { id: string; ip_hash: string };
      if (row.ip_hash === ipHash) {
        return { id: row.id, isNew: false };
      }
    }
  }

  const { data, error } = await admin
    .from("chat_sessions")
    .insert({ ip_hash: ipHash })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Could not create a chat session");
  }

  return { id: (data as { id: string }).id, isNew: true };
}

/**
 * The last 20 messages of a session (10 turns), oldest first.
 */
export async function loadHistory(
  sessionId: string,
): Promise<ChatHistoryMessage[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_MESSAGE_LIMIT);

  if (error) throw new Error("Could not load the chat history");

  const rows = (data ?? []) as Array<{ role?: unknown; content?: unknown }>;
  const messages: ChatHistoryMessage[] = [];

  for (const row of rows) {
    const role = row.role;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof row.content !== "string") continue;
    messages.push({ role, content: row.content });
  }

  messages.reverse();
  return messages;
}

/**
 * Appends one turn and refreshes the session counters.
 */
export async function saveMessage(
  sessionId: string,
  role: ChatRole,
  content: string,
  agentName?: string,
): Promise<void> {
  const admin = createAdminClient();

  const { error: insertError } = await admin.from("chat_messages").insert({
    session_id: sessionId,
    role,
    content,
    agent_name: agentName ?? null,
  });

  if (insertError) throw new Error("Could not save the chat message");

  const { count, error: countError } = await admin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (countError) throw new Error("Could not count the chat messages");

  const { error: updateError } = await admin
    .from("chat_sessions")
    .update({
      last_message_at: new Date().toISOString(),
      message_count: count ?? 0,
    })
    .eq("id", sessionId);

  if (updateError) throw new Error("Could not update the chat session");
}
