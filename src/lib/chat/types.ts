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
};

/** The three palettes the chat drawer can be themed with. */
export type ChatTheme = "light" | "dark" | "gray";

/** The states of the voice mode. */
export type VoiceStatus = "idle" | "listening" | "thinking" | "speaking";
