import { Suspense } from "react";
import type { Metadata } from "next";
import MessagesList, {
  type MessageRow,
} from "@/components/admin/MessagesList";
import { getMessages } from "@/lib/messages";

export const metadata: Metadata = {
  title: "Messages",
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

async function MessagesContent() {
  const messages = await getMessages();
  const rows: MessageRow[] = messages.map((message) => ({
    id: message.id,
    email: message.email,
    message: message.message,
    read: message.read,
    dateLabel: `${formatDate(message.createdAt)} UTC`,
  }));

  return <MessagesList messages={rows} />;
}

function MessagesSkeleton() {
  return (
    <div className="mt-8 space-y-3" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-32 animate-pulse rounded-2xl border border-black/10 bg-white"
        />
      ))}
    </div>
  );
}

export default function AdminMessagesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-medium tracking-[-0.03em]">Messages</h1>
      <p className="mt-2 text-sm text-black/50">
        Contact popup submissions, newest first.
      </p>
      <Suspense fallback={<MessagesSkeleton />}>
        <MessagesContent />
      </Suspense>
    </div>
  );
}
