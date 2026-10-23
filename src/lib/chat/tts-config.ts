import "server-only";

/** The voice used for every spoken sentence. */
export const TTS_VOICE = "coral";

/** A calm, slightly slow pace. */
export const TTS_SPEED = 0.95;

/**
 * Extra delivery guidance. Only sent to the instruction-aware models
 * (`gpt-4o-mini-tts*`); `tts-1` / `tts-1-hd` reject it.
 */
export const TTS_INSTRUCTIONS =
  "Speak clearly and distinctly at a calm, slightly slow pace in a warm, friendly tone. The text may be English, or Roman Urdu (Urdu written with English letters), or a mix. Pronounce Urdu words naturally with a Pakistani accent and pronounce every word fully, without swallowing syllables. Keep the same steady voice for every sentence.";
