"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ChatTheme } from "@/lib/chat/types";

const THEME_KEY = "ask-ai:theme";
const VOICE_KEY = "ask-ai:voice-replies";

const DEFAULT_THEME: ChatTheme = "light";

/** Every mounted consumer of the preferences. */
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/**
 * The store subscription: the `storage` event covers the other tabs, the
 * local listener set covers this one.
 */
function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readStored(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
    return "";
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable — the preference then only lasts this session.
  }
}

function getThemeSnapshot(): string {
  return readStored(THEME_KEY);
}

function getVoiceSnapshot(): string {
  return readStored(VOICE_KEY);
}

/** The server has no storage — every preference starts at its default. */
function getServerSnapshot(): string {
  return "";
}

function isTheme(value: string): value is ChatTheme {
  return value === "light" || value === "dark" || value === "gray";
}

/**
 * The two chat preferences: the theme and whether the assistant speaks its
 * replies out loud.
 *
 * Both live in `localStorage` and are read through `useSyncExternalStore`, so
 * the server render and the first client render always agree (no hydration
 * mismatch) and the stored value is picked up right after mount. Every access
 * is wrapped in `try/catch` — storage may be blocked entirely.
 */
export function useChatPreferences() {
  const storedTheme = useSyncExternalStore(
    subscribe,
    getThemeSnapshot,
    getServerSnapshot,
  );
  const storedVoice = useSyncExternalStore(
    subscribe,
    getVoiceSnapshot,
    getServerSnapshot,
  );

  const theme: ChatTheme = isTheme(storedTheme) ? storedTheme : DEFAULT_THEME;
  const voiceReplies = storedVoice === "true";

  const setTheme = useCallback((next: ChatTheme) => {
    writeStored(THEME_KEY, next);
    notify();
  }, []);

  const setVoiceReplies = useCallback((next: boolean) => {
    writeStored(VOICE_KEY, next ? "true" : "false");
    notify();
  }, []);

  return { theme, setTheme, voiceReplies, setVoiceReplies };
}
