import type { ChatStatus } from "@/lib/chat/status-events";

/** Who sent a chat message. */
export type ChatRole = "user" | "assistant";

/**
 * One message in the conversation. The conversation lives in memory only —
 * it is never persisted.
 */
export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  /**
   * A streamed answer that already finished on screen: render it as plain
   * text with no entrance animation (the words were already shown).
   */
  settled?: boolean;
  /** An error line committed to the history — no read/copy buttons. */
  error?: boolean;
  /**
   * The agent steps that ran while this answer was prepared. In memory only —
   * never persisted, stored in localStorage or copied.
   */
  steps?: ChatStatus[];
};

/** The three palettes the chat drawer can be themed with. */
export type ChatTheme = "light" | "dark" | "gray";

/** The states of the voice mode. */
export type VoiceStatus = "idle" | "listening" | "thinking" | "speaking";
