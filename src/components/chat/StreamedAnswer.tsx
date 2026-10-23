"use client";

import { Fragment, useState } from "react";
import { motion } from "framer-motion";
import { askAiMotion } from "@/lib/motion";
import type { StreamToken } from "@/lib/chat/stream-text";

type StreamedAnswerProps = {
  /** Every token released so far, in order. */
  tokens: StreamToken[];
  /** `prefers-reduced-motion`: opacity only, no translate. */
  reduce: boolean;
};

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

/**
 * The streaming answer.
 *
 * It renders the released tokens in the SAME single pre-wrap block the settled
 * message uses, so collapsing it into plain text at the end cannot change a
 * line break, a space or the height. Only the words animate.
 */
export default function StreamedAnswer({
  tokens,
  reduce,
}: StreamedAnswerProps) {
  return (
    <p className="whitespace-pre-wrap">
      {tokens.map((token, index) =>
        renderToken(token, `t${index}`, reduce),
      )}
    </p>
  );
}
