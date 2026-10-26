import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import ChatsList, { type ChatRow } from "@/components/admin/ChatsList";
import { listChatSessions } from "@/lib/admin/chat-actions";

export const metadata: Metadata = {
  title: "Chats",
};

const PAGE_SIZE = 25;
const MAX_PAGE = 1_000_000;

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

function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(1, parsed), MAX_PAGE);
}

async function ChatsContent({ page }: { page: number }) {
  const result = await listChatSessions(page);
  const rows: ChatRow[] = result.sessions.map((session) => ({
    id: session.id,
    dateLabel: `${formatDate(session.lastMessageAt)} UTC`,
    messageCount: session.messageCount,
    preview: session.preview,
  }));

  return (
    <>
      <ChatsList rows={rows} />
      <Pagination page={result.page} hasNext={result.hasNext} />
    </>
  );
}

function Pagination({ page, hasNext }: { page: number; hasNext: boolean }) {
  const linkClass =
    "rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5";
  const divClass =
    "rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-black/30";

  return (
    <nav
      aria-label="Chat pages"
      className="mt-6 flex flex-wrap items-center justify-center gap-4"
    >
      {page > 1 ? (
        <Link href={`/admin/chats?page=${page - 1}`} className={linkClass}>
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={divClass}>
          Previous
        </span>
      )}
      <span className="text-xs text-black/50">
        Page {page} · {PAGE_SIZE} per page
      </span>
      {hasNext ? (
        <Link href={`/admin/chats?page=${page + 1}`} className={linkClass}>
          Next
        </Link>
      ) : (
        <span aria-disabled="true" className={divClass}>
          Next
        </span>
      )}
    </nav>
  );
}

function ChatsSkeleton() {
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

export default function AdminChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-medium tracking-[-0.03em]">Chats</h1>
      <p className="mt-2 text-sm text-black/50">
        Ask AI conversations, newest first.
      </p>
      <Suspense fallback={<ChatsSkeleton />}>
        <PageItems searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PageItems({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  return <ChatsContent page={parsePage(params.page)} />;
}
