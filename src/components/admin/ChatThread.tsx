"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteChatSession } from "@/lib/admin/chat-actions";

export type ThreadMessage = {
  id: string;
  roleLabel: string;
  timeLabel: string;
  agentLabel: string | null;
  content: string;
};

export default function ChatThread({
  sessionId,
  startedLabel,
  messageCount,
  messages,
}: {
  sessionId: string;
  startedLabel: string;
  messageCount: number;
  messages: ThreadMessage[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteChatSession(sessionId);
      if (!result.ok) {
        setError(result.error);
        router.refresh();
        return;
      }
      router.push("/admin/chats");
    });
  }

  return (
    <div className="mt-8 space-y-3">
      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white p-5">
        <p className="text-sm text-black/60">
          Started {startedLabel} ·{" "}
          {messageCount === 1
            ? "1 message"
            : `${messageCount} messages`}
        </p>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
        >
          Delete conversation
        </button>
      </div>

      {messages.length === 0 ? (
        <p className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/50">
          No messages.
        </p>
      ) : (
        messages.map((message) => (
          <article
            key={message.id}
            className="rounded-2xl border border-black/10 bg-white p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-[#111111]">
                {message.roleLabel}
                {message.agentLabel && (
                  <span className="ml-2 text-xs font-normal text-black/40">
                    {message.agentLabel}
                  </span>
                )}
              </p>
              <p className="text-xs text-black/40">{message.timeLabel}</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap break-words text-black/70 [overflow-wrap:anywhere]">
              {message.content}
            </p>
          </article>
        ))
      )}
    </div>
  );
}
