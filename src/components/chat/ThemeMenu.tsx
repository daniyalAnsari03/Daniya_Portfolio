"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import { CheckIcon } from "@/components/icons";
import type { ChatTheme } from "@/lib/chat/types";

/** The little colour chip next to every theme name. */
const SWATCH_CLASS: Record<ChatTheme, string> = {
  light: "bg-white ring-1 ring-chat-border",
  dark: "bg-charcoal",
  gray: "bg-background ring-1 ring-chat-border",
};

type ThemeMenuProps = {
  theme: ChatTheme;
  onThemeChange: (theme: ChatTheme) => void;
  voiceReplies: boolean;
  onVoiceRepliesChange: (next: boolean) => void;
  /** `false` when the browser cannot speak — the sound row is hidden then. */
  canSpeak: boolean;
  onClose: () => void;
  /** The theme button — a click on it must not close the menu. */
  anchorRef: RefObject<HTMLButtonElement | null>;
};

/**
 * The popover under the theme button: the three palettes, then a divider and
 * the "Voice replies" switch.
 *
 * It closes on an outside click, on Escape and when a theme is picked.
 */
export default function ThemeMenu({
  theme,
  onThemeChange,
  voiceReplies,
  onVoiceRepliesChange,
  canSpeak,
  onClose,
  anchorRef,
}: ThemeMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={content.askAi.themeMenuLabel}
      className="absolute top-full right-3 mt-2 w-[220px] max-w-[calc(100%-24px)] rounded-[14px] bg-chat-surface p-1.5 ring-1 ring-chat-border sm:right-5"
    >
      <ul className="flex flex-col">
        {content.askAi.themes.map((option) => {
          const active = option.id === theme;
          return (
            <li key={option.id}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onThemeChange(option.id as ChatTheme);
                  onClose();
                }}
                className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] text-chat-text transition-colors hover:bg-chat-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent"
              >
                <span
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 shrink-0 rounded-full ${SWATCH_CLASS[option.id as ChatTheme]}`}
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {active ? (
                  <CheckIcon className="h-3.5 w-3.5 shrink-0 text-chat-accent" />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {canSpeak ? (
        <>
          <div aria-hidden="true" className="my-1 h-px bg-chat-border" />
          <div className="flex items-center justify-between gap-3 px-2.5 py-2">
            <span className="min-w-0 truncate text-[13px] text-chat-text">
              {content.askAi.voiceRepliesLabel}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={voiceReplies}
              aria-label={content.askAi.voiceRepliesLabel}
              onClick={() => onVoiceRepliesChange(!voiceReplies)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent focus-visible:ring-offset-2 focus-visible:ring-offset-chat-surface ${
                voiceReplies ? "bg-chat-accent" : "bg-chat-border"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-chat-surface transition-transform ${
                  voiceReplies ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** The animated wrapper — only `opacity` and `transform` animate. */
export function ThemeMenuMotion({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{
            duration: askAiMotion.menu.duration,
            ease: askAiMotion.easeOut,
          }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
