"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import {
  ArrowLeftIcon,
  ChatBubbleIcon,
  DemoIcon,
  EditIcon,
  MoreIcon,
  PaletteIcon,
  StoreIcon,
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
  /** When set, a store icon button opens the store demo (normal mode only). */
  onStoreDemo?: () => void;
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
  /** `true` inside the demo-like modes — the WhatsApp toggle can show. */
  waAvailable?: boolean;
  /** `true` while the WhatsApp skin is on — the header switches to the skin. */
  waActive?: boolean;
  /** Toggles the WhatsApp skin (demo-like modes only). */
  onToggleWhatsApp?: () => void;
  /** The display name in the WhatsApp header. */
  waName?: string;
  /** The initials in the WhatsApp avatar. */
  waInitials?: string;
  /** `true` while a reply is pending/streaming — the status reads "typing…". */
  waTyping?: boolean;
};

const CONTROL_CLASS =
  "flex h-8 w-8 items-center justify-center rounded-full bg-chat-control text-chat-control-fg transition-colors hover:text-chat-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent";

const WA_CONTROL_CLASS =
  "flex h-7 w-7 shrink-0 whitespace-nowrap items-center justify-center rounded-full text-wa-header-text transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wa-header-text sm:h-8 sm:w-8";

/** The rows inside the mobile "More" popover — 40px tap targets. */
const MORE_ROW_CLASS =
  "flex min-h-[40px] w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[13px] text-chat-text transition-colors hover:bg-chat-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent";

/**
 * The WhatsApp status line: "online" normally, "typing…" while a reply is
 * pending and back to "online" exactly when it has fully settled. The two
 * crossfade with opacity only; the live region announces the change.
 */
function WaStatus({ typing }: { typing: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const label = typing
    ? content.askAi.whatsapp.typing
    : content.askAi.whatsapp.online;

  return (
    <span
      aria-live="polite"
      className="relative block h-[13px] overflow-hidden"
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: reduce ? askAiMotion.fade : askAiMotion.wa.statusFade,
            ease: askAiMotion.easeOut,
          }}
          className="absolute inset-0 truncate text-[11px] leading-[13px] tracking-[-0.01em] text-wa-header-text/70"
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * The chat drawer header. In the normal look: the starburst avatar + title
 * on the left, the controls on the right.
 *
 * With the WhatsApp skin on (demo-like modes only) the SAME single header
 * switches to the skin: a back arrow + avatar initials + name + status on
 * the left, the real controls plus the skin toggle on the right, everything
 * recolored with --wa-header-text.
 *
 * Everything is compact so the header still fits on a 320px-wide drawer.
 */
export default function ChatHeader({
  title,
  subtitle,
  badge,
  onBack,
  onDemo,
  onStoreDemo,
  theme,
  onThemeChange,
  voiceReplies,
  onVoiceRepliesChange,
  canSpeak,
  pending,
  onNewChat,
  onClose,
  waAvailable = false,
  waActive = false,
  onToggleWhatsApp,
  waName,
  waInitials,
  waTyping = false,
}: ChatHeaderProps) {
  const [themeOpen, setThemeOpen] = useState(false);
  const themeButtonRef = useRef<HTMLButtonElement | null>(null);

  // The mobile "More" popover (docs/fix.txt): a three-dots button replaces
  // the sound/theme round buttons below md. Its menu holds the sound state
  // row and, once "Theme" is picked, the existing ThemeMenu rows — the theme
  // logic and storage stay in exactly one place.
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreThemesOpen, setMoreThemesOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  const closeMoreMenu = useCallback(
    (focusBack: boolean) => {
      setMoreOpen(false);
      setMoreThemesOpen(false);
      if (focusBack) moreButtonRef.current?.focus();
    },
    [],
  );

  // Outside tap + Escape close the rows panel. The ThemeMenu instance owns
  // its own handlers while the theme rows are showing.
  useEffect(() => {
    if (!moreOpen || moreThemesOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (moreMenuRef.current?.contains(target)) return;
      if (moreButtonRef.current?.contains(target)) return;
      closeMoreMenu(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMoreMenu(true);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen, moreThemesOpen, closeMoreMenu]);

  const waLabel =
    content.askAi.whatsapp[
      waActive ? "toggleOff" : "toggleOn"
    ];

  const controls = (
    <>
      {onNewChat ? (
        <button
          type="button"
          onClick={onNewChat}
          aria-label={content.askAi.newChatLabel}
          title={content.askAi.newChatLabel}
          className={waActive ? WA_CONTROL_CLASS : CONTROL_CLASS}
        >
          <EditIcon className="h-4 w-4" />
        </button>
      ) : null}

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
          className={
            waActive
              ? WA_CONTROL_CLASS
              : `${CONTROL_CLASS} hidden md:flex shrink-0 whitespace-nowrap`
          }
        >
          {voiceReplies ? (
            <VolumeIcon className="h-4 w-4" />
          ) : (
            <VolumeOffIcon className="h-4 w-4" />
          )}
        </button>
      ) : null}

      {waAvailable && onToggleWhatsApp ? (
        <button
          type="button"
          onClick={onToggleWhatsApp}
          aria-pressed={waActive}
          aria-label={waLabel}
          title={waLabel}
          className={
            waActive
              ? WA_CONTROL_CLASS
              : `${CONTROL_CLASS} shrink-0 whitespace-nowrap`
          }
        >
          <ChatBubbleIcon className="h-4 w-4" />
        </button>
      ) : null}

      <button
        ref={themeButtonRef}
        type="button"
        onClick={() => setThemeOpen((open) => !open)}
        aria-label={content.askAi.themeLabel}
        aria-expanded={themeOpen}
        title={content.askAi.themeLabel}
        className={
          waActive ? WA_CONTROL_CLASS : `${CONTROL_CLASS} hidden md:flex`
        }
      >
        <PaletteIcon className="h-4 w-4" />
      </button>

      {/* The mobile three-dots button — the sound/theme round buttons live
          in its popover below md. Desktop never sees it. */}
      <button
        ref={moreButtonRef}
        type="button"
        onClick={() => {
          setMoreThemesOpen(false);
          setMoreOpen((open) => !open);
        }}
        aria-label={content.askAi.moreMenuLabel}
        aria-expanded={moreOpen}
        aria-haspopup="menu"
        title={content.askAi.moreMenuLabel}
        className={`${
          waActive ? WA_CONTROL_CLASS : CONTROL_CLASS
        } md:hidden`}
      >
        <MoreIcon className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onClose}
        aria-label={content.askAi.closeLabel}
        title={content.askAi.closeLabel}
        className={waActive ? WA_CONTROL_CLASS : CONTROL_CLASS}
      >
        <XIcon className="h-4 w-4" />
      </button>
    </>
  );

  /**
   * The mobile More popover: only below md (the wrapper also carries
   * md:hidden), anchored under the three-dots button, opaque, and kept
   * inside the drawer by the header's own padding + max-width.
   */
  const moreMenu = (
    <ThemeMenuMotion
      open={moreOpen}
      className="absolute top-full right-3 z-50 mt-2 w-[220px] max-w-[calc(100%-24px)] md:hidden"
    >
      {moreThemesOpen ? (
        <ThemeMenu
          theme={theme}
          onThemeChange={onThemeChange}
          voiceReplies={voiceReplies}
          onVoiceRepliesChange={onVoiceRepliesChange}
          // Pure palette picker: the sound switch already lives in the rows.
          canSpeak={false}
          itemClassName="min-h-[40px]"
          onClose={() => closeMoreMenu(true)}
          anchorRef={moreButtonRef}
        />
      ) : (
        <div
          ref={moreMenuRef}
          role="menu"
          aria-label={content.askAi.moreMenuLabel}
          className="w-full rounded-[14px] bg-chat-surface p-1.5 ring-1 ring-chat-border"
        >
          {canSpeak ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onVoiceRepliesChange(!voiceReplies);
                closeMoreMenu(true);
              }}
              className={MORE_ROW_CLASS}
            >
              {voiceReplies
                ? content.askAi.more.soundOn
                : content.askAi.more.soundOff}
            </button>
          ) : null}

          {canSpeak ? (
            <div aria-hidden="true" className="my-1 h-px bg-chat-border" />
          ) : null}

          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            onClick={() => setMoreThemesOpen(true)}
            className={MORE_ROW_CLASS}
          >
            {content.askAi.themeLabel}
          </button>
        </div>
      )}
    </ThemeMenuMotion>
  );

  if (waActive) {
    return (
      /* The single header, reskinned. The theme menu stays anchored to this
         wrapper exactly like in the normal look. */
      <div className="relative bg-wa-header px-3 pt-[calc(env(safe-area-inset-top)+12px)] pb-2.5 text-wa-header-text sm:px-4 sm:pb-3">
        <div className="flex h-10 shrink-0 items-center justify-between gap-2 whitespace-nowrap">
          <div className="flex min-w-0 items-center gap-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label={content.askAi.demo.setup.backLabel}
                title={content.askAi.demo.setup.backLabel}
                className={WA_CONTROL_CLASS}
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </button>
            ) : null}

            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wa-avatar text-[12px] font-medium uppercase tracking-[0.02em] text-wa-avatar-text"
            >
              {waInitials}
            </span>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[14px] font-medium tracking-[-0.03em] text-wa-header-text sm:text-[15px]">
                {waName}
              </h2>
              <WaStatus typing={waTyping} />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 whitespace-nowrap sm:gap-1">
            {controls}
          </div>
        </div>

        <ThemeMenuMotion
          open={themeOpen}
          className="absolute top-full right-3 z-50 mt-2 w-[220px] max-w-[calc(100%-24px)] sm:right-4"
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

        {moreMenu}
      </div>
    );
  }

  return (
    /* `relative` on this wrapper is the menu overlay's anchor. The flex row
       lives in its own child so the theme menu (rendered after it, as an
       absolute overlay) can never take space in the header flow and shift
       the buttons. Below md the header is ONE fixed 56px row (docs/fix.txt):
       the same height in every mode and on every theme switch, items
       vertically centred, the title truncating instead of wrapping. From md
       up the original content-driven height is preserved. */
    <div className="relative shrink-0 px-3 pt-[env(safe-area-inset-top)] md:px-5 md:pt-[calc(env(safe-area-inset-top)+18px)] md:pb-3">
      <div className="flex h-14 items-center justify-between gap-2 md:h-auto">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center text-chat-text"
          >
            <ChatLogo
              size={28}
              animate={pending ? "thinking" : "none"}
            />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-[15px] font-medium tracking-[-0.03em] text-chat-text md:text-base">
                {title}
              </h2>
              {badge ? (
                <span className="shrink-0 rounded-full bg-chat-control px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-chat-muted md:text-[9px]">
                  {badge}
                </span>
              ) : null}
            </div>
            {subtitle ? (
              /* Below md the subtitle wraps (never truncated) and shrinks one
                 step so the fixed 56px header row still fits two lines; from
                 md up it is exactly the previous truncate line. */
              <p className="text-[10px] leading-[1.3] text-chat-muted md:truncate md:text-[11px] md:leading-normal">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 md:gap-1">
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
              className={`${CONTROL_CLASS} hidden md:flex`}
            >
              <DemoIcon className="h-4 w-4" />
            </button>
          ) : null}

          {onStoreDemo ? (
            <button
              type="button"
              onClick={onStoreDemo}
              aria-label={content.askAi.storeDemo.openingRow}
              title={content.askAi.storeDemo.openingRow}
              className={`${CONTROL_CLASS} hidden md:flex`}
            >
              <StoreIcon className="h-4 w-4" />
            </button>
          ) : null}

          {controls}
        </div>
      </div>

      <ThemeMenuMotion
        open={themeOpen}
        className="absolute top-full right-3 z-50 mt-2 w-[220px] max-w-[calc(100%-24px)] md:right-5"
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

      {moreMenu}
    </div>
  );
}
