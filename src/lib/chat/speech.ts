/**
 * Minimal typings for the browser's built-in speech recognition.
 *
 * `SpeechRecognition` is not part of the TypeScript DOM library yet, so the
 * shapes the app actually uses are declared here. Nothing is installed and
 * nothing is fetched — this is the browser API only.
 */

export type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

export type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  0: SpeechRecognitionAlternativeLike;
};

export type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};

export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

export type SpeechRecognitionErrorEventLike = {
  error: string;
};

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

/**
 * The recognition constructor, or `null` when the browser has none.
 *
 * WebKit still ships it under a vendor prefix, so both names are probed.
 * The check only ever runs in the browser — there is no server render of it.
 */
export function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;

  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/** `true` when the browser can read text out loud. */
export function getSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}
