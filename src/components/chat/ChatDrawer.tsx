"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { content } from "@/lib/content";
import { askAiMotion } from "@/lib/motion";
import { askAssistant } from "@/lib/chat/chat-client";
import type { ChatMessage, VoiceStatus } from "@/lib/chat/types";
import { lockScroll, unlockScroll } from "@/components/SmoothScroll";
import ChatConversation from "./ChatConversation";
import ChatHeader from "./ChatHeader";
import ChatInput from "./ChatInput";
import ChatOpening from "./ChatOpening";
import VoiceMode from "./VoiceMode";
import { useChatPreferences } from "./useChatPreferences";
import { useSpeechRecognition, useSpeechSynthesis } from "./useSpeech";

/**
 * The drawer size.
 *
 * It is never full screen: on a phone it takes 88% of the overlay (never
 * more than 420px), on a tablet 70% (never more than 520px) and on a desktop
 * half of it (never less than 480px). A dimmed strip of the page always stays
 * visible on the left.
 *
 * The percentages are relative to the fixed overlay, never to a viewport
 * unit, so the drawer can never be wider than the screen.
 */
const PANEL_WIDTH =
  "w-[88%] max-w-[420px] md:w-[70%] md:max-w-[520px] lg:w-[50%] lg:min-w-[480px] lg:max-w-none";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetWidth > 0);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, containerRef]);
}

type ChatDrawerProps = {
  open: boolean;
  onClose: () => void;
  onExited: () => void;
};

/**
 * The "Ask AI" drawer.
 *
 * It slides in from the right with the same mechanics as the CV drawer: a
 * dimmed backdrop on the left, the scroll lock, the trapped focus and the
 * focus returning to the Ask AI tab when it closes.
 *
 * Three screens share the drawer: the opening screen (no messages yet), the
 * conversation and the voice mode.
 */
export default function ChatDrawer({
  open,
  onClose,
  onExited,
}: ChatDrawerProps) {
  const reduce = useReducedMotion() ?? false;
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [animating, setAnimating] = useState(false);

  // The conversation — in memory only, never persisted.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const idRef = useRef(0);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const [input, setInput] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeRef = useRef(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const { theme, setTheme, voiceReplies, setVoiceReplies } = useChatPreferences();

  useFocusTrap(open, panelRef);

  // ---------------------------------------------------------------------
  // The conversation
  // ---------------------------------------------------------------------

  const runQuestion = useCallback(
    async (text: string): Promise<string | null> => {
      const trimmed = text.trim();
      if (!trimmed || pendingRef.current) return null;

      const userMessage: ChatMessage = {
        id: `chat-${idRef.current++}`,
        role: "user",
        text: trimmed,
      };

      const history = [...messagesRef.current, userMessage];
      messagesRef.current = history;
      setMessages(history);

      pendingRef.current = true;
      setPending(true);

      try {
        const reply = await askAssistant(history);
        const assistantMessage: ChatMessage = {
          id: `chat-${idRef.current++}`,
          role: "assistant",
          text: reply,
        };
        messagesRef.current = [...messagesRef.current, assistantMessage];
        setMessages(messagesRef.current);
        return reply;
      } catch {
        return null;
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [],
  );

  const handleSend = useCallback(() => {
    const value = input;
    setInput("");
    void runQuestion(value);
  }, [input, runQuestion]);

  const handlePick = useCallback(
    (question: string) => {
      void runQuestion(question);
    },
    [runQuestion],
  );

  // ---------------------------------------------------------------------
  // Speech
  // ---------------------------------------------------------------------

  const {
    supported: canSpeak,
    speak,
    cancel: cancelSpeech,
  } = useSpeechSynthesis();

  /**
   * The final transcript of a recognition session. In the voice mode it is
   * sent as a question; in the text chat it only fills the textarea (the
   * dictation never sends on its own).
   */
  const handleFinal = useCallback(
    (text: string) => {
      if (voiceModeRef.current) {
        if (!text.trim()) {
          setVoiceStatus("idle");
          return;
        }

        setVoiceStatus("thinking");
        void runQuestion(text).then((reply) => {
          if (reply && voiceReplies) {
            setVoiceStatus("speaking");
            speak(reply, () => setVoiceStatus("idle"));
          } else {
            setVoiceStatus("idle");
          }
        });
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) return;
      setInput((current) => (current ? `${current} ${trimmed}` : trimmed));
    },
    [runQuestion, speak, voiceReplies],
  );

  const {
    supported: canRecognize,
    listening,
    transcript,
    error: recognitionError,
    start: startRecognition,
    stop: stopRecognition,
    cancel: cancelRecognition,
  } = useSpeechRecognition(handleFinal);

  // ---------------------------------------------------------------------
  // The controls
  // ---------------------------------------------------------------------

  const handleNewChat = useCallback(() => {
    cancelRecognition();
    cancelSpeech();
    messagesRef.current = [];
    setMessages([]);
    setInput("");
    setSpeakingId(null);
    setVoiceMode(false);
    voiceModeRef.current = false;
    setVoiceStatus("idle");
  }, [cancelRecognition, cancelSpeech]);

  const handleVoiceRepliesChange = useCallback(
    (next: boolean) => {
      setVoiceReplies(next);
      // A silent voice chat makes no sense — leave the voice mode.
      if (!next && voiceModeRef.current) {
        cancelRecognition();
        cancelSpeech();
        setSpeakingId(null);
        setVoiceMode(false);
        voiceModeRef.current = false;
        setVoiceStatus("idle");
      }
    },
    [cancelRecognition, cancelSpeech, setVoiceReplies],
  );

  const handleOpenVoice = useCallback(() => {
    setVoiceMode(true);
    voiceModeRef.current = true;
    setVoiceStatus("idle");
  }, []);

  const handleLeaveVoice = useCallback(() => {
    cancelRecognition();
    cancelSpeech();
    setSpeakingId(null);
    setVoiceMode(false);
    voiceModeRef.current = false;
    setVoiceStatus("idle");
  }, [cancelRecognition, cancelSpeech]);

  const handleToggleMic = useCallback(() => {
    if (voiceStatus === "listening") {
      stopRecognition();
      return;
    }
    setVoiceStatus("listening");
    startRecognition();
  }, [startRecognition, stopRecognition, voiceStatus]);

  const handleSpeak = useCallback(
    (message: ChatMessage) => {
      setSpeakingId(message.id);
      speak(message.text, () => setSpeakingId(null));
    },
    [speak],
  );

  const handleStopSpeaking = useCallback(() => {
    cancelSpeech();
    setSpeakingId(null);
  }, [cancelSpeech]);

  /** Closing always stops the microphone and the voice. */
  const handleClose = useCallback(() => {
    cancelRecognition();
    cancelSpeech();
    setSpeakingId(null);
    onClose();
  }, [cancelRecognition, cancelSpeech, onClose]);

  // ---------------------------------------------------------------------
  // Drawer mechanics
  // ---------------------------------------------------------------------

  // Lock the page while the drawer is open (Lenis aware, including the
  // touch-device handling of SmoothScroll).
  useEffect(() => {
    if (open) {
      lockScroll();
    } else {
      unlockScroll();
    }
    return () => unlockScroll();
  }, [open]);

  // Move the focus into the drawer once it has slid in.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const container = panelRef.current;
      if (!container) return;
      const focusable = container.querySelector<HTMLElement>(
        FOCUSABLE_SELECTOR,
      );
      if (focusable) {
        focusable.focus();
      } else {
        container.focus();
      }
    }, askAiMotion.drawer * 1000 * 0.8);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, handleClose]);

  // A route change closes the drawer (and stops everything it started).
  // The previous pathname is compared instead of counting the renders: an
  // effect may run more than once for the same route (React StrictMode
  // mounts, unmounts and remounts every effect in development), and only a
  // REAL pathname change may close the drawer.
  const previousPathname = useRef(pathname);
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    onClose();
  }, [pathname, onClose]);

  // Never keep the microphone or the voice running behind a closed drawer.
  useEffect(() => {
    if (open) return;
    cancelRecognition();
    cancelSpeech();
  }, [open, cancelRecognition, cancelSpeech]);

  const errorMessage = recognitionError
    ? recognitionError === "not-allowed" ||
      recognitionError === "service-not-allowed"
      ? content.askAi.voiceErrors.blocked
      : content.askAi.voiceErrors.failed
    : null;

  const showVoice = voiceMode;
  const showOpening = !voiceMode && messages.length === 0;

  return (
    <AnimatePresence onExitComplete={() => onExited()}>
      {open ? (
        /* The overlay + the drawer live in their own fixed layer, OUTSIDE the
           transformed page wrappers. `overflow-x-clip` keeps the off-screen
           drawer (during the exit) from ever creating a horizontal scroll. */
        <div className="fixed inset-0 z-[var(--z-popup)] overflow-x-clip">
          <motion.div
            className="absolute inset-0 bg-charcoal/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: askAiMotion.fade,
              ease: askAiMotion.easeInOut,
            }}
            onClick={handleClose}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={content.askAi.title}
            tabIndex={-1}
            data-chat-theme={theme}
            className={`absolute inset-y-0 right-0 flex h-viewport-sm flex-col overflow-hidden rounded-l-[18px] bg-chat-surface text-chat-text outline-none ${PANEL_WIDTH}`}
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={
              reduce
                ? { opacity: 0, transitionEnd: { visibility: "hidden" } }
                : { x: "100%", transitionEnd: { visibility: "hidden" } }
            }
            transition={{
              duration: reduce ? askAiMotion.fade : askAiMotion.drawer,
              ease: askAiMotion.easeInOut,
            }}
            onAnimationStart={() => setAnimating(true)}
            onAnimationComplete={() => setAnimating(false)}
            style={{ willChange: animating ? "transform, opacity" : undefined }}
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <ChatHeader
                title={
                  showVoice ? content.askAi.voiceTitle : content.askAi.title
                }
                subtitle={
                  showVoice || !showOpening ? undefined : content.askAi.subtitle
                }
                theme={theme}
                onThemeChange={setTheme}
                voiceReplies={voiceReplies}
                onVoiceRepliesChange={handleVoiceRepliesChange}
                canSpeak={canSpeak}
                pending={pending}
                onNewChat={handleNewChat}
                onClose={handleClose}
              />

              {showVoice ? (
                <VoiceMode
                  status={voiceStatus}
                  transcript={transcript}
                  voiceReplies={voiceReplies}
                  canSpeak={canSpeak}
                  onKeyboard={handleLeaveVoice}
                  onToggleMic={handleToggleMic}
                  onToggleSpeaker={() =>
                    handleVoiceRepliesChange(!voiceReplies)
                  }
                />
              ) : showOpening ? (
                <ChatOpening onPick={handlePick} />
              ) : (
                <ChatConversation
                  messages={messages}
                  pending={pending}
                  canSpeak={canSpeak}
                  speakingId={speakingId}
                  onSpeak={handleSpeak}
                  onStopSpeaking={handleStopSpeaking}
                />
              )}

              {showVoice ? null : (
                <ChatInput
                  value={input}
                  onChange={setInput}
                  onSend={handleSend}
                  busy={pending}
                  canMic={canRecognize}
                  micActive={listening}
                  onMic={() => {
                    if (listening) stopRecognition();
                    else startRecognition();
                  }}
                  canWave={canRecognize}
                  onWave={handleOpenVoice}
                  error={errorMessage}
                />
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
