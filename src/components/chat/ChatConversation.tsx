"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import { CheckIcon, CopyIcon, VolumeIcon, VolumeOffIcon } from "@/components/icons";
import ChatLogo from "./ChatLogo";
import type { ChatMessage } from "@/lib/chat/types";

type ChatConversationProps = {
  messages: ChatMessage[];
  /** `true` while the assistant is preparing a reply. */
  pending: boolean;
  /** `false` when the browser cannot speak — the speaker button is hidden. */
  canSpeak: boolean;
  /** The id of the assistant message that is being read out loud. */
  speakingId: string | null;
  onSpeak: (message: ChatMessage) => void;
  onStopSpeaking: () => void;
};

/**
 * Screen B — the conversation.
 *
 * The user talks in a dark bubble on the right; the assistant answers as
 * plain text under a small "ASK AI" label, with a speaker and a copy button
 * underneath. The list scrolls inside the drawer and follows the newest
 * message.
 */
export default function ChatConversation({
  messages,
  pending,
  canSpeak,
  speakingId,
  onSpeak,
  onStopSpeaking,
}: ChatConversationProps) {
  const reduce = useReducedMotion() ?? false;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Follow the newest message.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({
      top: element.scrollHeight,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [messages.length, pending, reduce]);

  const copy = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // The clipboard can be blocked — the button simply stays as it is.
    }
  };

  return (
    <div
      ref={scrollRef}
      data-lenis-prevent
      className="flex-1 overflow-y-auto overscroll-contain px-4 pb-2 sm:px-5"
    >
      <p className="sr-only" role="status" aria-live="polite">
        {pending ? content.askAi.thinkingLabel : ""}
      </p>

      <div className="flex flex-col gap-5">
        {messages.map((message) =>
          message.role === "user" ? (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: reduce ? 0 : askAiMotion.message.distance }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: askAiMotion.message.duration,
                ease: askAiMotion.easeOut,
              }}
              className="flex justify-end"
            >
              <p className="max-w-[85%] rounded-[16px] rounded-br-[4px] bg-chat-user-bubble px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-chat-user-bubble-fg [overflow-wrap:anywhere]">
                {message.text}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: reduce ? 0 : askAiMotion.message.distance }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: askAiMotion.message.duration,
                ease: askAiMotion.easeOut,
              }}
              className="flex flex-col items-start"
            >
              <span className="text-[10px] font-medium tracking-[0.18em] text-chat-muted uppercase">
                {content.askAi.assistantLabel}
              </span>

              <p className="mt-1.5 max-w-[85%] text-[14px] leading-relaxed whitespace-pre-wrap text-chat-text [overflow-wrap:anywhere]">
                {message.text}
              </p>

              <div className="mt-2 flex items-center gap-1.5">
                {canSpeak ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (speakingId === message.id) onStopSpeaking();
                      else onSpeak(message);
                    }}
                    aria-label={
                      speakingId === message.id
                        ? content.askAi.stopSpeakingLabel
                        : content.askAi.speakLabel
                    }
                    title={
                      speakingId === message.id
                        ? content.askAi.stopSpeakingLabel
                        : content.askAi.speakLabel
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-full text-chat-muted transition-colors hover:text-chat-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent"
                  >
                    {speakingId === message.id ? (
                      <VolumeOffIcon className="h-3.5 w-3.5" />
                    ) : (
                      <VolumeIcon className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => void copy(message)}
                  aria-label={content.askAi.copyLabel}
                  title={content.askAi.copyLabel}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-chat-muted transition-colors hover:text-chat-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent"
                >
                  {copiedId === message.id ? (
                    <CheckIcon className="h-3.5 w-3.5" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </motion.div>
          ),
        )}

        {pending ? (
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : askAiMotion.message.distance }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: askAiMotion.message.duration,
              ease: askAiMotion.easeOut,
            }}
            className="flex flex-col items-start"
          >
            <span className="text-[10px] font-medium tracking-[0.18em] text-chat-muted uppercase">
              {content.askAi.assistantLabel}
            </span>

            <div className="my-2 flex items-center text-chat-text">
              <ChatLogo
                animate="thinking"
                className="h-[var(--chat-logo-thinking-size)] w-[var(--chat-logo-thinking-size)]"
              />
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
