"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import { CheckIcon, CopyIcon, VolumeIcon, VolumeOffIcon } from "@/components/icons";
import ChatLogo from "./ChatLogo";
import StreamedAnswer from "./StreamedAnswer";
import ThinkingSteps from "./ThinkingSteps";
import type { ChatMessage } from "@/lib/chat/types";
import type { ChatStreamState } from "@/lib/chat/stream-text";

type ChatConversationProps = {
  messages: ChatMessage[];
  /** `true` while the assistant is preparing a reply (until the queue drains). */
  pending: boolean;
  /** `false` when the browser cannot speak — the speaker button is hidden. */
  canSpeak: boolean;
  /** The id of the assistant message that is being read out loud. */
  speakingId: string | null;
  onSpeak: (message: ChatMessage) => void;
  onStopSpeaking: () => void;
  /** The answer currently being streamed, if any. */
  stream: ChatStreamState | null;
  /** The answer that just settled — its buttons fade in a beat later. */
  settledId: string | null;
};

/** The user must be this close to the bottom to be "following" the reply. */
const STICK_THRESHOLD = 72;

/**
 * Screen B — the conversation.
 *
 * The user talks in a dark bubble on the right; the assistant answers as
 * plain text under a small "ASK AI" label, with a speaker and a copy button
 * underneath. The list scrolls inside the drawer and follows the newest
 * message / the words being released — until the user scrolls up by hand.
 */
export default function ChatConversation({
  messages,
  pending,
  canSpeak,
  speakingId,
  onSpeak,
  onStopSpeaking,
  stream,
  settledId,
}: ChatConversationProps) {
  const reduce = useReducedMotion() ?? false;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const stickRef = useRef(true);
  const lastCountRef = useRef(messages.length);

  // Follow the newest message / the words being released, unless the user
  // scrolled up by hand. Sending a new question re-sticks the view.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const grew = messages.length > lastCountRef.current;
    lastCountRef.current = messages.length;
    const last = messages[messages.length - 1];
    if (grew && last?.role === "user") stickRef.current = true;

    if (!stickRef.current) return;

    const streaming = Boolean(stream && stream.tokens.length > 0);
    element.scrollTo({
      top: element.scrollHeight,
      behavior: streaming || reduce ? "auto" : "smooth",
    });
  }, [messages, pending, stream, reduce]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    stickRef.current = distance <= STICK_THRESHOLD;
  };

  const copy = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // The clipboard can be blocked — the button simply stays as it is.
    }
  };

  const pendingKey = stream?.id ?? "initial";

  return (    <div
      ref={scrollRef}
      onScroll={handleScroll}
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
              initial={
                message.settled
                  ? false
                  : { opacity: 0, y: reduce ? 0 : askAiMotion.message.distance }
              }
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

              {message.steps?.length ? (
                <ThinkingSteps
                  statuses={message.steps}
                  started={true}
                  className="mt-1.5 max-w-[85%]"
                />
              ) : null}

              <p className="mt-1.5 max-w-[85%] text-[14px] leading-relaxed whitespace-pre-wrap text-chat-text [overflow-wrap:anywhere]">
                {message.text}
              </p>

              {message.error ? null : (
                <motion.div
                  initial={message.settled ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: askAiMotion.fade,
                    ease: askAiMotion.easeOut,
                    delay:
                      message.id === settledId
                        ? askAiMotion.word.buttonsDelay
                        : 0,
                  }}
                  className="mt-2 flex items-center gap-1.5"
                >
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
                </motion.div>
              )}
            </motion.div>
          ),
        )}

        {stream ? (
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : askAiMotion.message.distance }}
            animate={
              stream.settling
                ? { opacity: 0, y: 0 }
                : { opacity: 1, y: 0 }
            }
            transition={{
              duration: stream.settling ? askAiMotion.fade : askAiMotion.message.duration,
              ease: askAiMotion.easeOut,
            }}
            className="flex flex-col items-start"
          >
            <span className="text-[10px] font-medium tracking-[0.18em] text-chat-muted uppercase">
              {content.askAi.assistantLabel}
            </span>

            <div className="mt-2 flex w-full items-start gap-3 text-chat-text">
              <div className="shrink-0 pt-[2px]">
                <ChatLogo
                  animate="thinking"
                  className="h-10 w-10 sm:h-12 sm:w-12"
                />
              </div>

              <div className="min-w-0 flex-1">
                <ThinkingSteps
                  key={stream.id}
                  statuses={stream.steps}
                  started={stream.started}
                  failed={Boolean(stream.error)}
                  className="w-full max-w-full"
                />
              </div>
            </div>

            {!stream.settling && stream.started && stream.tokens.length > 0 ? (
              <div className="mt-2 w-full max-w-[85%] text-[14px] leading-relaxed text-chat-text [overflow-wrap:anywhere]">
                <StreamedAnswer tokens={stream.tokens} reduce={reduce} />
              </div>
            ) : null}

            {!stream.settling && stream.started && !stream.error ? (
              <div
                aria-hidden="true"
                className="pointer-events-none mt-2 flex h-7 items-center gap-1.5 opacity-0"
              >
                {canSpeak ? <span className="h-7 w-7" /> : null}
                <span className="h-7 w-7" />
              </div>
            ) : null}

            {stream.error ? (
              <p className="mt-1.5 max-w-[85%] text-[14px] leading-relaxed whitespace-pre-wrap text-chat-text [overflow-wrap:anywhere]">
                {stream.error}
              </p>
            ) : null}
          </motion.div>
        ) : pending ? (
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

            <div className="mt-2 flex w-full items-start gap-3 text-chat-text">
              <div className="shrink-0 pt-[2px]">
                <ChatLogo
                  animate="thinking"
                  className="h-10 w-10 sm:h-12 sm:w-12"
                />
              </div>

              <div className="min-w-0 flex-1">
                <ThinkingSteps
                  key={`pending-${pendingKey}`}
                  statuses={[]}
                  started={false}
                  className="w-full max-w-full"
                />
              </div>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
