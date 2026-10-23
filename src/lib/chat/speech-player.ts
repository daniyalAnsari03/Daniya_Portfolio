/**
 * The client voice engine: sentence-by-sentence server speech with the browser
 * voice as the fallback.
 *
 * Text arrives as streaming deltas; complete sentences are fetched from
 * `/api/tts` (at most two requests in flight) and played strictly in order by a
 * single reused `HTMLAudioElement`. Nothing here touches a key, a model or any
 * server-only code — the browser only sees audio bytes.
 */

import {
  getAudioPlaybackSupported,
  getSpeechSynthesisSupported,
} from "@/lib/chat/speech";

const MAX_SENTENCE_LENGTH = 280;
const MAX_INFLIGHT_REQUESTS = 2;
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

const SENTENCE_ENDINGS = new Set([".", "!", "?", "؟", "۔", "…"]);
const TRAILING_CLOSERS = /["'”’)\]}»]/;
const WHITESPACE = /\s/;

/**
 * Common abbreviations whose trailing dot is not the end of a sentence. The
 * lowercase form is compared after stripping leading/trailing punctuation.
 */
const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "vs",
  "etc",
  "e.g",
  "i.e",
  "inc",
  "ltd",
  "co",
  "corp",
  "dept",
  "fig",
  "approx",
  "no",
  "vol",
  "al",
  "ph.d",
  "u.s",
  "u.k",
]);

type Boundary = {
  /** Where the sentence content ends (exclusive). */
  end: number;
  /** Where the next sentence starts (whitespace already skipped). */
  next: number;
};

function findBoundary(buffer: string, allowEnd: boolean): Boundary | null {
  for (let index = 0; index < buffer.length; index += 1) {
    const character = buffer[index];

    if (character === "\n") {
      const content = buffer.slice(0, index).trim();
      if (!content) return { end: 0, next: index + 1 };
      return { end: index, next: index + 1 };
    }

    if (!SENTENCE_ENDINGS.has(character)) continue;

    const following = buffer[index + 1];
    if (following === undefined) {
      if (!allowEnd) continue;
    } else if (!WHITESPACE.test(following)) {
      continue;
    }

    if (character === "." && isProtectedDot(buffer, index)) continue;

    let end = index + 1;
    while (end < buffer.length && TRAILING_CLOSERS.test(buffer[end])) {
      end += 1;
    }

    if (end >= buffer.length && !allowEnd) continue;

    let next = end;
    while (next < buffer.length && WHITESPACE.test(buffer[next])) next += 1;

    return { end, next };
  }

  return null;
}

/** A dot inside a word (Next.js), a number (3.0), a URL/email or an abbreviation. */
function isProtectedDot(buffer: string, index: number): boolean {
  const before = buffer.slice(0, index);
  const token = /(\S+)$/.exec(before)?.[1] ?? "";
  if (!token) return false;

  if (token.includes("@") || token.includes("://") || /^www\./i.test(token)) {
    return true;
  }

  const word = token.replace(/^[("'“‘\[]+/, "").replace(/[.,;:!?]+$/, "");

  if (!word) return false;
  if (ABBREVIATIONS.has(word.toLowerCase())) return true;
  if (/^[A-Za-z]$/.test(word)) return true;
  if (/^(?:[A-Za-z]\.)+[A-Za-z]?$/.test(word)) return true;

  return false;
}

/**
 * Where to cut an over-long window: after the last comma (so the comma stays
 * at the END of the previous piece), else at the last space.
 */
function longWindowCut(window: string): number {
  const comma = window.lastIndexOf(",");
  const space = window.lastIndexOf(" ");
  if (comma > space && comma >= 1) return comma + 1;
  if (space >= 1) return space;
  return MAX_SENTENCE_LENGTH;
}

/** Split an over-long sentence at the last comma or space before the cap. */
function splitLongSentence(sentence: string): string[] {
  if (sentence.length <= MAX_SENTENCE_LENGTH) return [sentence];

  const pieces: string[] = [];
  let rest = sentence;

  while (rest.length > MAX_SENTENCE_LENGTH) {
    const cut = longWindowCut(rest.slice(0, MAX_SENTENCE_LENGTH));

    const piece = rest.slice(0, cut).trim();
    if (piece) pieces.push(piece);
    rest = rest.slice(cut).trimStart();
  }

  if (rest) pieces.push(rest);
  return pieces;
}

/** Turns a stream of deltas into complete, playable sentences. */
class SentenceSplitter {
  private buffer = "";

  push(delta: string): string[] {
    this.buffer += delta;
    return this.drain(false);
  }

  flush(): string[] {
    return this.drain(true);
  }

  reset(): void {
    this.buffer = "";
  }

  private drain(allowEnd: boolean): string[] {
    const sentences: string[] = [];

    while (this.buffer.length > 0) {
      const boundary = findBoundary(this.buffer, allowEnd);

      if (!boundary) {
        if (this.buffer.length > MAX_SENTENCE_LENGTH) {
          const cut = longWindowCut(
            this.buffer.slice(0, MAX_SENTENCE_LENGTH),
          );

          const piece = this.buffer.slice(0, cut).trim();
          if (piece) sentences.push(...splitLongSentence(piece));
          this.buffer = this.buffer.slice(cut).trimStart();
          continue;
        }
        break;
      }

      const raw = this.buffer.slice(0, boundary.end).trim();
      this.buffer = this.buffer.slice(boundary.next);

      if (raw) sentences.push(...splitLongSentence(raw));
    }

    return sentences;
  }
}

const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/giu;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const EMOJI_PATTERN =
  /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}]/gu;

function spokenEmail(email: string): string {
  const [local, domain] = email.split("@");
  const spokenLocal = local.replace(/[._-]+/g, " ").trim();
  const spokenDomain = (domain ?? "").replace(/\./g, " dot ").replace(/-/g, " ");
  return `${spokenLocal} at ${spokenDomain}`.replace(/\s+/g, " ").trim();
}

/**
 * Clean one sentence before it is sent to the server: no emojis, markdown,
 * URLs; emails become spoken words; whitespace collapses.
 */
export function cleanSpeechText(input: string): string {
  let text = input;

  text = text.replace(URL_PATTERN, " ");
  text = text.replace(EMAIL_PATTERN, spokenEmail);
  text = text.replace(EMOJI_PATTERN, "");
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*#{1,6}\s+/gm, "");
  text = text.replace(/[`*_~]/g, "");
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

type SentenceItem = {
  id: number;
  text: string;
};

type AudioResult =
  | { kind: "audio"; url: string }
  | { kind: "error" };

type FetchResult =
  | { ok: true; url: string }
  | { ok: false; aborted: boolean };

export type SpeechPlayerCallbacks = {
  /** The first sentence actually started playing (audio or browser voice). */
  onStart?: () => void;
  /** The queue is empty and the answer has finished arriving. */
  onEnd?: () => void;
};

export type SpeechPlayer = {
  /** Feed one text delta from the answer stream. */
  push: (delta: string) => void;
  /** The answer stream finished — flush the unfinished tail. */
  flush: () => void;
  /** Stop anything playing and speak this complete text sentence by sentence. */
  speak: (text: string) => void;
  /** Immediately stop everything and clear the queue. */
  stop: () => void;
  /** Prime the single audio element inside a user tap (mobile autoplay). */
  unlock: () => void;
  setCallbacks: (callbacks: SpeechPlayerCallbacks) => void;
};

async function requestTts(
  text: string,
  signal: AbortSignal,
): Promise<FetchResult> {
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });

    if (!response.ok) return { ok: false, aborted: signal.aborted };

    const blob = await response.blob();
    if (!blob.size) return { ok: false, aborted: signal.aborted };

    return { ok: true, url: URL.createObjectURL(blob) };
  } catch {
    return { ok: false, aborted: signal.aborted };
  }
}

class SpeechPlayerImpl implements SpeechPlayer {
  private callbacks: SpeechPlayerCallbacks;
  private splitter = new SentenceSplitter();

  private items: SentenceItem[] = [];
  private results = new Map<number, AudioResult>();
  private nextToFetch = 0;
  private nextToPlay = 0;
  private nextId = 0;
  private inflight = 0;

  private audio: HTMLAudioElement | null = null;
  private abort: AbortController | null = null;
  private generation = 0;
  private playToken = 0;
  private unlockToken = 0;

  private playing = false;
  private answerDone = false;
  private stopped = true;
  private ended = true;
  private started = false;
  private consecutiveFailures = 0;
  private browserOnly = false;
  private fallbackResolve: (() => void) | null = null;

  constructor(callbacks: SpeechPlayerCallbacks) {
    this.callbacks = callbacks;
  }

  setCallbacks(callbacks: SpeechPlayerCallbacks): void {
    this.callbacks = callbacks;
  }

  push(delta: string): void {
    if (this.stopped || this.ended) this.beginAnswer();
    this.answerDone = false;
    this.enqueue(this.splitter.push(delta));
  }

  flush(): void {
    if (this.stopped) return;
    this.enqueue(this.splitter.flush());
    this.answerDone = true;
    this.maybeEnd();
  }

  speak(text: string): void {
    this.stop();
    this.push(text);
    this.flush();
  }

  stop(): void {
    this.cleanup();
    this.stopped = true;
    this.ended = true;
  }

  unlock(): void {
    const audio = this.ensureAudio();
    if (!audio) return;

    const token = ++this.unlockToken;

    try {
      audio.src = SILENT_WAV;
      const played = audio.play();
      if (played) {
        played
          .then(() => {
            if (token !== this.unlockToken) return;
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
          })
          .catch(() => {});
      }
    } catch {
      // Priming is best effort; playback later falls back if it is blocked.
    }
  }

  private ensureAudio(): HTMLAudioElement | null {
    if (!getAudioPlaybackSupported()) return null;
    if (!this.audio) {
      const audio = new Audio();
      audio.preload = "auto";
      this.audio = audio;
    }
    return this.audio;
  }

  private beginAnswer(): void {
    this.cleanup();
    this.generation += 1;
    this.stopped = false;
    this.ended = false;
    this.answerDone = false;
    this.started = false;
    this.playing = false;
    this.browserOnly = false;
    this.consecutiveFailures = 0;
    this.items = [];
    this.results = new Map();
    this.nextToFetch = 0;
    this.nextToPlay = 0;
    this.inflight = 0;
    this.abort = new AbortController();
  }

  private cleanup(): void {
    this.generation += 1;
    this.playToken += 1;
    this.unlockToken += 1;
    this.stopped = true;

    this.abort?.abort();
    this.abort = null;

    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.removeAttribute("src");
        this.audio.load();
      } catch {
        // The element may already be torn down.
      }
    }

    this.cancelBrowserSpeech();
    this.revokeAll();

    this.splitter.reset();
    this.items = [];
    this.results = new Map();
    this.nextToFetch = 0;
    this.nextToPlay = 0;
    this.inflight = 0;
    this.playing = false;
    this.answerDone = false;
    this.started = false;
    this.browserOnly = false;
    this.consecutiveFailures = 0;
  }

  private enqueue(sentences: string[]): void {
    for (const sentence of sentences) {
      const text = cleanSpeechText(sentence);
      // Punctuation-only pieces ("." / "—") have nothing to say and must not
      // reach /api/tts.
      if (!text || !/[\p{L}\p{N}]/u.test(text)) continue;
      this.items.push({ id: this.nextId++, text });
    }

    this.ensureFetches();
    this.pump();
  }

  private ensureFetches(): void {
    if (this.stopped || this.browserOnly) return;

    const signal = this.abort?.signal;
    if (!signal) return;

    while (
      this.inflight < MAX_INFLIGHT_REQUESTS &&
      this.nextToFetch < this.items.length &&
      this.nextToFetch < this.nextToPlay + MAX_INFLIGHT_REQUESTS
    ) {
      const item = this.items[this.nextToFetch];
      this.nextToFetch += 1;
      const generation = this.generation;
      this.inflight += 1;

      void requestTts(item.text, signal).then((result) => {
        if (generation !== this.generation) {
          if (result.ok) URL.revokeObjectURL(result.url);
          return;
        }

        this.inflight = Math.max(0, this.inflight - 1);

        if (this.stopped) {
          if (result.ok) URL.revokeObjectURL(result.url);
          return;
        }

        // Deliberately aborted (switchToBrowser): never an error, never a
        // failure count.
        if (!result.ok && result.aborted) return;

        if (result.ok) {
          this.consecutiveFailures = 0;
          this.results.set(item.id, { kind: "audio", url: result.url });
        } else {
          this.results.set(item.id, { kind: "error" });
          this.consecutiveFailures += 1;
          if (this.consecutiveFailures >= 2) this.switchToBrowser();
        }

        this.pump();
      });
    }
  }

  private switchToBrowser(): void {
    if (this.browserOnly) return;
    this.browserOnly = true;

    this.abort?.abort();
    this.abort = null;

    for (let index = this.nextToPlay + 1; index < this.items.length; index += 1) {
      this.revokeResult(this.items[index].id);
    }
  }

  private pump(): void {
    if (this.stopped || this.playing) return;

    const item = this.items[this.nextToPlay];
    if (!item) {
      this.maybeEnd();
      return;
    }

    if (this.browserOnly) {
      this.runBrowserFallback(item, this.nextToPlay);
      return;
    }

    const result = this.results.get(item.id);
    if (!result) {
      this.ensureFetches();
      return;
    }

    if (result.kind === "error") {
      this.runBrowserFallback(item, this.nextToPlay);
      return;
    }

    this.playAudio(item, this.nextToPlay, result.url);
  }

  private playAudio(item: SentenceItem, index: number, url: string): void {
    const audio = this.ensureAudio();
    if (!audio) {
      this.runBrowserFallback(item, index);
      return;
    }

    this.playing = true;
    this.unlockToken += 1;
    const token = ++this.playToken;

    const finish = () => {
      if (token !== this.playToken) return;
      this.playing = false;
      this.nextToPlay = index + 1;
      this.revokeResult(item.id);
      this.pump();
    };

    audio.onplaying = () => {
      if (token !== this.playToken) return;
      this.notifyStart();
    };

    audio.onended = finish;
    audio.onerror = () => {
      if (token !== this.playToken) return;
      this.playToken += 1;
      this.playing = false;
      this.runBrowserFallback(item, index);
    };

    try {
      audio.src = url;
      const played = audio.play();
      if (played) {
        played.catch(() => {
          if (token !== this.playToken) return;
          this.playToken += 1;
          this.playing = false;
          this.runBrowserFallback(item, index);
        });
      }
    } catch {
      this.playToken += 1;
      this.playing = false;
      this.runBrowserFallback(item, index);
      return;
    }

    this.ensureFetches();
  }

  private runBrowserFallback(item: SentenceItem, index: number): void {
    this.revokeResult(item.id);
    this.playing = true;
    const token = ++this.playToken;

    if (this.audio) {
      try {
        this.audio.pause();
      } catch {
        // Nothing playing.
      }
    }

    if (getSpeechSynthesisSupported()) this.notifyStart();

    this.speakWithBrowser(item.text).then(() => {
      if (token !== this.playToken || this.stopped) return;
      this.playing = false;
      this.nextToPlay = index + 1;
      this.pump();
    });
  }

  private speakWithBrowser(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!getSpeechSynthesisSupported()) {
        resolve();
        return;
      }

      try {
        window.speechSynthesis.cancel();
      } catch {
        // No speech session to cancel.
      }

      const utterance = new SpeechSynthesisUtterance(text);
      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        utterance.onend = null;
        utterance.onerror = null;
        if (this.fallbackResolve === finish) this.fallbackResolve = null;
        resolve();
      };

      utterance.onend = finish;
      utterance.onerror = finish;
      this.fallbackResolve = finish;

      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        finish();
      }
    });
  }

  private cancelBrowserSpeech(): void {
    if (!getSpeechSynthesisSupported()) {
      this.fallbackResolve = null;
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch {
      // No speech session to cancel.
    }

    const resolve = this.fallbackResolve;
    this.fallbackResolve = null;
    resolve?.();
  }

  private maybeEnd(): void {
    if (this.stopped || this.ended) return;
    if (!this.answerDone) return;
    if (this.playing) return;
    if (this.nextToPlay < this.items.length) return;
    if (this.inflight > 0 && !this.browserOnly) return;

    this.ended = true;
    this.callbacks.onEnd?.();
  }

  private notifyStart(): void {
    if (this.started) return;
    this.started = true;
    this.callbacks.onStart?.();
  }

  private revokeResult(id: number): void {
    const result = this.results.get(id);
    if (result?.kind === "audio") URL.revokeObjectURL(result.url);
    this.results.delete(id);
  }

  private revokeAll(): void {
    for (const result of this.results.values()) {
      if (result.kind === "audio") URL.revokeObjectURL(result.url);
    }
    this.results.clear();
  }
}

/**
 * One player per drawer. The callbacks are set by the component so the logo can
 * follow the real audio state.
 */
export function createSpeechPlayer(
  callbacks: SpeechPlayerCallbacks = {},
): SpeechPlayer {
  return new SpeechPlayerImpl(callbacks);
}
