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
   * When the message was created (ISO string). In memory only — the WhatsApp
   * skin renders it as a `HH:MM` timestamp inside each bubble; it is never
   * persisted anywhere.
   */
  createdAt: string;
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
  /**
   * The Contact agent asked for the in-chat contact form (`show_contact_form`
   * signal): the form card renders under this message once it settles. In
   * memory only — never persisted and never copied.
   */
  uiForm?: boolean;
};

/** The three palettes the chat drawer can be themed with. */
export type ChatTheme = "light" | "dark" | "gray";

/** The states of the voice mode. */
export type VoiceStatus = "idle" | "listening" | "thinking" | "speaking";
