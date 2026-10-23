"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getSpeechOutputSupported,
  getSpeechRecognition,
  getSpeechSynthesisSupported,
  type SpeechRecognitionLike,
} from "@/lib/chat/speech";

/**
 * The browser capabilities never change while the page is open, so the
 * subscription is a no-op — the value is only read.
 */
function subscribeNothing() {
  return () => {};
}

function getRecognitionSnapshot(): boolean {
  return Boolean(getSpeechRecognition());
}

function getSynthesisSnapshot(): boolean {
  return getSpeechSynthesisSupported();
}

function getOutputSnapshot(): boolean {
  return getSpeechOutputSupported();
}

function getFalseSnapshot(): boolean {
  return false;
}

/**
 * `true` when speech output can work at all: the server voice needs only an
 * audio element, so the sound controls stay visible without browser synthesis.
 */
export function useSpeechOutputSupported(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    getOutputSnapshot,
    getFalseSnapshot,
  );
}

/**
 * Speech recognition, using the browser's built-in API only.
 *
 * `SpeechRecognition` / `webkitSpeechRecognition` are feature-detected on the
 * client, so the server and the first client render always agree. When the
 * browser has none, `supported` stays `false` and the caller hides the
 * microphone controls.
 */
export function useSpeechRecognition(onFinal: (text: string) => void) {
  const supported = useSyncExternalStore(
    subscribeNothing,
    getRecognitionSnapshot,
    getFalseSnapshot,
  );
  const [listening, setListening] = useState(false);
  /** The live (interim) transcript. */
  const [transcript, setTranscript] = useState("");
  /** A short, machine-readable error code — never shown raw. */
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  // The latest callback, so the recognition is never re-created just because
  // the caller changed its handler.
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  useEffect(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      if (final) finalRef.current = final;
      setTranscript(final || interim);
    };

    recognition.onerror = (event) => {
      setListening(false);
      setError(event.error);
    };

    recognition.onend = () => {
      setListening(false);
      const final = finalRef.current.trim();
      finalRef.current = "";
      // `onFinal` is always called — with an empty string when nothing was
      // recognised, so the caller can fall back to its idle state.
      onFinalRef.current(final);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // The browser may already have torn the session down.
      }
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setError(null);
    finalRef.current = "";
    setTranscript("");
    try {
      recognition.start();
      setListening(true);
    } catch {
      // Already listening — nothing to do.
    }
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // Already stopped — nothing to do.
    }
  }, []);

  const cancel = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    finalRef.current = "";
    setTranscript("");
    try {
      recognition.abort();
    } catch {
      // Already stopped — nothing to do.
    }
    setListening(false);
  }, []);

  return { supported, listening, transcript, error, start, stop, cancel };
}

/**
 * Speech output, using the browser's built-in synthesis only.
 *
 * No locale is forced on the utterance: the browser's own language is used.
 */
export function useSpeechSynthesis(onEnd?: () => void) {
  const supported = useSyncExternalStore(
    subscribeNothing,
    getSynthesisSnapshot,
    getFalseSnapshot,
  );
  const [speaking, setSpeaking] = useState(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onEndRef.current = onEnd;
  });

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === "undefined" || !getSpeechSynthesisSupported()) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    window.speechSynthesis.cancel();

    // A per-call callback wins over the one given to the hook.
    const done = onEnd ?? onEndRef.current;

    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.onend = () => {
      setSpeaking(false);
      done?.();
    };
    utterance.onerror = () => {
      setSpeaking(false);
      done?.();
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !getSpeechSynthesisSupported()) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
  }, []);

  // Never leave the browser talking after the drawer goes away.
  useEffect(() => {
    return () => {
      if (typeof window === "undefined" || !getSpeechSynthesisSupported()) return;
      window.speechSynthesis.cancel();
    };
  }, []);

  return { supported, speaking, speak, cancel };
}
