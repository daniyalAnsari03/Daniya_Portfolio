/**
 * A tiny inline-markdown tokenizer (client-safe, pure, no dependencies).
 *
 * It knows ONLY these inline forms and treats everything else as plain text:
 *
 * - `**bold**`
 * - `[label](url)`
 * - `[**bold label**](url)` (and bold nesting inside both)
 *
 * There is deliberately nothing else: no headings, no tables, no HTML, no
 * code blocks. Links are safety-checked — only `https://`, `http://` and
 * `mailto:` URLs ever become real links; anything else renders as its plain
 * label text. No HTML is ever produced, so `dangerouslySetInnerHTML` is not
 * needed anywhere.
 */

export type InlineSpan =
  | { kind: "text"; text: string; raw: string }
  | { kind: "bold"; children: InlineSpan[]; raw: string }
  | {
      kind: "link";
      href: string;
      /** `false` for a syntactically complete link with an unsafe URL. */
      safe: boolean;
      children: InlineSpan[];
      raw: string;
    };

/** The safety valve length from docs/fix.txt: 200 characters. */
export const MAX_INLINE_TOKEN_LENGTH = 200;

type Match =
  | { status: "ok"; span: InlineSpan; raw: string; next: number }
  /** The token could still complete with more text (streaming holdback). */
  | { status: "incomplete" }
  /** Definitely not a token starting here — continue as plain text. */
  | { status: "no" };

export function isSafeHref(href: string): boolean {
  const lower = href.toLowerCase();
  return (
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("mailto:")
  );
}

export function isMailtoHref(href: string): boolean {
  return href.toLowerCase().startsWith("mailto:");
}

/**
 * Try to match one markdown token (`**bold**` or `[label](url)`) at `index`.
 * `incomplete` is returned when the text ends inside a possible token, so a
 * stream may still complete it later. Newlines or whitespace inside a token
 * make it plain text immediately.
 */
export function matchInlineAt(text: string, index: number): Match {
  if (text.startsWith("**", index)) return matchBold(text, index);
  if (text[index] === "[") return matchLink(text, index);
  return { status: "no" };
}

function matchBold(text: string, index: number): Match {
  const close = text.indexOf("**", index + 2);
  const lineBreak = text.indexOf("\n", index + 2);

  if (close === -1) {
    // No newline in sight: the bold may arrive with the next deltas.
    return lineBreak === -1 ? { status: "incomplete" } : { status: "no" };
  }
  if (lineBreak !== -1 && lineBreak < close) return { status: "no" };

  const content = text.slice(index + 2, close);
  if (!content.trim()) return { status: "no" };

  const raw = text.slice(index, close + 2);
  return {
    status: "ok",
    raw,
    next: close + 2,
    span: { kind: "bold", children: parseInlineMarkdown(content), raw },
  };
}

function matchLink(text: string, index: number): Match {
  // The label may not span a newline; the URL may not contain whitespace.
  const lineBreak = text.indexOf("\n", index + 1);
  const lineEnd = lineBreak === -1 ? text.length : lineBreak;

  const close = text.indexOf("]", index + 1);
  if (close === -1) {
    return lineBreak === -1 ? { status: "incomplete" } : { status: "no" };
  }
  if (close >= lineEnd) return { status: "no" };
  if (text[close + 1] === undefined) {
    // The label ended the current text — its "(" may arrive next delta.
    return { status: "incomplete" };
  }
  if (text[close + 1] !== "(") return { status: "no" };

  const urlStart = close + 2;
  // Scan with paren depth so URLs like `.../alert(1)` stay complete.
  let urlEnd = urlStart;
  let depth = 0;
  let closed = false;
  while (urlEnd < text.length) {
    const character = text[urlEnd];
    if (character === "\n" || /\s/.test(character)) return { status: "no" };
    if (character === "(") depth += 1;
    if (character === ")") {
      if (depth === 0) {
        closed = true;
        break;
      }
      depth -= 1;
    }
    urlEnd += 1;
  }
  if (!closed) {
    // No whitespace bail-out happened, so the URL may still complete.
    return { status: "incomplete" };
  }

  const href = text.slice(urlStart, urlEnd);
  const label = text.slice(index + 1, close);
  if (!href || !label.trim()) return { status: "no" };

  const raw = text.slice(index, urlEnd + 1);
  return {
    status: "ok",
    raw,
    next: urlEnd + 1,
    span: {
      kind: "link",
      href,
      safe: isSafeHref(href),
      children: parseInlineMarkdown(label),
      raw,
    },
  };
}

/** Parse a full string into inline spans. Everything else stays plain text. */
export function parseInlineMarkdown(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let index = 0;

  while (index < text.length) {
    const star = text.indexOf("*", index);
    const bracket = text.indexOf("[", index);
    const candidates = [star, bracket].filter((found) => found !== -1);

    // Plain text up to the next markdown candidate.
    const next = candidates.length ? Math.min(...candidates) : text.length;
    if (next > index) {
      const chunk = text.slice(index, next);
      spans.push({ kind: "text", text: chunk, raw: chunk });
      index = next;
      continue;
    }

    const match = matchInlineAt(text, index);
    if (match.status === "ok") {
      spans.push(match.span);
      index = match.next;
      continue;
    }

    if (match.status === "no" && text.startsWith("**", index)) {
      const raw = text.slice(index, index + 2);
      spans.push({ kind: "text", text: raw, raw });
      index += 2;
      continue;
    }
    // "no" on a `[` — or an `incomplete` tail: shown as plain characters so a
    // partially-sent markdown token never hides its own brackets.
    spans.push({ kind: "text", text: text[index], raw: text[index] });
    index += 1;
  }

  return spans;
}

/**
 * The start index of an unfinished trailing markdown token (`**…` or
 * `[…](…` that could still complete), or -1. Used by the stream pipeline and
 * the speech player to hold a token back until it is complete.
 */
export function findTrailingIncompleteMarkdown(text: string): number {
  let index = 0;
  while (index < text.length) {
    if (text.startsWith("**", index) || text[index] === "[") {
      const match = matchInlineAt(text, index);
      if (match.status === "ok") {
        index = match.next;
        continue;
      }
      if (match.status === "incomplete") return index;
      index += 1;
      continue;
    }
    index += 1;
  }
  return -1;
}

/**
 * Flattens parsed spans into single-line word/spaces units so the streaming
 * word queue can release one word at a time while every word keeps its
 * bold/link style. Words inside an UNSAFE link lose their href (they render
 * as the plain label text, exactly like the settled renderer does).
 */
export type WordUnit = { text: string; bold: boolean; href?: string };

export type FlattenUnit =
  | { kind: "word"; text: string; bold: boolean; href?: string }
  | { kind: "space"; joined: true };

export function flattenSpansToUnits(spans: InlineSpan[]): FlattenUnit[] {
  const out: FlattenUnit[] = [];

  const pushText = (text: string, bold: boolean, href?: string) => {
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        out.push({ kind: "space", joined: true });
      } else {
        out.push({ kind: "word", text: part, bold, href });
      }
    }
  };

  const walk = (list: InlineSpan[], bold: boolean, href?: string) => {
    for (const span of list) {
      if (span.kind === "text") {
        pushText(span.text, bold, href);
      } else if (span.kind === "bold") {
        walk(span.children, true, href);
      } else {
        walk(span.children, bold, span.safe ? span.href : href);
      }
    }
  };

  walk(spans, false);
  return out;
}

/**
 * The plain-text version of a markdown string: `**` markers removed, links
 * replaced by their label, mailto links by the email address itself.
 * Used for copy text and for what the voice reads out (never a URL).
 */
export function markdownToPlainText(text: string): string {
  const build = (spans: InlineSpan[]): string =>
    spans
      .map((span) => {
        switch (span.kind) {
          case "text":
            return span.text;
          case "bold":
            return build(span.children);
          case "link":
            return span.safe && isMailtoHref(span.href)
              ? span.href.slice("mailto:".length)
              : build(span.children);
        }
      })
      .join("");

  return build(parseInlineMarkdown(text));
}
