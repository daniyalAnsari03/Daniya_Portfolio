"use client";

import { Fragment, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { askAiMotion } from "@/lib/motion";
import {
  isMailtoHref,
  isSafeHref,
  parseInlineMarkdown,
  type InlineSpan,
} from "@/lib/chat/inline-markdown";
import type { StreamToken, StreamWordStyle } from "@/lib/chat/stream-text";

type StreamedAnswerProps = {
  /** Every token released so far, in order. */
  tokens: StreamToken[];
  /** `prefers-reduced-motion`: opacity only, no translate. */
  reduce: boolean;
};

const BOLD_CLASS = "font-semibold";
/**
 * Links use the chat accent token with an underline; hover only changes
 * opacity, never layout. Keyboard focus reuses the site's ring pattern.
 */
const LINK_CLASS =
  "text-chat-accent underline decoration-1 underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-chat-accent rounded-[2px]";

/**
 * One released word. Only the newest word mounts, so an already shown word
 * never re-animates; `will-change` is removed as soon as its fade is done.
 */
function StreamWord({ text, reduce }: { text: string; reduce: boolean }) {
  const [animating, setAnimating] = useState(true);

  return (
    <motion.span
      initial={{ opacity: 0, y: reduce ? 0 : askAiMotion.word.distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: askAiMotion.word.fade,
        ease: askAiMotion.easeOut,
      }}
      onAnimationComplete={() => setAnimating(false)}
      style={{ willChange: animating ? "opacity, transform" : undefined }}
    >
      {text}
    </motion.span>
  );
}

function renderToken(token: StreamToken, key: string, reduce: boolean) {
  switch (token.kind) {
    case "word":
      return <StreamWord key={key} text={token.text} reduce={reduce} />;
    case "space":
      return <span key={key}> </span>;
    case "line":
      return <br key={key} />;
    case "paragraph":
      // Exactly what `\n\n` looks like in the settled plain text.
      return (
        <Fragment key={key}>
          <br />
          <br />
        </Fragment>
      );
    case "list":
      return <span key={key}>-</span>;
  }
}

function sameStyle(
  a?: StreamWordStyle | null,
  b?: StreamWordStyle | null,
): boolean {
  return (
    (a?.href ?? null) === (b?.href ?? null) &&
    Boolean(a?.bold) === Boolean(b?.bold)
  );
}

/** Wrap one styled run in its anchor / strong elements (settled-safe order). */
function wrapRun(content: ReactNode, style: StreamWordStyle, key: string) {
  let node: ReactNode;

  if (style.href && isSafeHref(style.href)) {
    node = (
      <a
        href={style.href}
        target={isMailtoHref(style.href) ? undefined : "_blank"}
        rel={isMailtoHref(style.href) ? undefined : "noopener noreferrer"}
        className={LINK_CLASS}
      >
        {content}
      </a>
    );
  } else {
    node = content;
  }

  if (style.bold) {
    node = <strong className={BOLD_CLASS}>{node}</strong>;
  }
  return <Fragment key={key}>{node}</Fragment>;
}

function styleNodes(tokens: StreamToken[], reduce: boolean): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.kind === "word" && token.style) {
      // One styled run: consecutive words that share the style, including the
      // spaces between them, so the streaming link is ONE anchor exactly like
      // the settled renderer (no re-wrap at settle). Trailing spaces stay
      // outside it.
      const style = token.style;
      let scan = index + 1;
      let lastWord = index;
      while (scan < tokens.length) {
        const next = tokens[scan];
        if (next.kind === "word" && sameStyle(next.style, style)) {
          lastWord = scan;
          scan += 1;
          continue;
        }
        if (next.kind === "space") {
          scan += 1;
          continue;
        }
        break;
      }

      const content = streamNodes(tokens.slice(index, lastWord + 1), reduce);
      nodes.push(wrapRun(content, style, `t${index}`));
      index = lastWord + 1;
      continue;
    }

    nodes.push(renderToken(token, `t${index}`, reduce));
    index += 1;
  }

  return nodes;
}

function streamNodes(tokens: StreamToken[], reduce: boolean): ReactNode[] {
  return tokens.map((token, index) => renderToken(token, `t${index}`, reduce));
}

/**
 * The streaming answer.
 *
 * It renders the released tokens in the SAME single pre-wrap block the settled
 * message uses, so collapsing it into plain text at the end cannot change a
 * line break, a space or the height. Only the words animate; bold stays
 * weight 600 and links stay accent-colored during and after the fade.
 */
export default function StreamedAnswer({
  tokens,
  reduce,
}: StreamedAnswerProps) {
  return (
    <p className="whitespace-pre-wrap">{styleNodes(tokens, reduce)}</p>
  );
}

/** Static (non-animated) inline markdown nodes. */
function staticNodes(spans: InlineSpan[], prefix: string): ReactNode[] {
  return spans.map((span, index) => {
    const key = `${prefix}s${index}`;
    switch (span.kind) {
      case "text":
        return <Fragment key={key}>{span.text}</Fragment>;
      case "bold":
        return (
          <strong key={key} className={BOLD_CLASS}>
            {staticNodes(span.children, `${key}b`)}
          </strong>
        );
      case "link":
        if (!span.safe) {
          // Unsafe scheme: plain label text, never a link.
          return (
            <Fragment key={key}>{staticNodes(span.children, `${key}p`)}</Fragment>
          );
        }
        return (
          <a
            key={key}
            href={span.href}
            target={isMailtoHref(span.href) ? undefined : "_blank"}
            rel={isMailtoHref(span.href) ? undefined : "noopener noreferrer"}
            className={LINK_CLASS}
          >
            {staticNodes(span.children, `${key}l`)}
          </a>
        );
    }
  });
}

/**
 * The settled renderer: the same inline-markdown rules as the streaming view,
 * with no animation. Bold is weight 600 (the streamed words already use it),
 * so the final swap cannot change a word width or re-wrap a line.
 */
export function MarkdownText({ text }: { text: string }) {
  return <>{staticNodes(parseInlineMarkdown(text), "m")}</>;
}
