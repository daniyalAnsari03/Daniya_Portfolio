"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import { ArrowUpIcon, MicrophoneIcon, WaveIcon } from "@/components/icons";

/** The textarea grows from one line up to four. */
const MAX_INPUT_HEIGHT = 104;

const ICON_BUTTON_CLASS =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chat-control text-chat-control-fg transition-colors hover:text-chat-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent disabled:pointer-events-none disabled:opacity-40";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Sends the current value. */
  onSend: () => void;
  /** `true` while the assistant is preparing a reply — the send is disabled. */
  busy: boolean;
  /** `false` when the browser cannot listen — the mic button is hidden. */
  canMic: boolean;
  /** `true` while the microphone is recording. */
  micActive: boolean;
  onMic: () => void;
  /** `false` when the browser cannot listen — the wave button is hidden. */
  canWave: boolean;
  /** Opens the voice mode. */
  onWave: () => void;
  /** A short inline message (e.g. a blocked microphone). */
  error?: string | null;
};

/**
 * The input bar at the bottom of the chat.
 *
 * A rounded, muted container with an auto-growing textarea and three round
 * buttons: the microphone (dictation fills the textarea, it never sends on
 * its own), the wave (voice mode) and the send arrow.
 */
export default function ChatInput({
  value,
  onChange,
  onSend,
  busy,
  canMic,
  micActive,
  onMic,
  canWave,
  onWave,
  error,
}: ChatInputProps) {
  const reduce = useReducedMotion() ?? false;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Grow with the content, up to four lines.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !busy;

  return (
    <div className="px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:px-5 sm:pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: askAiMotion.item,
          ease: askAiMotion.easeOut,
          delay: reduce ? 0 : askAiMotion.entry.input.delay,
        }}
        className="flex items-end gap-1.5 rounded-[18px] bg-chat-input p-1.5 ring-1 ring-chat-border"
      >
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            if (canSend) onSend();
          }}
          placeholder={content.askAi.placeholder}
          aria-label={content.askAi.placeholder}
          className="max-h-[104px] min-h-[28px] flex-1 resize-none bg-transparent px-2.5 py-1.5 text-[16px] leading-[1.4] text-chat-text outline-none placeholder:text-chat-muted focus-visible:outline-none sm:text-[15px]"
        />

        <div className="flex shrink-0 items-center gap-0.5 pb-0.5">
          {canMic ? (
            <button
              type="button"
              onClick={onMic}
              aria-label={content.askAi.micLabel}
              title={content.askAi.micLabel}
              aria-pressed={micActive}
              className={`${ICON_BUTTON_CLASS} ${
                micActive ? "text-chat-accent" : ""
              }`}
            >
              <span className="relative flex items-center justify-center">
                <MicrophoneIcon className="h-4 w-4" />
                {micActive ? (
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full border border-chat-accent"
                    animate={{ opacity: [0.9, 0.15, 0.9], scale: [1, 1.25, 1] }}
                    transition={{
                      duration: askAiMotion.pulse.duration,
                      repeat: Infinity,
                      ease: askAiMotion.easeInOut,
                    }}
                  />
                ) : null}
              </span>
            </button>
          ) : null}

          {canWave ? (
            <button
              type="button"
              onClick={onWave}
              aria-label={content.askAi.waveLabel}
              title={content.askAi.waveLabel}
              className={ICON_BUTTON_CLASS}
            >
              <WaveIcon className="h-4 w-4" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label={content.askAi.sendLabel}
            title={content.askAi.sendLabel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chat-primary text-chat-primary-fg transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
        </div>
      </motion.div>

      {error ? (
        <p
          role="status"
          className="mt-2 px-1 text-[11px] text-chat-muted [overflow-wrap:anywhere]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
