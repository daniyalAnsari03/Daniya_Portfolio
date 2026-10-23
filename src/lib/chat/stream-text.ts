/**
 * Streaming answer text helpers (client-safe).
 *
 * The server sends raw text deltas that may split in the middle of a word.
 * The UI keeps a buffer, only releases COMPLETE words (a word followed by
 * whitespace) and turns the structure whitespace (`\n\n`, `\n`, `- ` lines)
 * into break tokens so half-built formatting never jumps.
 */

import type { ChatStatus } from "@/lib/chat/status-events";

/** One released piece of the answer. Only words are paced; breaks are instant. */
export type StreamToken =
  | { kind: "word"; text: string }
  | { kind: "space" }
  | { kind: "line" }
  | { kind: "paragraph" }
  | { kind: "list" };

/** The in-progress assistant answer rendered by the conversation. */
export type ChatStreamState = {
  id: string;
  /** Tokens released so far, in order. */
  tokens: StreamToken[];
  /** A user-facing error line shown under the released words. */
  error: string | null;
  /** `true` once the first word has been released. */
  started: boolean;
  /** The live stream is fading out after the answer settled. */
  settling?: boolean;
  /** The full text received so far (clean plain text for copy/collapse). */
  text: string;
  /** The agent steps received so far (shown while thinking / as a summary). */
  steps: ChatStatus[];
};

export type DrainResult = {
  tokens: StreamToken[];
  /** The unfinished tail (a word without trailing whitespace, etc.). */
  rest: string;
  /** Whether the next character starts a line (for the `- ` list marker). */
  lineStart: boolean;
};

function isWhitespace(character: string): boolean {
  return /\s/.test(character);
}

function pushWhitespace(tokens: StreamToken[], whitespace: string): boolean {
  if (!whitespace.includes("\n")) {
    tokens.push({ kind: "space" });
    return false;
  }

  const breaks = whitespace.split("\n").length - 1;
  tokens.push(breaks >= 2 ? { kind: "paragraph" } : { kind: "line" });
  return true;
}

/**
 * Move every COMPLETE word (a word followed by whitespace) out of the buffer.
 * A line starting with "- " becomes a list marker instead of a word.
 */
export function drainCompleteWords(
  buffer: string,
  lineStart: boolean,
): DrainResult {
  const tokens: StreamToken[] = [];
  let index = 0;

  while (index < buffer.length) {
    if (isWhitespace(buffer[index])) {
      let end = index;
      while (end < buffer.length && isWhitespace(buffer[end])) end += 1;
      // The whitespace run may continue in the next chunk — keep it.
      if (end >= buffer.length) break;
      if (pushWhitespace(tokens, buffer.slice(index, end))) lineStart = true;
      index = end;
      continue;
    }

    let end = index;
    while (end < buffer.length && !isWhitespace(buffer[end])) end += 1;
    // No trailing whitespace yet: the word is not complete — keep it.
    if (end >= buffer.length) break;

    const word = buffer.slice(index, end);
    if (lineStart && word === "-") {
      tokens.push({ kind: "list" });
    } else {
      tokens.push({ kind: "word", text: word });
    }
    lineStart = false;
    index = end;
  }

  return { tokens, rest: buffer.slice(index), lineStart };
}

/** Flush the tail when the stream is done (the last word has no trailing space). */
export function flushRemainingWords(
  buffer: string,
  lineStart: boolean,
): StreamToken[] {
  const tokens: StreamToken[] = [];
  let index = 0;

  while (index < buffer.length) {
    if (isWhitespace(buffer[index])) {
      let end = index;
      while (end < buffer.length && isWhitespace(buffer[end])) end += 1;
      if (pushWhitespace(tokens, buffer.slice(index, end))) lineStart = true;
      index = end;
      continue;
    }

    let end = index;
    while (end < buffer.length && !isWhitespace(buffer[end])) end += 1;

    const word = buffer.slice(index, end);
    if (lineStart && word === "-") {
      tokens.push({ kind: "list" });
    } else {
      tokens.push({ kind: "word", text: word });
    }
    lineStart = false;
    index = end;
  }

  return tokens;
}

/** Rebuild clean plain text from released tokens (for committed messages). */
export function tokensToText(tokens: StreamToken[]): string {
  return tokens
    .map((token) => {
      switch (token.kind) {
        case "word":
          return token.text;
        case "space":
          return " ";
        case "line":
          return "\n";
        case "paragraph":
          return "\n\n";
        case "list":
          return "-";
      }
    })
    .join("");
}
