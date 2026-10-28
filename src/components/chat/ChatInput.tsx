"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import {
  ArrowUpIcon,
  MicrophoneIcon,
  SendPlaneIcon,
  WaveIcon,
} from "@/components/icons";

/** The textarea grows from one line up to four. */
const MAX_INPUT_HEIGHT = 104;

/** Must match the server's validation (1–500 characters). */
const MAX_INPUT_LENGTH = 500;

const ICON_BUTTON_CLASS =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chat-control text-chat-control-fg transition-colors hover:text-chat-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent disabled:pointer-events-none disabled:opacity-40";

const WA_ICON_BUTTON_CLASS =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-wa-input-text transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wa-input-text disabled:pointer-events-none disabled:opacity-40";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Sends the current value. */
  onSend: () => void;
  /** `true` while the assistant is preparing a reply — the send is disabled. */
  busy: boolean;
  /**
   * `true` while the demo retry window runs — the send is disabled so no
   * request can fire; it clears itself when the wait passes.
   */
  sendLocked?: boolean;
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
  /** The quiet line under the input (defaults to the saved-chats note). */
  note?: string;
  /**
   * Overrides the default placeholder (e.g. the Store demo's own line).
   * Unset keeps the current behaviour: WhatsApp skin placeholder when the
   * skin is on, otherwise the main chat placeholder.
   */
  placeholder?: string;
  /**
   * The WhatsApp skin (docs/fix.txt): the bar, the input pill, the icons and
   * the send button are recolored with the --wa-* tokens and the placeholder
   * changes. Every behaviour (auto-grow, 500 chars, Enter, mic) is untouched.
   */
  skin?: boolean;
};

/**
 * The input bar at the bottom of the chat.
 *
 * A rounded, muted container with an auto-growing textarea and three round
 * buttons: the microphone (dictation fills the textarea, it never sends on
 * its own), the wave (voice mode) and the send arrow.
 *
 * In the WhatsApp skin the same component switches to the skin palette: a
 * full-width --wa-bar strip, a --wa-input pill with the skin placeholder and
 * a round --wa-send paper-plane button.
 */
export default function ChatInput({
  value,
  onChange,
  onSend,
  busy,
  sendLocked = false,
  canMic,
  micActive,
  onMic,
  canWave,
  onWave,
  error,
  note = content.askAi.savedNote,
  placeholder: placeholderOverride,
  skin = false,
}: ChatInputProps) {
  const reduce = useReducedMotion() ?? false;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const placeholder =
    placeholderOverride ??
    (skin
      ? content.askAi.whatsapp.inputPlaceholder
      : content.askAi.placeholder);
  const buttonClass = skin ? WA_ICON_BUTTON_CLASS : ICON_BUTTON_CLASS;

  // Grow with the content, up to four lines.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !busy && !sendLocked;

  return (
    <div
      className={`${
        skin ? "bg-wa-bar" : ""
      } px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:px-5 sm:pb-[calc(env(safe-area-inset-bottom)+16px)]`}
    >
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: askAiMotion.item,
          ease: askAiMotion.easeOut,
          delay: reduce ? 0 : askAiMotion.entry.input.delay,
        }}
        className={`flex items-end gap-1.5 rounded-[18px] p-1.5 ${
          skin
            ? "bg-wa-input"
            : "bg-chat-input ring-1 ring-chat-border"
        }`}
      >
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          maxLength={MAX_INPUT_LENGTH}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            if (canSend) onSend();
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`max-h-[104px] min-h-[28px] flex-1 resize-none bg-transparent px-2.5 py-1.5 text-[16px] leading-[1.4] outline-none focus-visible:outline-none sm:text-[15px] ${
            skin
              ? "text-wa-input-text placeholder:text-wa-input-text"
              : "text-chat-text placeholder:text-chat-muted"
          }`}
        />

        <div className="flex shrink-0 items-center gap-0.5 pb-0.5">
          {canMic ? (
            <button
              type="button"
              onClick={onMic}
              aria-label={content.askAi.micLabel}
              title={content.askAi.micLabel}
              aria-pressed={micActive}
              className={`${buttonClass} ${
                micActive ? (skin ? "text-wa-header" : "text-chat-accent") : ""
              }`}
            >
              <span className="relative flex items-center justify-center">
                <MicrophoneIcon className="h-4 w-4" />
                {micActive ? (
                  <motion.span
                    aria-hidden="true"
                    className={`absolute inset-0 rounded-full border ${
                      skin ? "border-wa-header" : "border-chat-accent"
                    }`}
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
              className={buttonClass}
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
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent disabled:pointer-events-none disabled:opacity-30 ${
              skin
                ? "bg-wa-send text-wa-send-text"
                : "bg-chat-primary text-chat-primary-fg"
            }`}
          >
            {skin ? (
              <SendPlaneIcon className="h-4 w-4" />
            ) : (
              <ArrowUpIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </motion.div>

      <p
        className={`mt-2 px-1 text-center text-[10px] ${
          skin ? "text-wa-input-text" : "text-chat-muted"
        }`}
      >
        {note}
      </p>

      {error ? (
        <p
          role="status"
          className={`mt-2 px-1 text-[11px] [overflow-wrap:anywhere] ${
            skin ? "text-wa-input-text" : "text-chat-muted"
          }`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
