"use client";

import { motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import {
  KeyboardIcon,
  MicrophoneIcon,
  StopIcon,
  VolumeIcon,
  VolumeOffIcon,
} from "@/components/icons";
import ChatLogo from "./ChatLogo";
import type { VoiceStatus } from "@/lib/chat/types";

type VoiceModeProps = {
  status: VoiceStatus;
  /** The live recognised transcript. */
  transcript: string;
  /** `true` when the assistant reads its replies out loud. */
  voiceReplies: boolean;
  /** `false` when the browser cannot speak — the speaker button is hidden. */
  canSpeak: boolean;
  /** Leaves the voice mode and goes back to the text chat. */
  onKeyboard: () => void;
  /** Starts / stops listening. */
  onToggleMic: () => void;
  /** Mutes / unmutes the spoken replies. */
  onToggleSpeaker: () => void;
};

/**
 * Screen C — the voice mode.
 *
 * The starburst (no filled circle behind it) with two thin rings around it,
 * the current status, the live transcript and the three controls.
 */
export default function VoiceMode({
  status,
  transcript,
  voiceReplies,
  canSpeak,
  onKeyboard,
  onToggleMic,
  onToggleSpeaker,
}: VoiceModeProps) {
  const reduce = useReducedMotion() ?? false;
  const active = !reduce && status !== "idle";
  const ringSize = (ratio: string) => ({
    width: `calc(var(--chat-orb-logo-size) * var(${ratio}))`,
    height: `calc(var(--chat-orb-logo-size) * var(${ratio}))`,
  });

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 pb-2">
      <div
        className="relative flex items-center justify-center"
        style={ringSize("--chat-orb-ring-outer-ratio")}
      >
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border border-chat-border"
          animate={
            active
              ? { scale: [1, 1.12, 1], opacity: [0.55, 0.12, 0.55] }
              : { scale: 1, opacity: 0.45 }
          }
          transition={{
            duration: askAiMotion.pulse.duration,
            repeat: active ? Infinity : 0,
            ease: askAiMotion.easeInOut,
          }}
        />

        <motion.span
          aria-hidden="true"
          className="absolute inset-0 m-auto rounded-full border border-chat-border"
          style={ringSize("--chat-orb-ring-inner-ratio")}
          animate={
            active
              ? { scale: [1, 1.16, 1], opacity: [0.7, 0.2, 0.7] }
              : { scale: 1, opacity: 0.6 }
          }
          transition={{
            duration: askAiMotion.pulse.duration + askAiMotion.bars.stagger,
            repeat: active ? Infinity : 0,
            delay: askAiMotion.bars.stagger,
            ease: askAiMotion.easeInOut,
          }}
        />

        <div className="relative flex items-center justify-center bg-transparent text-chat-text">
          <ChatLogo
            size={140}
            animate={status}
            className="h-[var(--chat-orb-logo-size)] w-[var(--chat-orb-logo-size)]"
          />
        </div>
      </div>

      <p className="mt-7 text-[15px] font-medium tracking-[-0.02em] text-chat-text">
        {content.askAi.voiceStatus[status]}
      </p>

      <p className="mt-2 max-h-[72px] min-h-[20px] w-full overflow-y-auto text-center text-[13px] leading-relaxed text-chat-muted [overflow-wrap:anywhere]">
        {transcript}
      </p>

      <div className="mt-8 flex items-center gap-5">
        <button
          type="button"
          onClick={onKeyboard}
          aria-label={content.askAi.keyboardLabel}
          title={content.askAi.keyboardLabel}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-chat-control text-chat-control-fg transition-colors hover:text-chat-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent"
        >
          <KeyboardIcon className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onToggleMic}
          aria-label={
            status === "listening"
              ? content.askAi.stopLabel
              : content.askAi.talkLabel
          }
          title={
            status === "listening"
              ? content.askAi.stopLabel
              : content.askAi.talkLabel
          }
          className="flex h-16 w-16 items-center justify-center rounded-full bg-chat-primary text-chat-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent focus-visible:ring-offset-2 focus-visible:ring-offset-chat-surface"
        >
          {status === "listening" ? (
            <StopIcon className="h-5 w-5" />
          ) : (
            <MicrophoneIcon className="h-6 w-6" />
          )}
        </button>

        {canSpeak ? (
          <button
            type="button"
            onClick={onToggleSpeaker}
            aria-label={
              voiceReplies
                ? content.askAi.soundOnLabel
                : content.askAi.soundOffLabel
            }
            title={
              voiceReplies
                ? content.askAi.soundOnLabel
                : content.askAi.soundOffLabel
            }
            aria-pressed={voiceReplies}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-chat-control text-chat-control-fg transition-colors hover:text-chat-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent"
          >
            {voiceReplies ? (
              <VolumeIcon className="h-4 w-4" />
            ) : (
              <VolumeOffIcon className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span aria-hidden="true" className="h-10 w-10" />
        )}
      </div>
    </div>
  );
}
