"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteChatSession } from "@/lib/admin/chat-actions";

export type ChatRow = {
  id: string;
  dateLabel: string;
  messageCount: number;
  preview: string | null;
};

export default function ChatsList({ rows }: { rows: ChatRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteChatSession(id);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/50">
        No conversations yet.
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-3">
      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}

      {rows.map((row) => (
        <article
          key={row.id}
          className="rounded-2xl border border-black/10 bg-white p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/admin/chats/${row.id}`}
                className="truncate text-sm font-medium text-[#111111] hover:underline"
              >
                Conversation
              </Link>
              <p className="mt-1 text-xs text-black/40">
                {row.dateLabel} ·{" "}
                {row.messageCount === 1
                  ? "1 message"
                  : `${row.messageCount} messages`}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/admin/chats/${row.id}`}
                className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
              >
                View
              </Link>
              <button
                type="button"
                onClick={() => remove(row.id)}
                disabled={pending}
                className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>

          <Link
            href={`/admin/chats/${row.id}`}
            className="mt-3 block min-w-0"
          >
            <p className="truncate text-sm text-black/70">
              {row.preview ?? "—"}
            </p>
          </Link>
        </article>
      ))}
    </div>
  );
}
