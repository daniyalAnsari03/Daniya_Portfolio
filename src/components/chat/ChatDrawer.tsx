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
import {
  streamAssistant,
  type ChatStreamError,
} from "@/lib/chat/chat-client";
import { streamDemo } from "@/lib/chat/demo-client";
import { formatRateLimitLine } from "@/lib/chat/rate-limit-text";
import type { ChatStatus } from "@/lib/chat/status-events";
import {
  drainCompleteWords,
  flushRemainingWords,
  tokensToText,
  type ChatStreamState,
  type StreamToken,
} from "@/lib/chat/stream-text";
import { createSpeechPlayer } from "@/lib/chat/speech-player";
import type { ChatMessage, VoiceStatus } from "@/lib/chat/types";
import { lockScroll, unlockScroll } from "@/components/SmoothScroll";
import ChatConversation from "./ChatConversation";
import ChatHeader from "./ChatHeader";
import ChatInput from "./ChatInput";
import ChatOpening from "./ChatOpening";
import DemoIntro from "./DemoIntro";
import DemoSetup, {
  MAX_DEMO_CONTEXT,
  MAX_DEMO_INSTRUCTIONS,
  MAX_DEMO_NAME,
  type DemoExitDirection,
} from "./DemoSetup";
import VoiceMode from "./VoiceMode";
import { useChatPreferences } from "./useChatPreferences";
import { useSpeechOutputSupported, useSpeechRecognition } from "./useSpeech";

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

/**
 * The three drawer modes: the normal "Ask AI" chat about Daniyal, the demo
 * setup screen and the demo chat itself (docs/fix.txt).
 */
type DrawerMode = "daniyal" | "demo-setup" | "demo-chat";

const DEFAULT_DEMO_INSTRUCTIONS =
  content.askAi.demo.setup.defaultInstructions;

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

/** Turn a typed stream error into the quiet line shown under the answer. */
function formatChatError(error: ChatStreamError, demo: boolean): string {
  const lines = demo ? content.askAi.demo.errors : content.askAi.errors;

  switch (error.code) {
    case "rate_limited":
      // Only the demo mode uses the shared rate-limit wording helper — the
      // main chat keeps its own line.
      return demo
        ? formatRateLimitLine(error.retryAfterSeconds)
        : lines.rateLimited;
    case "network":
      return lines.network;
    case "invalid":
      return lines.invalid;
    case "empty":
    case "server":
    default:
      return lines.server;
  }
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

  // The drawer mode: the normal chat, the demo setup or the demo chat. The
  // ref mirrors the state so the request pipeline never reads stale mode.
  const [mode, setModeState] = useState<DrawerMode>("daniyal");
  const modeRef = useRef<DrawerMode>("daniyal");
  const setMode = useCallback((next: DrawerMode) => {
    modeRef.current = next;
    setModeState(next);
  }, []);

  // The demo setup — component/client memory only (no storage, no URL).
  const [demoName, setDemoName] = useState("");
  const [demoInstructions, setDemoInstructions] = useState<string>(
    DEFAULT_DEMO_INSTRUCTIONS,
  );
  const [demoContext, setDemoContext] = useState("");
  /**
   * Which way the setup screen leaves: the value is set in the SAME handler
   * that switches the mode, and the leaving overlay reads it through the
   * AnimatePresence `custom` prop, so forward pushes it out to the left and
   * Back returns it to the right.
   */
  const [demoExitDirection, setDemoExitDirection] =
    useState<DemoExitDirection>("forward");
  /** The validated setup the demo chat runs with (name/substituted instructions/context). */
  const demoConfigRef = useRef<{
    name: string;
    instructions: string;
    context: string;
  } | null>(null);

  // The conversation — in memory only, never persisted.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const idRef = useRef(0);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const [input, setInput] = useState("");
  /**
   * The demo limiter (docs/fix.txt): while the server's 429 retry window is
   * running, the demo input stops firing requests. Client memory only — the
   * window clears itself when the wait passes, so the visitor is never stuck
   * (and the server-side budget is never bypassed).
   */
  const [demoLimitSeconds, setDemoLimitSeconds] = useState<number | null>(null);
  const demoLimitUntilRef = useRef<number | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeRef = useRef(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // The answer currently streaming (word queue + released tokens).
  const [stream, setStream] = useState<ChatStreamState | null>(null);
  const streamRef = useRef<ChatStreamState | null>(null);
  const [settledId, setSettledId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const queueRef = useRef<StreamToken[]>([]);
  const releasedRef = useRef<StreamToken[]>([]);
  const stepsRef = useRef<ChatStatus[]>([]);
  const bufferRef = useRef("");
  const lineStartRef = useRef(true);
  const fullTextRef = useRef("");
  const doneRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const settleFadeRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const lastReleaseRef = useRef(0);
  const lastWordReleaseRef = useRef(0);
  const releaseTickRef = useRef<() => void>(() => {});
  /** Whether the current answer's `contact_form` ui event has arrived. */
  const uiContactFormRef = useRef(false);

  const { theme, setTheme, voiceReplies, setVoiceReplies } = useChatPreferences();

  // One speech engine for voice mode, the auto-read replies and the speaker
  // button. It never sees a key or a model — only the audio from /api/tts.
  const [player] = useState(() => createSpeechPlayer());
  const voiceRepliesRef = useRef(voiceReplies);

  const canSpeak = useSpeechOutputSupported();
  const canSpeakRef = useRef(canSpeak);

  useFocusTrap(open, panelRef);

  useEffect(() => {
    voiceRepliesRef.current = voiceReplies;
  }, [voiceReplies]);

  useEffect(() => {
    canSpeakRef.current = canSpeak;
  }, [canSpeak]);

  useEffect(() => {
    player.setCallbacks({
      onStart: () => {
        if (voiceModeRef.current) setVoiceStatus("speaking");
      },
      onEnd: () => {
        setSpeakingId(null);
        if (voiceModeRef.current) setVoiceStatus("idle");
      },
    });
  }, [player]);

  // ---------------------------------------------------------------------
  // The word-by-word pipeline
  // ---------------------------------------------------------------------

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Cancel a pending settle — abort / error / unmount must never settle. */
  const stopSettle = useCallback(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const stopFade = useCallback(() => {
    if (settleFadeRef.current !== null) {
      window.clearTimeout(settleFadeRef.current);
      settleFadeRef.current = null;
    }
  }, []);

  const resetPipeline = useCallback(() => {
    stopTimer();
    stopSettle();
    stopFade();
    queueRef.current = [];
    releasedRef.current = [];
    stepsRef.current = [];
    bufferRef.current = "";
    lineStartRef.current = true;
    fullTextRef.current = "";
    doneRef.current = false;
    lastReleaseRef.current = 0;
    lastWordReleaseRef.current = 0;
    uiContactFormRef.current = false;
  }, [stopFade, stopSettle, stopTimer]);

  const applyStream = useCallback((next: ChatStreamState | null) => {
    streamRef.current = next;
    if (mountedRef.current) setStream(next);
  }, []);

  const finalizeSuccess = useCallback(() => {
    // Use exactly what was released so the plain-text swap keeps every line
    // break and space of the streaming view (no reflow at settle).
    const released = tokensToText(releasedRef.current);
    const text = released.trim() ? released : fullTextRef.current.trim();
    const steps = stepsRef.current.slice();
    // Read before resetPipeline() clears the flag below.
    const uiForm = uiContactFormRef.current;

    resetPipeline();
    pendingRef.current = false;
    if (mountedRef.current) setPending(false);

    if (!text) {
      applyStream(null);
      return;
    }

    const assistantMessage: ChatMessage = {
      id: `chat-${idRef.current++}`,
      role: "assistant",
      text,
      settled: true,
      steps: steps.length > 0 ? steps : undefined,
      // The Contact agent asked for the in-chat form while this answer streamed.
      uiForm: uiForm || undefined,
    };
    const next = [...messagesRef.current, assistantMessage];
    messagesRef.current = next;
    if (mountedRef.current) setMessages(next);
    if (mountedRef.current) setSettledId(assistantMessage.id);

    // Sound ON in the text chat: read the settled answer sentence by sentence.
    // Without any audio output nothing is requested from /api/tts. The demo
    // mode never speaks — it has no sound controls at all.
    if (
      modeRef.current === "daniyal" &&
      !voiceModeRef.current &&
      voiceRepliesRef.current &&
      canSpeakRef.current
    ) {
      player.speak(text);
      if (mountedRef.current) setSpeakingId(assistantMessage.id);
    }

    applyStream(null);
  }, [applyStream, player, resetPipeline]);

  /**
   * Settle only when the stream is done, the tail was flushed, the queue is
   * empty AND the last released word's fade has finished (+ a small grace).
   * The visible streaming view keeps only released tokens until then.
   */
  const maybeFinish = useCallback(() => {
    if (!doneRef.current) return;
    if (queueRef.current.length > 0) return;
    if (settleTimerRef.current !== null) return;

    const { fade, settleGrace } = askAiMotion.word;
    const wait = fade * 1000 + settleGrace * 1000;
    const elapsed =
      lastWordReleaseRef.current > 0
        ? performance.now() - lastWordReleaseRef.current
        : wait;

    settleTimerRef.current = window.setTimeout(
      () => {
        settleTimerRef.current = null;
        if (!mountedRef.current) return;
        if (!doneRef.current) return;
        if (queueRef.current.length > 0) return;

        const current = streamRef.current;
        if (current) {
          applyStream({ ...current, settling: true });
          const fadeMs = askAiMotion.fade * 1000;
          settleFadeRef.current = window.setTimeout(() => {
            settleFadeRef.current = null;
            finalizeSuccess();
          }, fadeMs);
        } else {
          finalizeSuccess();
        }
      },
      Math.max(0, wait - elapsed),
    );
  }, [applyStream, finalizeSuccess]);

  const failStream = useCallback(
    (error: ChatStreamError) => {
      stopTimer();
      stopSettle();
      queueRef.current = [];
      stepsRef.current = [];
      bufferRef.current = "";
      doneRef.current = true;

      // A demo 429 opens the client-side send lock for the retry window; the
      // limit itself stays on the server.
      if (
        error.code === "rate_limited" &&
        modeRef.current === "demo-chat"
      ) {
        const seconds = error.retryAfterSeconds ?? 60;
        demoLimitUntilRef.current = Date.now() + seconds * 1000;
        setDemoLimitSeconds(seconds);
      }

      const current = streamRef.current;
      const tokens = releasedRef.current.slice();
      applyStream({
        id: current?.id ?? `chat-${idRef.current}`,
        tokens,
        steps: [],
        error: formatChatError(error, modeRef.current === "demo-chat"),
        started: tokens.some((token) => token.kind === "word"),
        settling: false,
        text: fullTextRef.current,
      });

      pendingRef.current = false;
      if (mountedRef.current) setPending(false);
    },
    [applyStream, stopSettle, stopTimer],
  );

  const scheduleRelease = useCallback(() => {
    if (!mountedRef.current) return;
    if (timerRef.current !== null) return;

    const queue = queueRef.current;
    if (queue.length === 0) {
      maybeFinish();
      return;
    }

    let delay = 0;
    if (queue[0].kind === "word") {
      const { interval, floorInterval, speedUpAt } = askAiMotion.word;
      const length = Math.max(queue.length, 1);
      // Long queue = faster (smoothly towards the floor), short = normal.
      // Clamped on BOTH ends: a short queue never gets slower than `interval`.
      delay = Math.round(
        Math.min(
          interval,
          Math.max(floorInterval, (interval * speedUpAt) / length),
        ),
      );
      if (lastReleaseRef.current > 0) {
        const since = performance.now() - lastReleaseRef.current;
        delay = Math.max(0, delay - since);
      }
    }

    timerRef.current = window.setTimeout(() => releaseTickRef.current(), delay);
  }, [maybeFinish]);

  const releaseTick = useCallback(() => {
    timerRef.current = null;
    if (!mountedRef.current) return;

    lastReleaseRef.current = performance.now();
    const queue = queueRef.current;
    let released = false;

    // Break tokens (paragraph / line / list) are released instantly.
    while (queue.length > 0 && queue[0].kind !== "word") {
      releasedRef.current.push(queue.shift() as StreamToken);
      released = true;
    }

    // Then exactly one word, paced.
    if (queue.length > 0 && queue[0].kind === "word") {
      releasedRef.current.push(queue.shift() as StreamToken);
      lastWordReleaseRef.current = performance.now();
      released = true;
    }

    // Any break directly after the word appears with it, never a beat late.
    while (queue.length > 0 && queue[0].kind !== "word") {
      releasedRef.current.push(queue.shift() as StreamToken);
      released = true;
    }

    if (released) {
      const current = streamRef.current;
      const tokens = releasedRef.current.slice();
      applyStream({
        id: current?.id ?? `chat-${idRef.current}`,
        tokens,
        steps: stepsRef.current.slice(),
        error: current?.error ?? null,
        started: tokens.some((token) => token.kind === "word"),
        settling: false,
        text: fullTextRef.current,
      });
    }

    scheduleRelease();
    maybeFinish();
  }, [applyStream, maybeFinish, scheduleRelease]);

  useEffect(() => {
    releaseTickRef.current = releaseTick;
  }, [releaseTick]);

  // Re-enable the demo input when the retry window passes — no reload needed.
  useEffect(() => {
    if (demoLimitSeconds === null) return;
    const until = demoLimitUntilRef.current;
    if (until === null) return;

    const remaining = until - Date.now();
    if (remaining <= 0) {
      demoLimitUntilRef.current = null;
      setDemoLimitSeconds(null);
      return;
    }
    const id = window.setTimeout(() => {
      demoLimitUntilRef.current = null;
      setDemoLimitSeconds(null);
    }, remaining);
    return () => window.clearTimeout(id);
  }, [demoLimitSeconds]);

  const handleDelta = useCallback(
    (delta: string) => {
      fullTextRef.current += delta;
      bufferRef.current += delta;

      const result = drainCompleteWords(
        bufferRef.current,
        lineStartRef.current,
      );
      bufferRef.current = result.rest;
      lineStartRef.current = result.lineStart;

      if (result.tokens.length > 0) {
        queueRef.current.push(...result.tokens);
        scheduleRelease();
      }
    },
    [scheduleRelease],
  );

  const flushTail = useCallback(() => {
    const tail = flushRemainingWords(bufferRef.current, lineStartRef.current);
    bufferRef.current = "";
    lineStartRef.current = true;

    if (tail.length > 0) queueRef.current.push(...tail);
    doneRef.current = true;

    scheduleRelease();
    maybeFinish();
  }, [maybeFinish, scheduleRelease]);

  /** Keep an unfinished error / partial answer in the history. */
  const commitStream = useCallback(() => {
    const current = streamRef.current;
    if (!current) return;

    if (current.tokens.length > 0 || current.error) {
      const text = tokensToText(current.tokens).trim();
      const combined = current.error
        ? text
          ? `${text}\n\n${current.error}`
          : current.error
        : text;

      if (combined) {
        const message: ChatMessage = {
          id: current.id,
          role: "assistant",
          text: combined,
          settled: true,
          error: Boolean(current.error),
        };
        const next = [...messagesRef.current, message];
        messagesRef.current = next;
        if (mountedRef.current) setMessages(next);
      }
    }

    applyStream(null);
  }, [applyStream]);

  /** Stop everything: request, timer, queue and any visible stream. */
  const abortStream = useCallback(() => {
    // Invalidate the running request first so a delta that was already in
    // flight can never reach the speech player again.
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    resetPipeline();
    applyStream(null);
    pendingRef.current = false;
    if (mountedRef.current) setPending(false);
  }, [applyStream, resetPipeline]);

  // Never update state or leave a request running after the drawer unmounts.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      player.stop();
    };
  }, [player]);

  // ---------------------------------------------------------------------
  // The conversation
  // ---------------------------------------------------------------------

  const runQuestion = useCallback(
    async (
      text: string,
      mode: "animate" | "collect" = "animate",
    ): Promise<string | null> => {
      const trimmed = text.trim();
      if (!trimmed || pendingRef.current) return null;

      // The token identifies this request. Any abort or newer request bumps it,
      // so late deltas of an old request are dropped instead of being spoken.
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      commitStream();
      setSpeakingId(null);

      // The demo keeps its own short history in the same message list; only
      // settled, error-free turns ride along (at most 10).
      const demoMode = modeRef.current === "demo-chat";
      const demoHistory = demoMode
        ? messagesRef.current
            .filter((message) => message.settled && !message.error)
            .slice(-10)
            .map((message) => ({ role: message.role, content: message.text }))
        : [];

      const userMessage: ChatMessage = {
        id: `chat-${idRef.current++}`,
        role: "user",
        text: trimmed,
      };

      const nextMessages = [...messagesRef.current, userMessage];
      messagesRef.current = nextMessages;
      setMessages(nextMessages);

      pendingRef.current = true;
      setPending(true);

      resetPipeline();

      const controller = new AbortController();
      abortRef.current = controller;

      if (mode === "animate") {
        applyStream({
          id: `chat-${idRef.current++}`,
          tokens: [],
          steps: [],
          error: null,
          started: false,
          settling: false,
          text: "",
        });
      }

      let collected = "";
      let failure: ChatStreamError | null = null;

      const handleStreamDelta = (delta: string) => {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        if (mode === "collect") {
          // Speak only while this request is still current AND the voice
          // mode that started it is still open with the sound on.
          if (
            !voiceModeRef.current ||
            !voiceRepliesRef.current ||
            !canSpeakRef.current
          ) {
            return;
          }
          collected += delta;
          // Voice mode hears the answer as it streams, one sentence at a
          // time; the text is still kept for the conversation history.
          player.push(delta);
          return;
        }
        handleDelta(delta);
      };
      const handleStreamDone = () => {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        if (mode === "animate") flushTail();
        else if (canSpeakRef.current) player.flush();
      };
      const handleStreamError = (error: ChatStreamError) => {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        failure = error;
        if (mode === "animate") failStream(error);
        else player.stop();
      };

      if (demoMode) {
        const config = demoConfigRef.current;
        if (!config) return null;

        await streamDemo({
          name: config.name,
          instructions: config.instructions,
          context: config.context,
          message: trimmed,
          history: demoHistory,
          signal: controller.signal,
          onDelta: handleStreamDelta,
          onDone: handleStreamDone,
          onError: handleStreamError,
        });
      } else {
        await streamAssistant({
          message: trimmed,
          sessionId: sessionIdRef.current,
          signal: controller.signal,
          onSession: (id) => {
            sessionIdRef.current = id;
          },
          onStatus: (status) => {
            if (controller.signal.aborted) return;
            if (requestId !== requestIdRef.current) return;
            // Voice mode ignores the live steps entirely.
            if (mode === "collect") return;

            stepsRef.current = [...stepsRef.current, status];
            const current = streamRef.current;
            if (!current) return;
            applyStream({ ...current, steps: stepsRef.current.slice(), settling: false });
          },
          onUi: () => {
            if (controller.signal.aborted) return;
            if (requestId !== requestIdRef.current) return;
            // Voice mode never shows the form.
            if (mode === "collect") return;

            uiContactFormRef.current = true;
          },
          onDelta: handleStreamDelta,
          onDone: handleStreamDone,
          onError: handleStreamError,
        });
      }

      if (controller.signal.aborted || requestId !== requestIdRef.current) {
        return null;
      }
      if (abortRef.current === controller) abortRef.current = null;

      if (mode === "collect") {
        pendingRef.current = false;
        if (mountedRef.current) setPending(false);

        if (failure || !collected.trim()) return null;

        const reply = collected.trim();
        const assistantMessage: ChatMessage = {
          id: `chat-${idRef.current++}`,
          role: "assistant",
          text: reply,
          settled: true,
        };
        const next = [...messagesRef.current, assistantMessage];
        messagesRef.current = next;
        if (mountedRef.current) setMessages(next);
        return reply;
      }

      return null;
    },
    [
      applyStream,
      commitStream,
      failStream,
      flushTail,
      handleDelta,
      player,
      resetPipeline,
    ],
  );

  const handleSend = useCallback(() => {
    // While the demo retry window runs, the send must not fire a request.
    if (
      modeRef.current === "demo-chat" &&
      demoLimitUntilRef.current !== null &&
      Date.now() < demoLimitUntilRef.current
    ) {
      return;
    }
    const value = input;
    setInput("");
    // Stop the previous reply first, then prime the audio element inside this
    // tap (the unlock must not be cancelled by the stop).
    player.stop();
    setSpeakingId(null);
    player.unlock();
    void runQuestion(value);
  }, [input, player, runQuestion]);

  const handlePick = useCallback(
    (question: string) => {
      player.stop();
      setSpeakingId(null);
      player.unlock();
      void runQuestion(question);
    },
    [player, runQuestion],
  );

  // ---------------------------------------------------------------------
  // Speech
  // ---------------------------------------------------------------------

  /**
   * The final transcript of a recognition session. In the voice mode it is
   * sent as a question and its streamed answer is spoken while it arrives; in
   * the text chat it only fills the textarea (the dictation never sends on its
   * own).
   */
  const handleFinal = useCallback(
    (text: string) => {
      if (voiceModeRef.current) {
        if (!text.trim()) {
          setVoiceStatus("idle");
          return;
        }

        setVoiceStatus("thinking");
        // A new question stops the previous answer before the tap primes audio.
        player.stop();
        setSpeakingId(null);
        player.unlock();
        void runQuestion(text, "collect").then((reply) => {
          if (!voiceModeRef.current) return;
          if (!reply) {
            player.stop();
            setVoiceStatus("idle");
          }
        });
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) return;
      setInput((current) => (current ? `${current} ${trimmed}` : trimmed));
    },
    [player, runQuestion],
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
  // The demo mode
  // ---------------------------------------------------------------------

  /** Opening screen → the demo setup screen (the normal chat is empty here). */
  const handleOpenDemoSetup = useCallback(() => {
    // Same mode-switch rule as Back: no in-flight request or recognition
    // survives, and nothing spoken keeps playing behind a mode change.
    abortStream();
    cancelRecognition();
    player.stop();
    setSpeakingId(null);
    setInput("");
    setDemoExitDirection("forward");
    setMode("demo-setup");
  }, [abortStream, cancelRecognition, player, setMode]);

  /** Validated by the setup screen — Start only fires with every field valid. */
  const handleDemoStart = useCallback(() => {
    const name = demoName.trim();
    const instructions = demoInstructions.trim();
    const context = demoContext.trim();

    if (
      !name ||
      name.length > MAX_DEMO_NAME ||
      !instructions ||
      instructions.length > MAX_DEMO_INSTRUCTIONS ||
      !context ||
      context.length > MAX_DEMO_CONTEXT
    ) {
      return;
    }

    // The untouched default shows the `[Name]` placeholder — swap the typed
    // name in at start time.
    const finalInstructions =
      demoInstructions === DEFAULT_DEMO_INSTRUCTIONS
        ? demoInstructions.replace("[Name]", name)
        : demoInstructions;

    demoConfigRef.current = { name, instructions: finalInstructions, context };
    setDemoExitDirection("forward");
    setMode("demo-chat");
  }, [demoContext, demoInstructions, demoName, setMode]);

  /**
   * Back to the normal Ask AI: aborts any in-flight request and clears the
   * whole demo state (setup values and history).
   */
  const handleDemoBack = useCallback(() => {
    abortStream();
    cancelRecognition();
    player.stop();
    setSpeakingId(null);
    demoConfigRef.current = null;
    setDemoName("");
    setDemoInstructions(DEFAULT_DEMO_INSTRUCTIONS);
    setDemoContext("");
    setInput("");
    setDemoExitDirection("back");
    setMode("daniyal");
  }, [abortStream, cancelRecognition, player, setMode]);

  // ---------------------------------------------------------------------
  // The controls
  // ---------------------------------------------------------------------

  const handleNewChat = useCallback(() => {
    abortStream();
    cancelRecognition();
    player.stop();
    sessionIdRef.current = undefined;
    messagesRef.current = [];
    setMessages([]);
    setInput("");
    setSpeakingId(null);
    setVoiceMode(false);
    voiceModeRef.current = false;
    setVoiceStatus("idle");
  }, [abortStream, cancelRecognition, player]);

  const handleVoiceRepliesChange = useCallback(
    (next: boolean) => {
      setVoiceReplies(next);

      if (next) {
        // This tap can also prime the audio element for the next reply.
        player.unlock();
        return;
      }

      // Turning the sound off always stops whatever is being read.
      player.stop();
      setSpeakingId(null);

      // A silent voice chat makes no sense — cancel the in-flight answer and
      // leave the voice mode. In the text chat the visible stream keeps going.
      if (voiceModeRef.current) {
        abortStream();
        cancelRecognition();
        setVoiceMode(false);
        voiceModeRef.current = false;
        setVoiceStatus("idle");
      }
    },
    [abortStream, cancelRecognition, player, setVoiceReplies],
  );

  const handleOpenVoice = useCallback(() => {
    player.stop();
    player.unlock();
    // A voice conversation is always spoken.
    setVoiceReplies(true);
    setVoiceMode(true);
    voiceModeRef.current = true;
    setVoiceStatus("idle");
  }, [player, setVoiceReplies]);

  const handleLeaveVoice = useCallback(() => {
    // Leaving drops the running voice answer for good (no late audio).
    abortStream();
    cancelRecognition();
    player.stop();
    setSpeakingId(null);
    setVoiceMode(false);
    voiceModeRef.current = false;
    setVoiceStatus("idle");
  }, [abortStream, cancelRecognition, player]);

  const handleToggleMic = useCallback(() => {
    if (voiceStatus === "listening") {
      stopRecognition();
      return;
    }
    // A new question cancels the pending / spoken one: the request is aborted,
    // the player stopped and the pending flag reset before listening starts.
    abortStream();
    player.stop();
    setSpeakingId(null);
    player.unlock();
    setVoiceStatus("listening");
    startRecognition();
  }, [
    abortStream,
    player,
    startRecognition,
    stopRecognition,
    voiceStatus,
  ]);

  const handleSpeak = useCallback(
    (message: ChatMessage) => {
      // speak() stops the previous answer itself; unlock comes after it so the
      // priming play is not immediately cancelled.
      player.speak(message.text);
      player.unlock();
      setSpeakingId(message.id);
    },
    [player],
  );

  const handleStopSpeaking = useCallback(() => {
    player.stop();
    setSpeakingId(null);
  }, [player]);

  /** Closing always stops the request, the microphone and the voice. */
  const handleClose = useCallback(() => {
    abortStream();
    cancelRecognition();
    player.stop();
    setSpeakingId(null);
    onClose();
  }, [abortStream, cancelRecognition, onClose, player]);

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
    handleClose();
  }, [pathname, handleClose]);

  // Never keep a request, the microphone or the voice running behind a
  // closed drawer.
  useEffect(() => {
    if (open) return;
    abortStream();
    cancelRecognition();
    player.stop();
  }, [open, abortStream, cancelRecognition, player]);

  const errorMessage = recognitionError
    ? recognitionError === "not-allowed" ||
      recognitionError === "service-not-allowed"
      ? content.askAi.voiceErrors.blocked
      : content.askAi.voiceErrors.failed
    : null;

  const demo = mode !== "daniyal";
  const showVoice = voiceMode;
  const showOpening =
    mode === "daniyal" && !voiceMode && messages.length === 0 && !stream;
  const showDemoIntro =
    mode === "demo-chat" && !voiceMode && messages.length === 0 && !stream;

  /**
   * Which middle screen is showing — the crossfade key. The outgoing screen
   * fades out and drifts slightly up while the incoming one fades in and
   * rises (`askAiMotion.mode`), so a mode change — including the first
   * message's opening → conversation swap — never snaps.
   */
  const screenId = showVoice
    ? "voice"
    : showOpening
      ? "opening"
      : showDemoIntro
        ? "demo-intro"
        : "conversation";

  const headerTitle =
    mode === "daniyal"
      ? showVoice
        ? content.askAi.voiceTitle
        : content.askAi.title
      : mode === "demo-setup"
        ? content.askAi.demo.setup.title
        : demoName.trim() || content.askAi.demo.badge;

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
            aria-label={
              demo ? content.askAi.demo.setup.title : content.askAi.title
            }
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
                title={headerTitle}
                subtitle={
                  mode === "daniyal" && showOpening
                    ? content.askAi.subtitle
                    : undefined
                }
                badge={demo ? content.askAi.demo.badge : undefined}
                onBack={mode === "demo-chat" ? handleDemoBack : undefined}
                onDemo={mode === "daniyal" ? handleOpenDemoSetup : undefined}
                theme={theme}
                onThemeChange={setTheme}
                voiceReplies={voiceReplies}
                onVoiceRepliesChange={handleVoiceRepliesChange}
                canSpeak={demo ? false : canSpeak}
                pending={pending}
                onNewChat={handleNewChat}
                onClose={handleClose}
              />

              <div className="relative flex min-h-0 flex-1 flex-col">
                {/* One crossfade for every middle-screen change. Each screen
                    fills the same box (absolute inset-0), so the crossfade
                    never shifts the layout, never shows a blank gap and the
                    leaving screen is not clickable. */}
                <AnimatePresence initial={false}>
                  <motion.div
                    key={screenId}
                    initial={{
                      opacity: 0,
                      y: reduce ? 0 : askAiMotion.mode.rise,
                      zIndex: 1,
                    }}
                    animate={{ opacity: 1, y: 0, zIndex: 1 }}
                    exit={{
                      opacity: 0,
                      y: reduce ? 0 : -askAiMotion.mode.exitDrift,
                      zIndex: 0,
                      pointerEvents: "none",
                    }}
                    transition={{
                      duration: reduce
                        ? askAiMotion.fade
                        : askAiMotion.mode.screen,
                      ease: askAiMotion.mode.ease,
                    }}
                    className="absolute inset-0 flex min-h-0 flex-col"
                  >
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
                      <ChatOpening
                        onPick={handlePick}
                        onDemo={handleOpenDemoSetup}
                      />
                    ) : showDemoIntro ? (
                      <DemoIntro />
                    ) : (
                      <ChatConversation
                        messages={messages}
                        pending={pending}
                        canSpeak={demo ? false : canSpeak}
                        speakingId={speakingId}
                        onSpeak={handleSpeak}
                        onStopSpeaking={handleStopSpeaking}
                        stream={stream}
                        settledId={settledId}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* The demo setup screen slides over the middle area; on the
                    way out it reveals the screen behind it. `custom` feeds
                    the leaving screen the CURRENT exit direction. */}
                <AnimatePresence custom={demoExitDirection}>
                  {mode === "demo-setup" ? (
                    <DemoSetup
                      key="demo-setup"
                      name={demoName}
                      instructions={demoInstructions}
                      context={demoContext}
                      exitDirection={demoExitDirection}
                      onNameChange={setDemoName}
                      onInstructionsChange={setDemoInstructions}
                      onContextChange={setDemoContext}
                      onStart={handleDemoStart}
                      onBack={handleDemoBack}
                    />
                  ) : null}
                </AnimatePresence>
              </div>

              {showVoice || mode === "demo-setup" ? null : (
                <ChatInput
                  value={input}
                  onChange={setInput}
                  onSend={handleSend}
                  busy={pending}
                  sendLocked={
                    mode === "demo-chat" && demoLimitSeconds !== null
                  }
                  canMic={canRecognize}
                  micActive={listening}
                  onMic={() => {
                    if (listening) stopRecognition();
                    else startRecognition();
                  }}
                  canWave={demo ? false : canRecognize}
                  onWave={handleOpenVoice}
                  error={errorMessage}
                  note={demo ? content.askAi.demo.note : undefined}
                />
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
