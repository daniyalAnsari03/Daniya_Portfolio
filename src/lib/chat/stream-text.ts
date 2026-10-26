/**
 * Streaming answer text helpers (client-safe).
 *
 * The server sends raw text deltas that may split in the middle of a word or
 * in the middle of a markdown token (`**bold**` / `[label](url)`). The UI
 * keeps a buffer and only releases COMPLETE words (a word followed by
 * whitespace) and COMPLETE markdown tokens — an unfinished token is held
 * back so half-built formatting never jumps; a 200-character safety valve
 * releases it as plain text so nothing gets stuck. Structure whitespace
 * (`\n\n`, `\n`, `- ` lines) becomes break tokens.
 */

import type { ChatStatus } from "@/lib/chat/status-events";
import {
  MAX_INLINE_TOKEN_LENGTH,
  flattenSpansToUnits,
  matchInlineAt,
  type InlineSpan,
} from "@/lib/chat/inline-markdown";

/** Per-word rendering style carried by released words. */
export type StreamWordStyle = { bold?: boolean; href?: string };

/**
 * One released piece of the answer. Only words are paced; breaks are instant.
 *
 * `- md` carries the raw markdown of a token group and is set on the FIRST
 * word of that group; `joined` marks the words/spaces of the same group that
 * follow, so the group is written back as one markdown piece at settle and
 * never leaks into the released text twice.
 */
export type StreamToken =
  | {
      kind: "word";
      text: string;
      style?: StreamWordStyle;
      md?: string;
      joined?: boolean;
    }
  | { kind: "space"; joined?: boolean }
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

/** One plain word released straight from the buffer. */
function pushPlainWord(
  tokens: StreamToken[],
  word: string,
  lineStart: boolean,
): boolean {
  if (lineStart && word === "-") {
    tokens.push({ kind: "list" });
  } else {
    tokens.push({ kind: "word", text: word });
  }
  return false;
}

/** Release a complete inline markdown span as one styled word group. */
function pushMarkdownSpan(
  tokens: StreamToken[],
  span: InlineSpan,
  raw: string,
): void {
  const units = flattenSpansToUnits([span]);
  let first = true;

  for (const unit of units) {
    if (unit.kind === "space") {
      tokens.push({ kind: "space", joined: true });
      continue;
    }

    const style: StreamWordStyle | undefined =
      unit.href !== undefined
        ? { href: unit.href, ...(unit.bold ? { bold: true } : {}) }
        : unit.bold
          ? { bold: true }
          : undefined;

    if (first) {
      tokens.push({
        kind: "word",
        text: unit.text,
        ...(style ? { style } : {}),
        md: raw,
      });
      first = false;
    } else {
      tokens.push({
        kind: "word",
        text: unit.text,
        ...(style ? { style } : {}),
        joined: true,
      });
    }
  }
}

function drain(
  buffer: string,
  lineStart: boolean,
  flush: boolean,
): DrainResult {
  const tokens: StreamToken[] = [];
  let index = 0;
  /** Start of the current unreleased run, never inside a released piece. */
  let runStart = 0;
  /** Line-start state only advances for RELEASED tokens. */
  let released = lineStart;

  while (index < buffer.length) {
    if (isWhitespace(buffer[index])) {
      let end = index;
      while (end < buffer.length && isWhitespace(buffer[end])) end += 1;
      if (end >= buffer.length) {
        if (!flush) {
          // The run is complete; only the trailing whitespace is withheld.
          if (index > runStart) {
            released = pushPlainWord(
              tokens,
              buffer.slice(runStart, index),
              released,
            );
          }
          break;
        }
        // Flush releases the trailing whitespace as well.
        if (index > runStart) {
          released = pushPlainWord(tokens, buffer.slice(runStart, index), released);
        }
        if (pushWhitespace(tokens, buffer.slice(index, end))) released = true;
        index = end;
        runStart = index;
        break;
      }
      if (index > runStart) {
        released = pushPlainWord(tokens, buffer.slice(runStart, index), released);
      }
      if (pushWhitespace(tokens, buffer.slice(index, end))) released = true;
      index = end;
      runStart = index;
      continue;
    }

    if (buffer[index] === "[" || buffer.startsWith("**", index)) {
      const match = matchInlineAt(buffer, index);

      if (match.status === "ok") {
        if (match.span.kind === "link" && !match.span.safe) {
          // Unsafe scheme: the label releases as plain label text — no link,
          // no markdown characters, exactly what the settled renderer shows.
          const units = flattenSpansToUnits([match.span]);
          for (const unit of units) {
            if (unit.kind === "word") {
              released = pushPlainWord(tokens, unit.text, released);
            } else {
              tokens.push({ kind: "space" });
            }
          }
          index = match.next;
          runStart = index;
          continue;
        }
        if (index > runStart) {
          released = pushPlainWord(tokens, buffer.slice(runStart, index), released);
        }
        pushMarkdownSpan(tokens, match.span, match.raw);
        released = false;
        index = match.next;
        runStart = index;
        continue;
      }

      if (
        match.status === "incomplete" &&
        !flush &&
        buffer.length - runStart < MAX_INLINE_TOKEN_LENGTH
      ) {
        // Hold the whole unreleased run back until the token completes.
        break;
      }
      // A "no" match, or the 200-character safety valve, or the final flush:
      // walk on as plain text.
      index += 1;
      continue;
    }

    index += 1;
  }

  if (flush && runStart < buffer.length) {
    pushPlainWord(tokens, buffer.slice(runStart), released);
  }

  const rest = flush ? "" : buffer.slice(runStart);
  return { tokens, rest, lineStart: released };
}

/**
 * Move every COMPLETE word (a word followed by whitespace) and every complete
 * markdown token out of the buffer. A line starting with "- " becomes a list
 * marker instead of a word.
 */
export function drainCompleteWords(
  buffer: string,
  lineStart: boolean,
): DrainResult {
  return drain(buffer, lineStart, false);
}

/** Flush the tail when the stream is done; unfinished tokens become plain. */
export function flushRemainingWords(
  buffer: string,
  lineStart: boolean,
): StreamToken[] {
  return drain(buffer, lineStart, true).tokens;
}

/**
 * Rebuild the released text including its markdown, exactly as the tokens
 * render: a plain word is written as-is, a markdown group is written as one
 * raw piece (every following joined word/space is already inside it).
 */
export function tokensToText(tokens: StreamToken[]): string {
  return tokens
    .map((token) => {
      switch (token.kind) {
        case "word":
          if (token.md) return token.md;
          if (token.joined) return "";
          return token.text;
        case "line":
          return "\n";
        case "paragraph":
          return "\n\n";
        case "list":
          return "-";
        case "space":
          // A joined space sits inside the raw markdown of its group.
          return token.joined ? "" : " ";
      }
    })
    .join("");
}
