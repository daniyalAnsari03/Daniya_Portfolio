"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteMessage,
  setMessageRead,
} from "@/lib/admin/message-actions";

export type MessageRow = {
  id: string;
  email: string;
  message: string;
  read: boolean;
  dateLabel: string;
};

export default function MessagesList({ messages }: { messages: MessageRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleRead(row: MessageRow) {
    setError(null);
    startTransition(async () => {
      const result = await setMessageRead(row.id, !row.read);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  function remove(row: MessageRow) {
    setError(null);
    startTransition(async () => {
      const result = await deleteMessage(row.id);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  if (messages.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/50">
        No messages yet.
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

      {messages.map((row) => (
        <article
          key={row.id}
          className="rounded-2xl border border-black/10 bg-white p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <a
                  href={`mailto:${row.email}`}
                  className="truncate text-sm font-medium text-[#111111] hover:underline"
                >
                  {row.email}
                </a>
                {!row.read && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                    Unread
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-black/40">{row.dateLabel}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => toggleRead(row)}
                disabled={pending}
                className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 disabled:opacity-50"
              >
                {row.read ? "Mark as unread" : "Mark as read"}
              </button>
              <button
                type="button"
                onClick={() => remove(row)}
                disabled={pending}
                className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-black/70">
            {row.message}
          </p>
        </article>
      ))}
    </div>
  );
}
