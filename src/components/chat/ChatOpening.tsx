"use client";

import { motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import { ArrowUpRight } from "@/components/icons";

type ChatOpeningProps = {
  /** Called with the question the user picked. */
  onPick: (question: string) => void;
};

/**
 * Screen A — the opening state of the chat.
 *
 * The big three-line heading, then the three suggested questions in the
 * site's label/line/rows style. The heading comes first, the rows stagger in
 * one by one and the input bar follows (its delay lives in the motion
 * tokens).
 */
export default function ChatOpening({ onPick }: ChatOpeningProps) {
  const reduce = useReducedMotion() ?? false;
  const distance = reduce ? 0 : 14;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-5">
      <div className="my-auto">
        <motion.h3
          initial={{ opacity: 0, y: distance }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: askAiMotion.item,
            ease: askAiMotion.easeOut,
            delay: reduce ? 0 : askAiMotion.entry.heading.delay,
          }}
          className="text-[clamp(24px,8vw,46px)] leading-[1.08] font-medium tracking-[-0.04em] text-chat-text"
        >
          <span className="block pb-[0.08em]">{content.askAi.heading.line1}</span>
          <span className="block pb-[0.08em]">{content.askAi.heading.line2}</span>
          <span className="block pb-[0.08em] text-chat-accent">
            {content.askAi.heading.line3}
          </span>
        </motion.h3>

        <ul className="mt-7 sm:mt-9">
          {content.askAi.suggestions.map((suggestion, index) => (
            <motion.li
              key={suggestion.number}
              initial={{ opacity: 0, y: distance }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: askAiMotion.item,
                ease: askAiMotion.easeOut,
                delay: reduce
                  ? 0
                  : askAiMotion.entry.row.delay +
                    index * askAiMotion.entry.row.stagger,
              }}
              className="border-t border-chat-border last:border-b"
            >
              <button
                type="button"
                onClick={() => onPick(suggestion.text)}
                className="group flex w-full items-center justify-between gap-3 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent"
              >
                <span className="flex min-w-0 items-baseline gap-3">
                  <span className="shrink-0 text-[11px] tracking-[0.08em] text-chat-muted">
                    {suggestion.number}
                  </span>
                  <span className="min-w-0 text-[14px] text-chat-text">
                    {suggestion.text}
                  </span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-chat-accent transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </button>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
