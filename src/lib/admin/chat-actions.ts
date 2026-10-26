"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

export type ChatSessionRow = {
  id: string;
  lastMessageAt: string;
  messageCount: number;
  preview: string | null;
};

export type ChatSessionsPage = {
  sessions: ChatSessionRow[];
  page: number;
  hasNext: boolean;
};

export type ChatMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentName: string | null;
  createdAt: string;
};

export type ChatThread = {
  id: string;
  startedAt: string;
  messageCount: number;
  messages: ChatMessageRow[];
};

export type ChatActionResult = { ok: true } | { ok: false; error: string };

const PAGE_SIZE = 25;
const MAX_PAGE = 1_000_000;
const PREVIEW_LENGTH = 90;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function clampPage(value: number): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(1, parsed), MAX_PAGE);
}

function truncatePreview(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= PREVIEW_LENGTH) return normalized;
  return `${normalized.slice(0, PREVIEW_LENGTH)}…`;
}

/**
 * One page of chat sessions, newest last activity first. The first user
 * message of each session is fetched for the page's sessions in one extra
 * query, so the list never issues one query per row.
 */
export async function listChatSessions(
  page: number,
): Promise<ChatSessionsPage> {
  await requireAdmin();

  const current = clampPage(page);

  try {
    const admin = createAdminClient();
    const offset = (current - 1) * PAGE_SIZE;

    // .range is inclusive on both ends, so size + 1 rows tells us whether a
    // next page exists.
    const { data, error } = await admin
      .from("chat_sessions")
      .select("id, last_message_at, message_count")
      .order("last_message_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE);

    if (error) {
      console.error("[chats] failed to read chat sessions:", error);
      return { sessions: [], page: current, hasNext: false };
    }

    const rows = (data ?? []) as Array<{
      id?: unknown;
      last_message_at?: unknown;
      message_count?: unknown;
    }>;

    const hasNext = rows.length > PAGE_SIZE;
    const pageRows = rows.slice(0, PAGE_SIZE).filter((row) => {
      return (
        typeof row.id === "string" &&
        typeof row.last_message_at === "string" &&
        typeof row.message_count === "number"
      );
    });

    const sessions: ChatSessionRow[] = pageRows.map((row) => ({
      id: row.id as string,
      lastMessageAt: row.last_message_at as string,
      messageCount: row.message_count as number,
      preview: null,
    }));

    const ids = sessions.map((session) => session.id);

    if (ids.length > 0) {
      const { data: firstMessages, error: firstError } = await admin
        .from("chat_messages")
        .select("session_id, content")
        .in("session_id", ids)
        .eq("role", "user")
        .order("created_at", { ascending: true });

      if (firstError) {
        console.error("[chats] failed to read previews:", firstError);
      } else if (firstMessages) {
        const seen = new Set<string>();
        for (const row of firstMessages as Array<{
          session_id?: unknown;
          content?: unknown;
        }>) {
          const sessionId = row.session_id;
          const content = row.content;
          if (
            typeof sessionId !== "string" ||
            typeof content !== "string" ||
            seen.has(sessionId)
          ) {
            continue;
          }
          seen.add(sessionId);
          const session = sessions.find((item) => item.id === sessionId);
          if (session) {
            session.preview = truncatePreview(content);
          }
        }
      }
    }

    return { sessions, page: current, hasNext };
  } catch (error) {
    console.error("[chats] unexpected error reading chat sessions:", error);
    return { sessions: [], page: current, hasNext: false };
  }
}

/**
 * One conversation: the session (never the ip_hash) plus its transcript,
 * oldest first. Returns null for an invalid id, an unknown id or a read
 * failure — the caller treats all three as "not found".
 */
export async function getChatThread(id: string): Promise<ChatThread | null> {
  await requireAdmin();

  if (!isUuid(id)) return null;

  try {
    const admin = createAdminClient();
    const { data: session, error: sessionError } = await admin
      .from("chat_sessions")
      .select("id, started_at, message_count")
      .eq("id", id)
      .maybeSingle();

    if (sessionError || !session) {
      if (sessionError) {
        console.error("[chats] failed to read the chat session:", sessionError);
      }
      return null;
    }

    const sessionRow = session as {
      id?: unknown;
      started_at?: unknown;
      message_count?: unknown;
    };

    if (
      typeof sessionRow.id !== "string" ||
      typeof sessionRow.started_at !== "string"
    ) {
      return null;
    }

    const { data: messages, error: messagesError } = await admin
      .from("chat_messages")
      .select("id, role, content, agent_name, created_at")
      .eq("session_id", id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (messagesError) {
      console.error("[chats] failed to read the transcript:", messagesError);
      return null;
    }

    const messageRows: ChatMessageRow[] = ((messages ?? []) as Array<{
      id?: unknown;
      role?: unknown;
      content?: unknown;
      agent_name?: unknown;
      created_at?: unknown;
    }>)
      .filter(
        (row) =>
          typeof row.id === "string" &&
          (row.role === "user" || row.role === "assistant") &&
          typeof row.content === "string" &&
          typeof row.created_at === "string",
      )
      .map((row) => ({
        id: row.id as string,
        role: row.role as ChatMessageRow["role"],
        content: row.content as string,
        agentName: typeof row.agent_name === "string" ? row.agent_name : null,
        createdAt: row.created_at as string,
      }));

    return {
      id: sessionRow.id,
      startedAt: sessionRow.started_at,
      messageCount:
        typeof sessionRow.message_count === "number"
          ? sessionRow.message_count
          : messageRows.length,
      messages: messageRows,
    };
  } catch (error) {
    console.error("[chats] unexpected error reading the thread:", error);
    return null;
  }
}

/**
 * Deletes one conversation. Its messages cascade (008_chat.sql). Returns
 * ok:false when a uuid is not supplied or when the delete fails.
 */
export async function deleteChatSession(id: string): Promise<ChatActionResult> {
  await requireAdmin();

  if (!isUuid(id)) {
    return { ok: false, error: "Invalid conversation id." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("chat_sessions")
      .delete()
      .eq("id", id);

    if (error) {
      return { ok: false, error: "Could not delete the conversation." };
    }
  } catch {
    return { ok: false, error: "Could not delete the conversation." };
  }

  revalidatePath("/admin/chats");
  return { ok: true };
}
