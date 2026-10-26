import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ChatThread, {
  type ThreadMessage,
} from "@/components/admin/ChatThread";
import { getChatThread } from "@/lib/admin/chat-actions";

export const metadata: Metadata = {
  title: "Chats",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

async function ThreadContent({ id }: { id: string }) {
  const thread = await getChatThread(id);

  if (!thread) notFound();

  const messages: ThreadMessage[] = thread.messages.map((message) => ({
    id: message.id,
    roleLabel: message.role === "assistant" ? "Assistant" : "Visitor",
    agentLabel: message.role === "assistant" ? message.agentName : null,
    timeLabel: `${formatDate(message.createdAt)} UTC`,
    content: message.content,
  }));

  return (
    <ChatThread
      sessionId={thread.id}
      startedLabel={`${formatDate(thread.startedAt)} UTC`}
      messageCount={thread.messageCount}
      messages={messages}
    />
  );
}

function ThreadSkeleton() {
  return (
    <div className="mt-8 space-y-3" aria-hidden="true">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-24 animate-pulse rounded-2xl border border-black/10 bg-white"
        />
      ))}
    </div>
  );
}

export default async function AdminChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/admin/chats"
        className="text-sm text-black/50 transition-colors hover:text-[#111111]"
      >
        ← Back to chats
      </Link>
      <h1 className="mt-4 text-2xl font-medium tracking-[-0.03em]">
        Conversation
      </h1>
      <p className="mt-2 text-sm text-black/50">
        The transcript, oldest first.
      </p>
      <Suspense fallback={<ThreadSkeleton />}>
        <ThreadContent id={id} />
      </Suspense>
    </div>
  );
}
