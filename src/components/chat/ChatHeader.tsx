"use client";

import { useRef, useState } from "react";
import { content } from "@/lib/content";
import {
  EditIcon,
  PaletteIcon,
  VolumeIcon,
  VolumeOffIcon,
  XIcon,
} from "@/components/icons";
import ChatLogo from "./ChatLogo";
import ThemeMenu, { ThemeMenuMotion } from "./ThemeMenu";
import type { ChatTheme } from "@/lib/chat/types";

type ChatHeaderProps = {
  title: string;
  /** Shown under the title on the opening screen only. */
  subtitle?: string;
  theme: ChatTheme;
  onThemeChange: (theme: ChatTheme) => void;
  voiceReplies: boolean;
  onVoiceRepliesChange: (next: boolean) => void;
  /** `false` when the browser cannot speak — the sound button is hidden then. */
  canSpeak: boolean;
  /** `true` while the assistant is preparing a reply — the avatar breathes. */
  pending: boolean;
  onNewChat: () => void;
  onClose: () => void;
};

const CONTROL_CLASS =
  "flex h-7 w-7 items-center justify-center rounded-full bg-chat-control text-chat-control-fg transition-colors hover:text-chat-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent sm:h-8 sm:w-8";

/**
 * The chat drawer header: the starburst avatar + title on the left, the four
 * controls on the right (new chat, sound, theme, close).
 *
 * Everything is compact so the header still fits on a 320px-wide drawer.
 */
export default function ChatHeader({
  title,
  subtitle,
  theme,
  onThemeChange,
  voiceReplies,
  onVoiceRepliesChange,
  canSpeak,
  pending,
  onNewChat,
  onClose,
}: ChatHeaderProps) {
  const [themeOpen, setThemeOpen] = useState(false);
  const themeButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className="relative flex items-center justify-between gap-2 px-3 pt-[calc(env(safe-area-inset-top)+14px)] pb-3 sm:px-5 sm:pt-[calc(env(safe-area-inset-top)+18px)]">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center text-chat-text"
        >
          <ChatLogo
            size={28}
            animate={pending ? "thinking" : "none"}
          />
        </span>

        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-medium tracking-[-0.03em] text-chat-text sm:text-base">
            {title}
          </h2>
          {subtitle ? (
            <p className="max-[389px]:hidden truncate text-[11px] text-chat-muted">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <button
          type="button"
          onClick={onNewChat}
          aria-label={content.askAi.newChatLabel}
          title={content.askAi.newChatLabel}
          className={CONTROL_CLASS}
        >
          <EditIcon className="h-4 w-4" />
        </button>

        {canSpeak ? (
          <button
            type="button"
            onClick={() => onVoiceRepliesChange(!voiceReplies)}
            aria-label={
              voiceReplies
                ? content.askAi.soundOnLabel
                : content.askAi.soundOffLabel
            }
            aria-pressed={voiceReplies}
            title={
              voiceReplies
                ? content.askAi.soundOnLabel
                : content.askAi.soundOffLabel
            }
            className={CONTROL_CLASS}
          >
            {voiceReplies ? (
              <VolumeIcon className="h-4 w-4" />
            ) : (
              <VolumeOffIcon className="h-4 w-4" />
            )}
          </button>
        ) : null}

        <button
          ref={themeButtonRef}
          type="button"
          onClick={() => setThemeOpen((open) => !open)}
          aria-label={content.askAi.themeLabel}
          aria-expanded={themeOpen}
          title={content.askAi.themeLabel}
          className={CONTROL_CLASS}
        >
          <PaletteIcon className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label={content.askAi.closeLabel}
          title={content.askAi.closeLabel}
          className={CONTROL_CLASS}
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <ThemeMenuMotion open={themeOpen}>
        <ThemeMenu
          theme={theme}
          onThemeChange={onThemeChange}
          voiceReplies={voiceReplies}
          onVoiceRepliesChange={onVoiceRepliesChange}
          canSpeak={canSpeak}
          onClose={() => setThemeOpen(false)}
          anchorRef={themeButtonRef}
        />
      </ThemeMenuMotion>
    </div>
  );
}
