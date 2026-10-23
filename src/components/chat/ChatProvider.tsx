"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * The chat drawer is only needed once the user opens it, so it is loaded
 * lazily — the module is requested on the first click.
 */
const ChatDrawer = dynamic(() => import("./ChatDrawer"), { ssr: false });

type ChatContextValue = {
  /** `true` while the chat drawer is open. */
  open: boolean;
  openChat: () => void;
  closeChat: () => void;
  /** The Ask AI tab — the focus returns here when the drawer closes. */
  triggerRef: RefObject<HTMLButtonElement | null>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}

/**
 * Holds the state of the chat drawer. It lives in the shared (public) layout,
 * OUTSIDE the transitioning page content, so the drawer is never part of a
 * transformed wrapper and the page transition never touches it.
 *
 * The conversation itself is NOT stored here — it lives in the drawer's own
 * state, in memory only, and is never persisted.
 */
export default function ChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // The drawer is mounted from the first click on, so the lazy chunk is only
  // requested when the user actually opens the chat.
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const openChat = useCallback(() => {
    setMounted(true);
    setOpen(true);
  }, []);

  const closeChat = useCallback(() => setOpen(false), []);

  const handleExited = useCallback(() => {
    setMounted(false);
    triggerRef.current?.focus();
  }, []);

  const value = useMemo(
    () => ({ open, openChat, closeChat, triggerRef }),
    [open, openChat, closeChat],
  );

  return (
    <ChatContext.Provider value={value}>
      {children}
      {mounted ? (
        <ChatDrawer open={open} onClose={closeChat} onExited={handleExited} />
      ) : null}
    </ChatContext.Provider>
  );
}
