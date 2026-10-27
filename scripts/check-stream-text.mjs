/**
 * Regression check for the streaming word pipeline (src/lib/chat/stream-text.ts).
 *
 * Bug it guards against: when a streamed delta ended right after a word, the
 * splitter released the word but left it inside the held-back buffer, so the
 * next delta released the same word twice ("Rs.Rs.", "+92+92", "subahsubah").
 *
 * The invariant checked here: for any way of cutting a text into deltas, the
 * concatenation of everything the pipeline emits must equal the text exactly.
 *
 * Run with:  node scripts/check-stream-text.mjs
 * (No packages needed — Node >= 23.6 runs the TypeScript sources directly.)
 */

import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "../src");

// Resolve the app's "@/..." alias to the TypeScript sources. `import type`
// lines are erased by Node's type stripping, so only the value import of
// inline-markdown needs the hook.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const target =
        pathToFileURL(path.join(srcRoot, specifier.slice(2))).href + ".ts";
      return nextResolve(target, context);
    }
    return nextResolve(specifier, context);
  },
});

const { drainCompleteWords, flushRemainingWords, tokensToText } = await import(
  pathToFileURL(path.join(srcRoot, "lib/chat/stream-text.ts")).href
);

/**
 * Run the exact client pipeline from ChatDrawer.handleDelta / flushTail:
 * every delta is drained, the withheld rest goes back into the buffer, and
 * the buffer is flushed once the stream ends.
 */
function streamText(text, chunks) {
  let buffer = "";
  let lineStart = true;
  const tokens = [];
  for (const chunk of chunks) {
    buffer += chunk;
    const result = drainCompleteWords(buffer, lineStart);
    buffer = result.rest;
    lineStart = result.lineStart;
    tokens.push(...result.tokens);
  }
  tokens.push(...flushRemainingWords(buffer, lineStart));
  return tokensToText(tokens);
}

/** Fixed cases from docs/fix.txt plus markdown / line-break coverage. */
const SAMPLES = [
  "+92 300 1234567",
  "Rs. 2,499",
  "10 baje se raat 8 baje tak",
  "(Rs. 3,499)",
  "Write to hello@example.com for details.",
  "Line one\nLine two\n\n- first\n- second\n- third\n",
  "**Bold** and a [link](https://example.com) together.",
  "Trailing space and word ",
];

/** Deterministic pseudo-random generator (same split plans on every run). */
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cut `text` into `parts` pieces at pseudo-random positions. */
function randomChunks(text, parts, random) {
  if (parts <= 1) return [text];
  const cuts = new Set();
  while (cuts.size < parts - 1) {
    cuts.add(1 + Math.floor(random() * Math.max(1, text.length - 1)));
  }
  const sorted = [...cuts].sort((a, b) => a - b);
  const chunks = [];
  let start = 0;
  for (const cut of [...sorted, text.length]) {
    chunks.push(text.slice(start, cut));
    start = cut;
  }
  return chunks;
}

let failures = 0;
function check(text, chunks) {
  const out = streamText(text, chunks);
  if (out !== text) {
    failures += 1;
    if (failures <= 20) {
      console.log(
        `FAIL chunks=${JSON.stringify(chunks)}\n  text: ${JSON.stringify(text)}\n  out:  ${JSON.stringify(out)}`,
      );
    }
  }
}

// 1) Every two-chunk split position of every sample.
for (const text of SAMPLES) {
  for (let k = 0; k <= text.length; k++) {
    check(text, [text.slice(0, k), text.slice(k)]);
  }
}

// 2) All three-chunk splits for the short samples.
for (const text of SAMPLES.filter((sample) => sample.length <= 16)) {
  for (let a = 0; a <= text.length; a++) {
    for (let b = a; b <= text.length; b++) {
      check(text, [text.slice(0, a), text.slice(a, b), text.slice(b)]);
    }
  }
}

// 3) Seeded multi-chunk (2–6 deltas) splits of the longer samples.
const random = mulberry32(20260207);
for (const text of SAMPLES) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const parts = 2 + Math.floor(random() * 5);
    check(text, randomChunks(text, parts, random));
  }
}

if (failures > 0) {
  console.log(`${failures} failing split(s)`);
  process.exit(1);
}
console.log(
  `check-stream-text: OK (${SAMPLES.length} samples, every 2-chunk split, all 3-chunk splits of short samples, seeded multi-chunk splits)`,
);
