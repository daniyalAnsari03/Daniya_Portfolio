"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import { CheckIcon, CopyIcon, VolumeIcon, VolumeOffIcon } from "@/components/icons";
import ChatLogo from "./ChatLogo";
import StreamedAnswer, { MarkdownText } from "./StreamedAnswer";
import ThinkingSteps from "./ThinkingSteps";
import { markdownToPlainText } from "@/lib/chat/inline-markdown";
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

/** The logo is exactly this size; row 2 and the reserved slot always match it. */
const LOGO_CLASS = "h-10 w-10 sm:h-12 sm:w-12";

/** Shared classes for the identical 4-row assistant layout in every state. */
const ASSISTANT_ROW = "-ml-1 flex w-full flex-col";
const LABEL_CLASS =
  "text-[10px] leading-none font-medium tracking-[0.18em] uppercase text-chat-muted";
// `items-start` pins the logo slot to the top of row 2; extra steps grow
// downward only. Nothing in row 2 ever moves vertically.
const LOGO_ROW_CLASS =
  "mt-1 flex min-h-10 min-w-0 items-start gap-2 sm:min-h-12";
const LOGO_SLOT_CLASS = `${LOGO_CLASS} shrink-0`;
/**
 * The steps column opens with a top padding that keeps its FIRST line
 * centred on the logo: the first live step's chip line is `text-[9px]`
 * (~13.5px tall) and the collapsed summary is `text-[11px] leading-snug`
 * (~15px) inside the `py-0.5` button, so `(logo 40px − ~14px) / 2 ≈ 12px`
 * mobile (`pt-3`) and `(48px − ~14px) / 2 ≈ 16px` desktop (`sm:pt-4`).
 */
const STEPS_CLASS = "min-w-0 flex-1 pt-3 sm:pt-4";
/**
 * The settled summary slides left into the logo's place: the logo width
 * (40px mobile / 48px desktop) + the `gap-2` between slot and steps, so its
 * left edge ends exactly on the "ASK AI" label / answer text. Transform
 * only — the empty fixed-size slot keeps the layout unchanged.
 */
const STEPS_SHIFT_CLASS = "[--steps-shift:-48px] sm:[--steps-shift:-56px]";
const STEPS_SHIFT_CSS = "translateX(var(--steps-shift))";
/** The site's shared ease-out token, serialised for a CSS transition. */
const EASE_OUT_CSS = `cubic-bezier(${askAiMotion.easeOut.join(", ")})`;
const ANSWER_CLASS =
  "mt-1.5 max-w-[85%] text-[14px] leading-relaxed whitespace-pre-wrap text-chat-text [overflow-wrap:anywhere]";

/**
 * Where row 2 is in its life. `live` shows the logo next to the steps,
 * `settling` is the settle moment itself (the logo fades out while the
 * collapsed summary slides left into its place) and `final` renders the end
 * state with no animation at all (past / re-mounted messages and errors).
 */
type AssistantRowState = "live" | "settling" | "final";

/**
 * Row 1 = the "ASK AI" label, row 2 = the logo + the agent steps side by side,
 * row 3 = the answer, row 4 = the speaker / copy row (or an invisible
 * reserved copy while streaming). The label and the answer both start at the
 * logo's left edge; the logo slot keeps the exact logo size so a fade can
 * never reflow the text below it.
 *
 * At the settle the logo fades (opacity only) inside its slot and the steps
 * wrapper slides left over that empty slot. Both run on `askAiMotion.fade` —
 * the same token that times the settle swap to the final message — so the
 * slide finishes exactly when the final state takes over.
 */
function AssistantRows({
  label,
  logo,
  state,
  steps,
  answer,
  actions,
}: {
  label: string;
  logo: ReactNode;
  state: AssistantRowState;
  steps: ReactNode;
  answer: ReactNode;
  actions: ReactNode;
}) {
  const reduce = useReducedMotion() ?? false;
  const settling = state === "settling";

  return (
    <>
      <span className={LABEL_CLASS}>{label}</span>

      <div className={LOGO_ROW_CLASS}>
        {/* The slot is never removed, so the row above the answer keeps the
            exact same height with the logo visible, fading or gone. */}
        <div aria-hidden="true" className={LOGO_SLOT_CLASS}>
          {logo != null && state !== "final" ? (
            <motion.div
              initial={false}
              animate={{ opacity: settling ? 0 : 1 }}
              transition={{
                duration: askAiMotion.fade,
                ease: askAiMotion.easeOut,
              }}
              style={{ willChange: settling ? "opacity" : undefined }}
              className="flex"
            >
              {logo}
            </motion.div>
          ) : null}
        </div>
        <div
          className={`${STEPS_CLASS} ${STEPS_SHIFT_CLASS}`}
          style={{
            transform: state === "live" ? "translateX(0)" : STEPS_SHIFT_CSS,
            // Only the settle moment animates the slide; `final` mounts at
            // its end position so re-rendered messages never replay it.
            // Reduced motion skips the slide (opacity only, per the token:
            // there is no dedicated slide token).
            transition:
              settling && !reduce
                ? `transform ${askAiMotion.fade}s ${EASE_OUT_CSS}`
                : undefined,
            willChange: settling ? "transform" : undefined,
          }}
        >
          {steps}
        </div>
      </div>

      {answer}

      {actions}
    </>
  );
}

/**
 * Screen B — the conversation.
 *
 * The user talks in a dark bubble on the right; the assistant answers in the
 * shared 4-row layout (label / logo + steps / answer / actions) with a speaker
 * and a copy button underneath. The list scrolls inside the drawer and follows
 * the newest message / the words being released — until the user scrolls up by
 * hand.
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
      // Plain text only: no `**`, links as their labels, mailto as the email.
      await navigator.clipboard.writeText(markdownToPlainText(message.text));
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // The clipboard can be blocked — the button simply stays as it is.
    }
  };

  const pendingKey = stream?.id ?? "initial";

  return (
    <div
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
              className={ASSISTANT_ROW}
            >
              <AssistantRows
                label={content.askAi.assistantLabel}
                logo={null}
                state="final"
                steps={
                  message.steps?.length ? (
                    <ThinkingSteps statuses={message.steps} started={true} />
                  ) : null
                }
                answer={
                  <p className={ANSWER_CLASS}>
                    <MarkdownText text={message.text} />
                  </p>
                }
                actions={
                  message.error ? null : (
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
                  )
                }
              />
            </motion.div>
          ),
        )}

        {stream ? (
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : askAiMotion.message.distance }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: askAiMotion.message.duration,
              ease: askAiMotion.easeOut,
            }}
            className={`${ASSISTANT_ROW} text-chat-text`}
          >
            <AssistantRows
              label={content.askAi.assistantLabel}
              logo={
                // An error clears the steps: the line shows alone with the
                // empty logo slot, same geometry as the final state.
                stream.error ? null : <ChatLogo animate="thinking" className={LOGO_CLASS} />
              }
              state={
                stream.error
                  ? "final"
                  : stream.settling
                  ? "settling"
                  : "live"
              }
              steps={
                <ThinkingSteps
                  key={stream.id}
                  statuses={stream.steps}
                  started={stream.started}
                  failed={Boolean(stream.error)}
                  className="w-full max-w-full"
                />
              }
              answer={
                <>
                  {/* The answer stays visible through the settle so the
                      final message can take over with no blink. */}
                  {stream.started && stream.tokens.length > 0 ? (
                    <div className="mt-1.5 max-w-[85%] text-[14px] leading-relaxed text-chat-text [overflow-wrap:anywhere]">
                      <StreamedAnswer tokens={stream.tokens} reduce={reduce} />
                    </div>
                  ) : null}

                  {stream.error ? (
                    <p className={ANSWER_CLASS}>
                      <MarkdownText text={stream.error} />
                    </p>
                  ) : null}
                </>
              }
              actions={
                !stream.settling && stream.started && !stream.error ? (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none mt-2 flex h-7 items-center gap-1.5 opacity-0"
                  >
                    {canSpeak ? <span className="h-7 w-7" /> : null}
                    <span className="h-7 w-7" />
                  </div>
                ) : null
              }
            />
          </motion.div>
        ) : pending ? (
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : askAiMotion.message.distance }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: askAiMotion.message.duration,
              ease: askAiMotion.easeOut,
            }}
            className={`${ASSISTANT_ROW} text-chat-text`}
          >
            <AssistantRows
              label={content.askAi.assistantLabel}
              logo={
                <ChatLogo animate="thinking" className={LOGO_CLASS} />
              }
              state="live"
              steps={
                <ThinkingSteps
                  key={`pending-${pendingKey}`}
                  statuses={[]}
                  started={false}
                  className="w-full max-w-full"
                />
              }
              answer={null}
              actions={null}
            />
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
