"use client";

import { useRef, useState } from "react";
import { content } from "@/lib/content";
import {
  ArrowLeftIcon,
  DemoIcon,
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
  /** A small tag next to the title (e.g. the demo mode's "Demo" badge). */
  badge?: string;
  /** When set, a back arrow is shown — e.g. leaving the demo mode. */
  onBack?: () => void;
  /** When set, a "Demo" icon button opens the demo setup (normal mode only). */
  onDemo?: () => void;
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
  badge,
  onBack,
  onDemo,
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
    /* `relative` on this wrapper is the menu overlay's anchor. The flex row
       lives in its own child so the theme menu (rendered after it, as an
       absolute overlay) can never take space in the header flow and shift
       the buttons. */
    <div className="relative px-3 pt-[calc(env(safe-area-inset-top)+14px)] pb-3 sm:px-5 sm:pt-[calc(env(safe-area-inset-top)+18px)]">
      <div className="flex items-center justify-between gap-2">
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
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-[15px] font-medium tracking-[-0.03em] text-chat-text sm:text-base">
                {title}
              </h2>
              {badge ? (
                <span className="shrink-0 rounded-full bg-chat-control px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-chat-muted">
                  {badge}
                </span>
              ) : null}
            </div>
            {subtitle ? (
              <p className="max-[389px]:hidden truncate text-[11px] text-chat-muted">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={content.askAi.demo.setup.backLabel}
              title={content.askAi.demo.setup.backLabel}
              className={CONTROL_CLASS}
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
          ) : null}

          {onDemo ? (
            <button
              type="button"
              onClick={onDemo}
              aria-label={content.askAi.demo.openingRow}
              title={content.askAi.demo.openingRow}
              className={CONTROL_CLASS}
            >
              <DemoIcon className="h-4 w-4" />
            </button>
          ) : null}

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
      </div>

      <ThemeMenuMotion
        open={themeOpen}
        className="absolute top-full right-3 z-50 mt-2 w-[220px] max-w-[calc(100%-24px)] sm:right-5"
      >
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
