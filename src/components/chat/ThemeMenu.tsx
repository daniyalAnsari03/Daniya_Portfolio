"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
      anchorRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onClose]);

  return (
    /* The visual box itself. Positioning + z-index live on the animated
       wrapper (ThemeMenuMotion, see below), which carries the `absolute`
       overlay so the containing block never changes during the animation
       and the whole menu mounts/animates as ONE block. `z-50` keeps the
       menu above drawer content that creates its own stacking contexts
       (e.g. the settled assistant rows, which keep a permanent transform
       and would otherwise paint over the lower rows and eat the hit). */
    <div
      ref={menuRef}
      role="menu"
      aria-label={content.askAi.themeMenuLabel}
      className="w-full rounded-[14px] bg-chat-surface p-1.5 ring-1 ring-chat-border"
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
                  anchorRef.current?.focus();
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

/** The animated wrapper — only `opacity` and `transform` animate.
 *
 * The wrapper IS the overlay: it carries the absolute positioning against
 * the header (the theme button's wrapper block, which holds `relative`)
 * and a `z-` level above the drawer content. Mounting it as one element
 * means the containing block (and so the menu's position) is identical on
 * the first frame and after the animation — no containing-block switch,
 * no per-child reveal. Reduced motion: opacity only, no rise.
 */
export function ThemeMenuMotion({
  open,
  className,
  children,
}: {
  open: boolean;
  /** Overlay positioning classes, passed in by the header. */
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion() ?? false;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={className}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
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
